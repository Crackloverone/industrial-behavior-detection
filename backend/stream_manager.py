"""
视频流管理模块
负责 RTSP/RTMP 视频流的接入和处理
"""

import platform
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from typing import Optional, Dict, List, Tuple
import asyncio
import threading
import time
from collections import deque
import queue
from pathlib import Path
import shutil
import subprocess

_IS_WINDOWS = platform.system() == "Windows"

_CN_FONT = None
if _IS_WINDOWS:
    for _fn in ("msyh.ttc", "simhei.ttf", "simsun.ttc"):
        _fp = Path("C:/Windows/Fonts") / _fn
        if _fp.exists():
            _CN_FONT = str(_fp)
            break


def _put_chinese_text(img, text, pos, font_size=16, color=(255, 255, 255)):
    """在 numpy 图像上绘制中文文字"""
    if _CN_FONT is None:
        cv2.putText(img, text, pos, cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        return
    x, y = pos
    pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(pil_img)
    try:
        font = ImageFont.truetype(_CN_FONT, font_size)
    except Exception:
        font = ImageFont.load_default()
    draw.text((x, max(0, y - font_size + 2)), text, font=font, fill=(color[2], color[1], color[0]))
    cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR, dst=img)


class StreamManager:
    """视频流管理器"""
    
    def __init__(self, max_queue_size: int = 5, alarm_callback=None):
        """
        初始化管理器
        
        Args:
            max_queue_size: 每路流的最大帧队列大小
        """
        self.max_queue_size = max_queue_size
        
        # 流存储
        self._streams: Dict[int, 'VideoStream'] = {}
        self._lock = threading.Lock()
        self._alarm_callback = alarm_callback

    def set_alarm_callback(self, alarm_callback):
        """设置违规报警回调。"""
        self._alarm_callback = alarm_callback
        with self._lock:
            for stream in self._streams.values():
                stream.alarm_callback = alarm_callback
    
    def add_stream(
        self,
        camera_id: int,
        rtsp_url: str,
        location: str = ""
    ) -> bool:
        """
        添加视频流
        
        Args:
            camera_id: 摄像头 ID
            rtsp_url: RTSP URL
            location: 位置描述
        
        Returns:
            是否成功
        """
        old_stream = None
        with self._lock:
            old_stream = self._streams.pop(camera_id, None)
            stream = VideoStream(
                camera_id=camera_id,
                rtsp_url=rtsp_url,
                location=location,
                max_queue_size=self.max_queue_size,
                alarm_callback=self._alarm_callback,
            )
            
            self._streams[camera_id] = stream
        if old_stream:
            old_stream.release()
        return True
    
    def remove_stream(self, camera_id: int):
        """移除视频流"""
        with self._lock:
            stream = self._streams.get(camera_id)
            if stream:
                stream.release()
                del self._streams[camera_id]
    
    def has_stream(self, camera_id: int) -> bool:
        """是否存在流"""
        with self._lock:
            return camera_id in self._streams
    
    def get_stream_info(self, camera_id: int) -> Optional[Dict]:
        """获取流信息"""
        with self._lock:
            stream = self._streams.get(camera_id)
            if not stream:
                return None
            
            return stream.get_info()
    
    def get_stream_count(self) -> int:
        """获取流数量"""
        with self._lock:
            return len(self._streams)
    
    def start_stream(
        self,
        camera_id: int,
        detector,
        tracker,
        behavior_service=None,
    ) -> bool:
        """启动流处理"""
        with self._lock:
            stream = self._streams.get(camera_id)
            if not stream:
                return False
            
            return stream.start(detector, tracker, behavior_service)
    
    def stop_stream(self, camera_id: int):
        """停止流处理并释放摄像头"""
        with self._lock:
            stream = self._streams.get(camera_id)
            if stream:
                stream.stop()
                stream.release()
    
    def get_frame(self, camera_id: int) -> Optional[np.ndarray]:
        """获取最新帧"""
        with self._lock:
            stream = self._streams.get(camera_id)
            if not stream:
                return None
            
            return stream.get_frame()
    
    def get_result_frame(self, camera_id: int) -> Optional[np.ndarray]:
        """获取带检测结果的帧"""
        with self._lock:
            stream = self._streams.get(camera_id)
            if not stream:
                return None
            
            return stream.get_result_frame()
    
    def get_recognition_frames(self, camera_id: int) -> List[np.ndarray]:
        """获取用于人脸识别的最近多帧"""
        with self._lock:
            stream = self._streams.get(camera_id)
            if not stream:
                return []
            return stream.get_recognition_frames()
    
    def add_client(self, camera_id: int, websocket):
        """添加 Websocket 客户端"""
        with self._lock:
            stream = self._streams.get(camera_id)
            if stream:
                stream.add_client(websocket)
    
    def remove_client(self, camera_id: int, websocket):
        """移除 Websocket 客户端"""
        with self._lock:
            stream = self._streams.get(camera_id)
            if stream:
                stream.remove_client(websocket)
    
    def release_all(self):
        """释放所有流"""
        with self._lock:
            for stream in self._streams.values():
                stream.release()
            self._streams.clear()


