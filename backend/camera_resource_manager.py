"""
摄像头资源管理器
协调多个功能模块对摄像头的访问，支持优先级调度、功能复用、时间片轮转
"""

import time
import threading
import cv2
import numpy as np
from typing import Optional, Dict, List, Callable
from enum import IntEnum
from collections import deque


class CameraPriority(IntEnum):
    """摄像头使用优先级（数值越小优先级越高）"""
    SAFETY_DETECTION = 1   # 安全检测（最高优先级，不可抢占）
    ATTENDANCE = 2          # 人脸签到
    INSPECTION = 3          # 巡检
    MONITORING = 4          # 视频监控预览


class CameraTask:
    """摄像头任务"""

    def __init__(
        self,
        task_id: str,
        function: str,
        priority: int,
        camera_index: int,
        duration: float = 0,
        callback: Optional[Callable] = None,
    ):
        """
        Args:
            task_id: 任务唯一标识
            function: 功能名称 (safety/attendance/inspection/monitoring)
            priority: 优先级
            camera_index: 摄像头索引
            duration: 占用时长(秒)，0表示持续占用
            callback: 任务完成回调
        """
        self.task_id = task_id
        self.function = function
        self.priority = priority
        self.camera_index = camera_index
        self.duration = duration
        self.callback = callback
        self.created_at = time.time()
        self.is_active = True


class SharedCameraStream:
    """共享摄像头流 - 一个摄像头被多个功能按优先级共享"""

    def __init__(self, camera_index: int, backend: int = cv2.CAP_DSHOW):
        self.camera_index = camera_index
        self.backend = backend
        self._cap: Optional[cv2.VideoCapture] = None
        self._lock = threading.Lock()
        self._frame: Optional[np.ndarray] = None
        self._latest_frame_time: float = 0
        self._capture_thread: Optional[threading.Thread] = None
        self._is_running = False
        self._frame_callbacks: Dict[str, Callable] = {}
        self._width = 0
        self._height = 0
        self._fps = 0

    def open(self) -> bool:
        """打开摄像头"""
        with self._lock:
            if self._cap and self._cap.isOpened():
                return True

            for b in (self.backend, cv2.CAP_MSMF, cv2.CAP_ANY):
                try:
                    cap = cv2.VideoCapture(self.camera_index, b)
                    if cap.isOpened():
                        ret, frame = cap.read()
                        if ret and frame is not None and frame.size > 0:
                            self._cap = cap
                            self._width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                            self._height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                            fps = cap.get(cv2.CAP_PROP_FPS)
                            self._fps = int(fps) if fps > 0 else 15
                            print(f"[SharedCamera] 摄像头 #{self.camera_index} 打开成功")
                            return True
                        cap.release()
                except Exception:
                    continue
            return False

    def start_capture(self):
        """启动捕获线程"""
        if self._is_running:
            return
        if not self._cap or not self._cap.isOpened():
            if not self.open():
                return
        self._is_running = True
        self._capture_thread = threading.Thread(
            target=self._capture_loop, daemon=True
        )
        self._capture_thread.start()

    def stop_capture(self):
        """停止捕获"""
        self._is_running = False
        if self._capture_thread:
            self._capture_thread.join(timeout=2)
            self._capture_thread = None

    def release(self):
        """释放摄像头"""
        self.stop_capture()
        with self._lock:
            if self._cap:
                self._cap.release()
                self._cap = None
            self._frame = None

    def _capture_loop(self):
        """持续捕获帧"""
        while self._is_running:
            with self._lock:
                if not self._cap or not self._cap.isOpened():
                    break
                ret, frame = self._cap.read()
                if ret and frame is not None:
                    self._frame = frame.copy()
                    self._latest_frame_time = time.time()
                    # 通知所有订阅者
                    for task_id, cb in list(self._frame_callbacks.items()):
                        try:
                            cb(frame)
                        except Exception:
                            pass
            time.sleep(0.033)

    def get_frame(self) -> Optional[np.ndarray]:
        """获取最新帧（无锁快照）"""
        with self._lock:
            if self._frame is not None:
                return self._frame.copy()
        return None

    def register_callback(self, task_id: str, callback: Callable):
        """注册帧回调"""
        self._frame_callbacks[task_id] = callback

    def unregister_callback(self, task_id: str):
        """取消帧回调"""
        self._frame_callbacks.pop(task_id, None)

    def get_info(self) -> Dict:
        return {
            'camera_index': self.camera_index,
            'width': self._width,
            'height': self._height,
            'fps': self._fps,
            'is_running': self._is_running,
            'is_opened': self._cap is not None and self._cap.isOpened(),
            'subscribers': len(self._frame_callbacks),
        }


