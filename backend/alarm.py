"""
报警管理模块
负责违规检测报警、声光报警器控制
"""

import time
import threading
from typing import List, Dict, Optional, Callable
from collections import deque
import asyncio


class AlarmManager:
    """报警管理器"""
    
    def __init__(
        self,
        cooldown: float = 30.0,
        max_history: int = 1000,
        max_strikes: int = 3
    ):
        """
        初始化报警管理器
        
        Args:
            cooldown: 同类报警冷却时间 (秒)
            max_history: 历史记录最大数量
            max_strikes: 同一摄像头同一违规类型连续报警次数上限，超过后自动屏蔽
        """
        self.cooldown = cooldown
        self.max_history = max_history
        self.max_strikes = max_strikes
        
        # 订阅者
        self._subscribers: List = []
        self._subscribers_lock = threading.Lock()
        
        # 最后一次报警时间
        self._last_alarm_times: Dict[str, float] = {}
        self._times_lock = threading.Lock()
        
        # 连续违规计数（用于3次触发后屏蔽）
        self._strike_counts: Dict[str, int] = {}
        self._strike_lock = threading.Lock()
        
        # 被屏蔽的摄像头+违规类型组合
        self._suppressed_keys: set = set()
        
        # 历史记录
        self._history: deque = deque(maxlen=max_history)
        
        # 回调函数
        self._callbacks: List[Callable] = []
        
        # 报警器硬件接口
        self._alarm_devices: Dict[str, 'AlarmDevice'] = {}
    
    def subscribe(self, websocket):
        """订阅报警"""
        self._subscribers_lock.acquire()
        if websocket not in self._subscribers:
            self._subscribers.append(websocket)
        self._subscribers_lock.release()
    
    def unsubscribe(self, websocket):
        """取消订阅"""
        self._subscribers_lock.acquire()
        if websocket in self._subscribers:
            self._subscribers.remove(websocket)
        self._subscribers_lock.release()
    
    def trigger(
        self,
        camera_id: int,
        violation_type: str,
        location: str = "",
        image_path: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> bool:
        """
        触发报警
        
        Args:
            camera_id: 摄像头 ID
            violation_type: 违规类型
            location: 位置
            image_path: 图像路径
            metadata: 额外数据
        
        Returns:
            是否成功触发
        """
        # 检查冷却时间
        alarm_key = f"{camera_id}_{violation_type}"
        
        with self._times_lock:
            last_time = self._last_alarm_times.get(alarm_key, 0)
            if time.time() - last_time < self.cooldown:
                return False  # 冷却中
            
            self._last_alarm_times[alarm_key] = time.time()
        
        # 构建报警数据
        alarm_data = {
            'alarm_id': int(time.time() * 1000),
            'camera_id': camera_id,
            'violation_type': violation_type,
            'location': location,
            'image_path': image_path,
            'timestamp': time.time(),
            'metadata': metadata or {},
        }
        
        # 添加到历史
        self._history.append(alarm_data)
        
        # 触发硬件报警
        self._trigger_hardware(alarm_data)
        
        # 广播给订阅者
        self._broadcast(alarm_data)
        
        # 执行回调
        for callback in self._callbacks:
            try:
                callback(alarm_data)
            except Exception as e:
                print(f"报警回调失败: {e}")
        
        return True
    
    def trigger_alarm(
        self,
        alarm_type: str,
        camera_id: int = None,
        camera_name: str = "",
        image=None,
        violations: list = None
    ) -> bool:
        """
        触发报警（简化接口）
        
        Args:
            alarm_type: 报警类型
            camera_id: 摄像头 ID
            camera_name: 摄像头名称
            image: 图像帧
            violations: 违规列表
        
        Returns:
            是否成功触发
        """
        import numpy as np
        import base64
        import cv2
        
        image_path = ""
        if image is not None:
            try:
                # 保存图像到临时文件
                import tempfile
                import os
                from pathlib import Path
                
                temp_dir = Path("data/alarms")
                temp_dir.mkdir(parents=True, exist_ok=True)
                
                filename = temp_dir / f"alarm_{int(time.time() * 1000)}.jpg"
                cv2.imwrite(str(filename), image)
                image_path = str(filename)
            except Exception as e:
                print(f"保存报警图像失败: {e}")
        
        return self.trigger(
            camera_id=camera_id or 0,
            violation_type=alarm_type,
            location=camera_name,
            image_path=image_path,
            metadata={'violations': violations or []}
        )
    
    def should_alarm(self, alarm_type: str, camera_id: int = None, employee_id: int = None, track_id: int = None) -> bool:
        """
        检查是否应该触发报警（考虑冷却时间和3次触发屏蔽）
        
        Args:
            alarm_type: 报警类型
            camera_id: 摄像头 ID
            employee_id: 员工 ID（用于同员工不反复报警）
            track_id: ByteTrack 追踪 ID（用于同一人不反复报警）
        
        Returns:
            是否应该触发报警
        """
        # 优先使用 employee_id 来判断（同一员工不反复报警）
        if employee_id:
            alarm_key = f"{camera_id or 0}_{alarm_type}_emp{employee_id}"
        elif track_id is not None:
            alarm_key = f"{camera_id or 0}_{alarm_type}_track{track_id}"
        else:
            alarm_key = f"{camera_id or 0}_{alarm_type}"
        
        # 检查是否被屏蔽
        with self._strike_lock:
            if alarm_key in self._suppressed_keys:
                emp_info = f"员工 {employee_id}" if employee_id else (f"追踪ID {track_id}" if track_id is not None else f"摄像头 {camera_id}")
                print(f"[AlarmManager] {emp_info} 违规类型 {alarm_type} 已在屏蔽列表，跳过报警")
                return False
        
        with self._times_lock:
            last_time = self._last_alarm_times.get(alarm_key, 0)
            if time.time() - last_time < self.cooldown:
                print(f"[AlarmManager] 冷却中，跳过报警")
                return False  # 冷却中
            return True
    
    def record_violation(self, alarm_type: str, camera_id: int = None, employee_id: int = None, track_id: int = None) -> bool:
        """
        记录一次违规触发，用于3次触发后屏蔽该摄像头+违规类型+员工
        返回True表示正常触发，返回False表示已被屏蔽
        """
        # 优先使用 employee_id 来屏蔽（同一员工不反复报警）
        if employee_id:
            alarm_key = f"{camera_id or 0}_{alarm_type}_emp{employee_id}"
        elif track_id is not None:
            alarm_key = f"{camera_id or 0}_{alarm_type}_track{track_id}"
        else:
            alarm_key = f"{camera_id or 0}_{alarm_type}"
        
        with self._strike_lock:
            if alarm_key in self._suppressed_keys:
                return False
            
            count = self._strike_counts.get(alarm_key, 0) + 1
            self._strike_counts[alarm_key] = count
            
            if count >= self.max_strikes:
                self._suppressed_keys.add(alarm_key)
                emp_info = f"员工 {employee_id}" if employee_id else (f"追踪ID {track_id}" if track_id is not None else f"摄像头 {camera_id}")
                print(f"[AlarmManager] {emp_info} 违规类型 {alarm_type} 连续触发 {count} 次，已屏蔽")
                return False
        
        return True
    
    def reset_strikes(self, alarm_type: str = None, camera_id: int = None):
        with self._strike_lock:
            if alarm_type and camera_id:
                key = f"{camera_id}_{alarm_type}"
                self._strike_counts.pop(key, None)
                self._suppressed_keys.discard(key)
            elif alarm_type:
                keys_to_remove = [k for k in self._suppressed_keys if k.endswith(f"_{alarm_type}")]
                for k in keys_to_remove:
                    self._suppressed_keys.discard(k)
                    self._strike_counts.pop(k.split('_')[0], None)
            elif camera_id:
                keys_to_remove = [k for k in self._suppressed_keys if k.startswith(f"{camera_id}_")]
                for k in keys_to_remove:
                    self._suppressed_keys.discard(k)
                    self._strike_counts.pop(k.split('_')[1], None)
            else:
                self._strike_counts.clear()
                self._suppressed_keys.clear()
    
    def _trigger_hardware(self, alarm_data: Dict):
        """触发硬件报警"""
        # 查找关联的报警设备
        for device in self._alarm_devices.values():
            if device.camera_id == alarm_data['camera_id']:
                try:
                    device.trigger(alarm_data['violation_type'])
                except Exception as e:
                    print(f"硬件报警失败: {e}")
    
    def _broadcast(self, alarm_data: Dict):
        """广播报警"""
        self._subscribers_lock.acquire()
        subscribers = self._subscribers.copy()
        self._subscribers_lock.release()
        
        import json
        
        for subscriber in subscribers:
            try:
                # 检查是异步还是同步
                if hasattr(asyncio, 'iscoroutine'):
                    asyncio.create_task(subscriber.send_text(
                        json.dumps(alarm_data)
                    ))
                else:
                    subscriber.send_text(json.dumps(alarm_data))
            except Exception as e:
                print(f"广播报警失败: {e}")
    
    def register_callback(self, callback: Callable):
        """注册回调函数"""
        self._callbacks.append(callback)
    
    def add_alarm_device(
        self,
        device_id: str,
        device_type: str,
        camera_id: int,
        config: Dict
    ):
        """添加报警设备"""
        device = AlarmDevice(
            device_id=device_id,
            device_type=device_type,
            camera_id=camera_id,
            config=config
        )
        
        self._alarm_devices[device_id] = device
    
    def remove_alarm_device(self, device_id: str):
        """移除报警设备"""
        if device_id in self._alarm_devices:
            del self._alarm_devices[device_id]
    
    def get_history(
        self,
        camera_id: Optional[int] = None,
        limit: int = 100
    ) -> List[Dict]:
        """获取历史报警"""
        results = []
        
        for alarm in reversed(self._history):
            if camera_id is None or alarm['camera_id'] == camera_id:
                results.append(alarm)
            
            if len(results) >= limit:
                break
        
        return results
    
    def clear_history(self):
        """清空历史"""
        self._history.clear()
        self._last_alarm_times.clear()
    
    def get_statistics(self) -> Dict:
        """获取统计信息"""
        now = time.time()
        today_start = now - 86400  # 24小时
        
        today_count = 0
        type_counts = {}
        
        for alarm in self._history:
            if alarm['timestamp'] >= today_start:
                today_count += 1
            
            vtype = alarm['violation_type']
            type_counts[vtype] = type_counts.get(vtype, 0) + 1
        
        return {
            'total': len(self._history),
            'today': today_count,
            'by_type': type_counts,
            'devices': len(self._alarm_devices),
            'subscribers': len(self._subscribers),
        }


class AlarmDevice:
    """报警设备"""
    
    def __init__(
        self,
        device_id: str,
        device_type: str,
        camera_id: int,
        config: Dict
    ):
        self.device_id = device_id
        self.device_type = device_type  # 'sound_light', 'voice'
        self.camera_id = camera_id
        self.config = config
        
        # 串口或网络连接
        self._connection = None
    
    def connect(self) -> bool:
        """连接设备"""
        if self.device_type == 'serial':
            return self._connect_serial()
        elif self.device_type == 'tcp':
            return self._connect_tcp()
        return False
    
    def _connect_serial(self) -> bool:
        """连接串口"""
        try:
            import serial
            self._connection = serial.Serial(
                port=self.config.get('port', 'COM1'),
                baudrate=self.config.get('baudrate', 9600),
                timeout=1
            )
            return True
        except Exception as e:
            print(f"串口连接失败: {e}")
            return False
    
    def _connect_tcp(self) -> bool:
        """连接 TCP"""
        try:
            import socket
            self._connection = socket.socket(
                socket.AF_INET,
                socket.SOCK_STREAM
            )
            self._connection.connect((
                self.config.get('host', '192.168.1.100'),
                self.config.get('port', 9000)
            ))
            return True
        except Exception as e:
            print(f"TCP 连接失败: {e}")
            return False
    
    def trigger(self, violation_type: str):
        """触发报警"""
        if not self._connection:
            self.connect()
        
        if self.device_type == 'voice':
            self._play_voice(violation_type)
        elif self.device_type in ('serial', 'tcp'):
            self._send_command(violation_type)
    
    def _play_voice(self, violation_type: str):
        """播放语音"""
        # 获取语音文件路径
        voice_file = self.config.get('voice_files', {}).get(
            violation_type,
            self.config.get('default_voice')
        )
        
        if voice_file:
            # TODO: 实现语音播放
            print(f"播放语音: {voice_file}")
    
    def _send_command(self, violation_type: str):
        """发送命令"""
        if not self._connection:
            return
        
        try:
            # 组装命令
            cmd = self.config.get('command_format', 
                             'ALARM:{type}\n').format(
                type=violation_type.upper()
            )
            
            if self.device_type == 'serial':
                self._connection.write(cmd.encode('utf-8'))
            else:
                self._connection.send(cmd.encode('utf-8'))
        
        except Exception as e:
            print(f"发送命令失败: {e}")
    
    def close(self):
        """关闭连接"""
        if self._connection:
            try:
                self._connection.close()
            except Exception:
                pass
            self._connection = None


def create_alarm_manager(**kwargs) -> AlarmManager:
    """创建报警管理器"""
    return AlarmManager(**kwargs)