class VideoStream:
    """视频流"""
    
    def __init__(
        self,
        camera_id: int,
        rtsp_url: str,
        location: str,
        max_queue_size: int = 5,
        alarm_callback=None,
    ):
        self.camera_id = camera_id
        self.rtsp_url = rtsp_url
        self.location = location
        self.alarm_callback = alarm_callback
        
        # OpenCV 捕获
        self._cap: Optional[cv2.VideoCapture] = None
        
        # 帧队列
        self._frame_queue: queue.Queue = queue.Queue(maxsize=max_queue_size)
        self._result_frame_queue: queue.Queue = queue.Queue(maxsize=max_queue_size)
        self._latest_result_frame: Optional[bytes] = None
        
        # 状态
        self._is_running = False
        self._is_started = False
        
        # 线程
        self._capture_thread: Optional[threading.Thread] = None
        self._process_thread: Optional[threading.Thread] = None
        
        # 检测器和追踪器
        self._detector = None
        self._tracker = None
        self._behavior_service = None
        
        # 客户端
        self._clients: List = []
        self._clients_lock = threading.Lock()
        
        # FPS 计算
        self._fps = 0
        self._frame_count = 0
        self._last_fps_time = time.time()
        
        # 视频信息
        self._width = 0
        self._height = 0
        self._fps_raw = 0
        self._event_buffer = deque(maxlen=60)
        self._event_lock = threading.Lock()
        self._event_recording = False
        self._last_event_buffer_at = 0.0
        self._recognition_buffer: deque = deque(maxlen=5)
    
    def open(self) -> bool:
        """打开视频流 - USB摄像头自动尝试多后端"""
        try:
            if self._cap is not None:
                self._cap.release()
                self._cap = None
            source = self.rtsp_url
            is_usb = isinstance(source, str) and source.startswith("usb://")
            if is_usb:
                source = int(source.removeprefix("usb://"))

            if is_usb and _IS_WINDOWS:
                # USB摄像头：依次尝试 DirectShow → MSMF → 默认
                for backend in (cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY):
                    try:
                        cap = cv2.VideoCapture(source, backend)
                        if cap.isOpened():
                            ret, frame = cap.read()
                            if ret and frame is not None and frame.size > 0:
                                self._cap = cap
                                backend_name = {cv2.CAP_DSHOW: "DirectShow", cv2.CAP_MSMF: "MSMF", cv2.CAP_ANY: "Default"}.get(backend, "Unknown")
                                print(f"[Stream] USB摄像头 #{source} 使用 {backend_name} 后端打开成功")
                                break
                            cap.release()
                    except Exception:
                        continue
            else:
                self._cap = cv2.VideoCapture(source)

            if not self._cap or not self._cap.isOpened():
                print(f"无法打开视频流: {self.rtsp_url}")
                return False
            
            # 获取视频信息
            self._width = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            self._height = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            self._fps_raw = int(self._cap.get(cv2.CAP_PROP_FPS))
            
            return True
            
        except Exception as e:
            print(f"打开视频流失败: {e}")
            return False
    
    def start(self, detector, tracker, behavior_service=None) -> bool:
        """启动流处理"""
        if self._is_started:
            return True
        
        self._detector = detector
        self._tracker = tracker
        self._behavior_service = behavior_service
        
        # 尝试打开
        if self._cap is None or not self._cap.isOpened():
            if not self.open():
                return False
        
        self._is_running = True
        self._is_started = True
        
        # 启动捕获线程
        self._capture_thread = threading.Thread(
            target=self._capture_loop,
            daemon=True
        )
        self._capture_thread.start()
        
        # 启动处理线程
        self._process_thread = threading.Thread(
            target=self._process_loop,
            daemon=True
        )
        self._process_thread.start()
        
        return True
    
    def stop(self):
        """停止流处理"""
        self._is_running = False
        self._is_started = False
        
        if self._capture_thread:
            self._capture_thread.join(timeout=2)
        
        if self._process_thread:
            self._process_thread.join(timeout=2)
    
    def release(self):
        """释放资源"""
        self.stop()
        
        if self._cap:
            self._cap.release()
            self._cap = None
    
    def _capture_loop(self):
        """捕获循环（带指数退避重连）"""
        reconnect_delay = 1.0
        max_delay = 30.0
        
        while self._is_running:
            if not self._cap or not self._cap.isOpened():
                if not self.open():
                    time.sleep(min(reconnect_delay, max_delay))
                    reconnect_delay = min(reconnect_delay * 2, max_delay)
                    continue
                reconnect_delay = 1.0
            
            ret, frame = self._cap.read()
            
            if not ret:
                self._cap.release()
                self._cap = None
                time.sleep(min(reconnect_delay, max_delay))
                reconnect_delay = min(reconnect_delay * 2, max_delay)
                continue
            
            reconnect_delay = 1.0

            now = time.time()
            if now - self._last_event_buffer_at >= 0.1:
                ok, event_jpeg = cv2.imencode(
                    ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75]
                )
                if ok:
                    with self._event_lock:
                        self._event_buffer.append((now, event_jpeg.tobytes()))
                    self._last_event_buffer_at = now
            
            # 放入队列 (丢弃旧帧)
            try:
                if self._frame_queue.full():
                    try:
                        self._frame_queue.get_nowait()
                    except queue.Empty:
                        pass
                self._frame_queue.put_nowait(frame)
            except queue.Full:
                pass
            
            # FPS 计算
            self._frame_count += 1
            current_time = time.time()
            if current_time - self._last_fps_time >= 1.0:
                self._fps = self._frame_count
                self._frame_count = 0
                self._last_fps_time = current_time
    
    def _process_loop(self):
        """处理循环"""
        while self._is_running:
            try:
                frame = self._frame_queue.get(timeout=1)
            except queue.Empty:
                continue
            
            if self._detector is None and self._behavior_service is None:
                # 无检测器，直接传递帧
                self._push_result_frame(frame)
                continue
            
            # 检测
            try:
                self._recognition_buffer.append(frame.copy())
                
                ppe_detections = []
                if self._detector is not None and self._detector.is_loaded():
                    ppe_detections = self._detector.detect(frame)

                behavior_result = {
                    "detections": [],
                    "violations": [],
                    "events": [],
                }
                if self._behavior_service is not None:
                    behavior_result = self._behavior_service.detect(
                        frame,
                        self.camera_id,
                    )

                detections = (
                    ppe_detections + behavior_result["detections"]
                )
                
                # 追踪
                try:
                    if self._tracker:
                        tracks = self._tracker.update(ppe_detections, frame)
                    else:
                        tracks = ppe_detections
                except Exception as e:
                    print(f"追踪失败，使用简单检测: {e}")
                    tracks = detections
                
                # 绘制结果（原地绘制，避免每帧复制）
                self._draw_results(frame, detections, tracks)
                self._push_result_frame(frame)
                
                # 检查违规
                violations = list(behavior_result["violations"])
                if self._detector is not None and self._detector.is_loaded():
                    violations.extend(
                        self._detector.check_violation(
                            ppe_detections,
                            [t for t in tracks if t.get('class_id') == 0],
                        )
                    )
                
                if violations:
                    alarm_frame = frame.copy()
                    self._trigger_alarm(violations, alarm_frame)
            
            except Exception as e:
                print(f"处理帧失败: {e}")
                self._push_result_frame(frame)
    
    def _draw_results(
        self,
        frame: np.ndarray,
        detections: List[Dict],
        tracks: List[Dict]
    ) -> np.ndarray:
        """绘制检测结果（原地绘制避免每帧复制）"""
        colors = {
            'person': (0, 255, 0),
            'helmet': (255, 255, 0),
            'safety_vest': (255, 165, 0),
            'workwear': (128, 0, 128),
            'reflection': (0, 180, 0),
            'clothes': (0, 0, 255),
            'smoking': (0, 0, 255),
            'sleep': (0, 0, 255),
        }
        
        for det in detections:
            bbox = det['bbox']
            class_name = det['class_name']
            confidence = det['confidence']
            x1, y1, x2, y2 = map(int, bbox)
            color = (
                (0, 0, 255)
                if det.get("violation")
                else colors.get(class_name, (255, 255, 255))
            )
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            label = f"{det.get('display_name', class_name)}: {confidence:.2f}"
            _put_chinese_text(frame, label, (x1, y1 - 5), font_size=14, color=color)
        
        for track in tracks:
            if track.get('track_id') is None:
                continue
            bbox = track['bbox']
            track_id = track['track_id']
            x1, y1, x2, y2 = map(int, bbox)
            cv2.circle(frame, (x1 + 10, y1 + 10), 5, (0, 255, 255), -1)
            _put_chinese_text(frame, f"ID:{track_id}", (x1 + 20, y1 + 15), font_size=13, color=(0, 255, 255))
        
        _put_chinese_text(frame, f"FPS: {self._fps}", (10, 30), font_size=20, color=(0, 255, 255))
        
        return frame
    
    def _push_result_frame(self, frame: np.ndarray):
        """推送结果帧"""
        try:
            if self._result_frame_queue.full():
                try:
                    self._result_frame_queue.get_nowait()
                except queue.Empty:
                    pass
            
            # JPEG 编码
            _, encoded = cv2.imencode('.jpg', frame, 
                                   [cv2.IMWRITE_JPEG_QUALITY, 85])
            encoded_bytes = encoded.tobytes()
            self._latest_result_frame = encoded_bytes
            self._result_frame_queue.put_nowait(encoded_bytes)
            
            # 推送给客户端
            self._broadcast_frame(encoded_bytes)
            
        except Exception as e:
            print(f"推送帧失败: {e}")
    
    def _broadcast_frame(self, frame_data: bytes):
        """广播帧给 WebSocket 客户端（线程安全）"""
        with self._clients_lock:
            clients = self._clients.copy()
        
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = None
        
        if not loop or not loop.is_running():
            return
        
        for client in clients:
            try:
                asyncio.run_coroutine_threadsafe(client.send_bytes(frame_data), loop)
            except Exception:
                pass
    
    def _trigger_alarm(self, violations: List[Dict], frame: np.ndarray):
        """触发报警"""
        if not self.alarm_callback:
            return
        with self._event_lock:
            if self._event_recording:
                return
            self._event_recording = True
        threading.Thread(
            target=self._complete_event_recording,
            args=(list(violations), frame.copy(), time.time()),
            daemon=True,
        ).start()

    def _complete_event_recording(
        self,
        violations: List[Dict],
        event_frame: np.ndarray,
        event_at: float,
    ):
        video_path = ""
        try:
            time.sleep(2.1)
            with self._event_lock:
                samples = [
                    data for captured_at, data in self._event_buffer
                    if event_at - 2.0 <= captured_at <= event_at + 2.0
                ]
            if samples:
                first = cv2.imdecode(
                    np.frombuffer(samples[0], np.uint8), cv2.IMREAD_COLOR
                )
                if first is not None:
                    evidence_dir = Path("data/alarm_videos")
                    evidence_dir.mkdir(parents=True, exist_ok=True)
                    path = evidence_dir / f"camera_{self.camera_id}_{int(event_at * 1000)}.mp4"
                    raw_path = evidence_dir / f"camera_{self.camera_id}_{int(event_at * 1000)}_raw.mp4"
                    height, width = first.shape[:2]
                    writer = cv2.VideoWriter(
                        str(raw_path), cv2.VideoWriter_fourcc(*"mp4v"), 10.0,
                        (width, height),
                    )
                    if writer.isOpened():
                        for encoded in samples:
                            decoded = cv2.imdecode(
                                np.frombuffer(encoded, np.uint8), cv2.IMREAD_COLOR
                            )
                            if decoded is not None:
                                if decoded.shape[1] != width or decoded.shape[0] != height:
                                    decoded = cv2.resize(decoded, (width, height))
                                writer.write(decoded)
                        writer.release()
                        if self._convert_to_browser_mp4(raw_path, path):
                            raw_path.unlink(missing_ok=True)
                            video_path = str(path)
                        else:
                            video_path = str(raw_path)
                    else:
                        writer.release()
        except Exception as e:
            print(f"完成事件录像失败: {e}")
        finally:
            try:
                self.alarm_callback(
                    camera_id=self.camera_id,
                    location=self.location,
                    violations=violations,
                    frame=event_frame,
                    video_path=video_path,
                )
            except Exception as e:
                print(f"触发流报警失败: {e}")
            with self._event_lock:
                self._event_recording = False

    def _convert_to_browser_mp4(self, source: Path, target: Path) -> bool:
        """转成浏览器兼容的 H.264 MP4。OpenCV 的 mp4v 在浏览器中经常无法播放。"""
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            try:
                import imageio_ffmpeg
                ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
            except Exception:
                pass
        if not ffmpeg or not source.exists():
            return False
        tmp_target = target.with_suffix(".tmp.mp4")
        tmp_target.unlink(missing_ok=True)
        try:
            result = subprocess.run(
                [
                    ffmpeg,
                    "-y",
                    "-i",
                    str(source),
                    "-an",
                    "-c:v",
                    "libx264",
                    "-preset",
                    "veryfast",
                    "-pix_fmt",
                    "yuv420p",
                    "-movflags",
                    "+faststart",
                    str(tmp_target),
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                text=True,
                timeout=20,
            )
            if result.returncode != 0 or not tmp_target.exists() or tmp_target.stat().st_size == 0:
                print(f"事件视频转码失败: {result.stderr[-500:] if result.stderr else 'ffmpeg failed'}")
                tmp_target.unlink(missing_ok=True)
                return False
            tmp_target.replace(target)
            return True
        except Exception as e:
            print(f"事件视频转码异常: {e}")
            tmp_target.unlink(missing_ok=True)
            return False
    
    def get_frame(self) -> Optional[np.ndarray]:
        """获取原始帧"""
        try:
            return self._frame_queue.get_nowait()
        except queue.Empty:
            return None
    
    def get_recognition_frames(self) -> List[np.ndarray]:
        """获取用于人脸识别的最近多帧"""
        return list(self._recognition_buffer)
    
    def get_result_frame(self) -> Optional[bytes]:
        """获取结果帧 (JPEG 编码)"""
        return self._latest_result_frame
    
    def get_info(self) -> Dict:
        """获取流信息"""
        return {
            'camera_id': self.camera_id,
            'location': self.location,
            'rtsp_url': self.rtsp_url,
            'width': self._width,
            'height': self._height,
            'fps': self._fps_raw,
            'is_running': self._is_running,
            'fps_current': self._fps,
        }
    
    def add_client(self, websocket):
        """添加客户端"""
        with self._clients_lock:
            if websocket not in self._clients:
                self._clients.append(websocket)
    
    def remove_client(self, websocket):
        """移除客户端"""
        with self._clients_lock:
            if websocket in self._clients:
                self._clients.remove(websocket)


def create_stream_manager(**kwargs) -> StreamManager:
    """创建流管理器"""
    return StreamManager(**kwargs)