class CameraResourceManager:
    """
    摄像头资源管理器

    协调策略:
    1. 安全检测: 最高优先级，独占摄像头，不可被抢占
    2. 人脸签到: 高优先级，可抢占低优先级任务
    3. 巡检: 中优先级
    4. 视频监控: 最低优先级，可被抢占

    工厂部署建议:
    - 入口摄像头: 安全检测 + 人脸签到（时间片轮转）
    - 车间摄像头: 安全检测独占
    - 签到台摄像头: 人脸签到独占
    """

    def __init__(self):
        self._streams: Dict[int, SharedCameraStream] = {}
        self._tasks: Dict[str, CameraTask] = {}
        self._lock = threading.Lock()
        self._camera_assignments: Dict[int, str] = {}  # camera_index -> primary_task_id

    def request_camera(
        self,
        task_id: str,
        function: str,
        camera_index: int,
        priority: int = CameraPriority.MONITORING,
        duration: float = 0,
        callback: Optional[Callable] = None,
    ) -> Dict:
        """
        请求摄像头资源

        Args:
            task_id: 任务ID
            function: 功能名称 (safety/attendance/inspection/monitoring)
            camera_index: 摄像头索引
            priority: 优先级
            duration: 占用时长(秒), 0=持续
            callback: 帧回调

        Returns:
            {success, message, camera_index}
        """
        with self._lock:
            # 检查是否有更高优先级任务占用
            current_task_id = self._camera_assignments.get(camera_index)
            if current_task_id and current_task_id in self._tasks:
                current_task = self._tasks[current_task_id]
                if current_task.priority < priority:
                    # 当前任务优先级更高，无法抢占
                    return {
                        'success': False,
                        'message': f'摄像头 #{camera_index} 被高优先级任务 {current_task.function} 占用',
                        'camera_index': camera_index,
                        'current_task': current_task.function,
                    }
                # 可以抢占：停止当前任务
                print(f"[CameraManager] 任务 {task_id}({function}) 抢占摄像头 #{camera_index}，原任务: {current_task_id}({current_task.function})")
                self._stop_task(current_task_id)

            # 确保流存在
            if camera_index not in self._streams:
                stream = SharedCameraStream(camera_index)
                if not stream.open():
                    return {
                        'success': False,
                        'message': f'无法打开摄像头 #{camera_index}',
                        'camera_index': camera_index,
                    }
                self._streams[camera_index] = stream

            stream = self._streams[camera_index]

            # 注册回调
            if callback:
                stream.register_callback(task_id, callback)

            # 启动捕获（如果没有在运行）
            if not stream._is_running:
                stream.start_capture()

            # 记录任务
            task = CameraTask(
                task_id=task_id,
                function=function,
                priority=priority,
                camera_index=camera_index,
                duration=duration,
                callback=callback,
            )
            self._tasks[task_id] = task
            self._camera_assignments[camera_index] = task_id

            print(f"[CameraManager] 任务 {task_id}({function}) 获取摄像头 #{camera_index} 成功")
            return {
                'success': True,
                'message': '成功',
                'camera_index': camera_index,
            }

    def release_camera(self, task_id: str):
        """释放摄像头资源"""
        with self._lock:
            task = self._tasks.pop(task_id, None)
            if not task:
                return

            camera_index = task.camera_index
            stream = self._streams.get(camera_index)
            if stream:
                stream.unregister_callback(task_id)
                # 如果没有其他任务使用，停止捕获并释放
                remaining = [
                    t for t in self._tasks.values()
                    if t.camera_index == camera_index and t.is_active
                ]
                if not remaining:
                    self._camera_assignments.pop(camera_index, None)
                    stream.stop_capture()
                    stream.release()
                    del self._streams[camera_index]
                    print(f"[CameraManager] 摄像头 #{camera_index} 已释放")
                else:
                    # 把控制权交给剩余最高优先级任务
                    top = min(remaining, key=lambda t: t.priority)
                    self._camera_assignments[camera_index] = top.task_id
                    print(f"[CameraManager] 摄像头 #{camera_index} 控制权转移给 {top.task_id}({top.function})")

            if task.callback:
                try:
                    task.callback(None)
                except Exception:
                    pass

    def get_frame(self, camera_index: int) -> Optional[np.ndarray]:
        """获取指定摄像头的最新帧"""
        stream = self._streams.get(camera_index)
        if stream:
            return stream.get_frame()
        return None

    def get_camera_status(self) -> List[Dict]:
        """获取所有摄像头状态"""
        with self._lock:
            result = []
            for cam_idx, stream in self._streams.items():
                task_id = self._camera_assignments.get(cam_idx)
                task = self._tasks.get(task_id) if task_id else None
                result.append({
                    'camera_index': cam_idx,
                    'info': stream.get_info(),
                    'assigned_task': {
                        'task_id': task.task_id,
                        'function': task.function,
                        'priority': task.priority,
                    } if task else None,
                })
            return result

    def _stop_task(self, task_id: str):
        """停止指定任务（内部使用，需在锁内调用）"""
        task = self._tasks.pop(task_id, None)
        if task:
            task.is_active = False
            stream = self._streams.get(task.camera_index)
            if stream:
                stream.unregister_callback(task_id)

    def cleanup(self):
        """清理所有资源"""
        with self._lock:
            for task_id in list(self._tasks.keys()):
                self._stop_task(task_id)
            for stream in self._streams.values():
                stream.release()
            self._streams.clear()
            self._tasks.clear()
            self._camera_assignments.clear()


def create_camera_resource_manager() -> CameraResourceManager:
    """创建摄像头资源管理器"""
    return CameraResourceManager()
