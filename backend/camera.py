"""
摄像头检测模块
使用 OpenCV 检测系统可用的摄像头
"""

import platform
import cv2
import numpy as np
from typing import List, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed

# Windows 上使用 DirectShow 后端，兼容性远优于默认的 MSMF
_DEFAULT_BACKEND = cv2.CAP_DSHOW if platform.system() == "Windows" else cv2.CAP_ANY


def _probe_camera(index: int) -> dict | None:
    """探测单个摄像头是否可用（快速：只读 1 帧）"""
    try:
        cap = cv2.VideoCapture(index, _DEFAULT_BACKEND)
        if not cap.isOpened():
            return None
        ret, frame = cap.read()
        if not ret or frame is None or frame.size == 0:
            cap.release()
            return None
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        cap.release()
        return {
            'id': index,
            'name': f'Camera {index}',
            'available': True,
            'width': width if width > 0 else 1280,
            'height': height if height > 0 else 720,
            'fps': int(fps) if fps > 0 else 15,
            'is_usb': True,
            'device_id': str(index),
            'group_id': f'camera_group_{index}',
        }
    except Exception:
        return None


class USBCameraDetector:
    """USB 摄像头检测器"""

    @staticmethod
    def list_cameras(max_devices: int = 10, workers: int = 5) -> List[Dict]:
        """
        并行检测所有可用摄像头

        Args:
            max_devices: 最大检测设备号
            workers: 并行探测线程数
        """
        cameras = []
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(_probe_camera, i): i for i in range(max_devices)}
            for future in as_completed(futures):
                result = future.result()
                if result:
                    cameras.append(result)
        cameras.sort(key=lambda c: c['id'])
        return cameras


def detect_usb_cameras() -> List[Dict]:
    """
    检测所有可用的 USB/内置摄像头

    Returns:
        摄像头列表
    """
    return USBCameraDetector.list_cameras()


class Camera:
    """摄像头采集类"""
    
    def __init__(
        self,
        camera_index: int = 0,
        width: int = 1280,
        height: int = 720,
        fps: int = 15
    ):
        self.camera_index = camera_index
        self.width = width
        self.height = height
        self.fps = fps
        
        self._cap = None
        self._is_opened = False
        self._lock = __import__('threading').Lock()
        self._frame_count = 0
        self._last_frame_time = 0
    
    def open(self, device_id: str = None) -> bool:
        """打开摄像头"""
        with self._lock:
            try:
                # 如果指定了 device_id，找到对应的索引
                index = self.camera_index
                if device_id:
                    try:
                        index = int(device_id)
                    except (ValueError, TypeError):
                        index = self.camera_index
                
                self._cap = cv2.VideoCapture(index, _DEFAULT_BACKEND)
                
                if not self._cap.isOpened():
                    return False
                
                # 设置参数
                self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
                self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
                self._cap.set(cv2.CAP_PROP_FPS, self.fps)
                
                # 获取实际参数
                self.width = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                self.height = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                actual_fps = self._cap.get(cv2.CAP_PROP_FPS)
                self.fps = int(actual_fps) if actual_fps > 0 else 15
                
                self._is_opened = True
                return True
                
            except Exception as e:
                print(f"打开摄像头失败: {e}")
                self._cap = None
                return False
    
    def close(self):
        """关闭摄像头"""
        with self._lock:
            if self._cap:
                self._cap.release()
                self._cap = None
            self._is_opened = False
    
    def is_opened(self) -> bool:
        """检查是否已打开"""
        with self._lock:
            if self._cap:
                self._is_opened = self._cap.isOpened()
            return self._is_opened
    
    def read(self):
        """读取下一帧"""
        with self._lock:
            if not self._is_opened or not self._cap:
                return None
            
            ret, frame = self._cap.read()
            if ret:
                self._frame_count += 1
                self._last_frame_time = __import__('time').time()
            return frame if ret else None
    
    def get_jpeg_frame(self):
        """获取 JPEG 编码的帧"""
        frame = self.read()
        if frame is None:
            return None
        
        # 水平翻转 (镜像)
        frame = cv2.flip(frame, 1)
        
        # 编码为 JPEG
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return buffer.tobytes()
    
    def get_info(self):
        """获取摄像头信息"""
        return {
            'index': self.camera_index,
            'width': self.width,
            'height': self.height,
            'fps': self.fps,
            'is_opened': self._is_opened,
            'frame_count': self._frame_count
        }
    
    def check_connection(self) -> bool:
        """检查连接状态"""
        with self._lock:
            if not self._cap or not self._is_opened:
                return False
            
            ret, _ = self._cap.read()
            return ret
    
    def __del__(self):
        self.close()


def create_camera(**kwargs):
    """创建摄像头实例"""
    cam = Camera(**kwargs)
    if cam.open():
        return cam
    return None
