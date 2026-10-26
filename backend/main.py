"""
工业视觉行为检测系统 - 主程序
基于 YOLOv8 + FastAPI + WebSocket
"""

import asyncio
import os
import sys
import base64
import time
import threading
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict

import numpy as np
import cv2
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 添加项目根目录到路径
FILE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(FILE_DIR))

# 人脸数据库路径
FACE_DB_DIR = FILE_DIR / "data" / "face_database"

# 导入后端模块
from backend.detector import create_detector
from backend.tracker import create_tracker
from backend.stream_manager import create_stream_manager
from backend.alarm import create_alarm_manager
from backend.database import create_database
from backend.face_recognizer import create_face_recognizer
from backend.behavior_service import create_behavior_service
from backend.camera_resource_manager import create_camera_resource_manager


# ============================================
# 全局状态
# ============================================
class AppState:
    """应用状态"""
    
    def __init__(self):
        self.detector = None
        self.tracker = None
        self.stream_manager = None
        self.alarm_manager = None
        self.database = None
        self.face_recognizer = None
        self.behavior_service = None
        self.camera_resource_manager = None
        self.is_running = False
        self._detection_tasks: Dict[str, asyncio.Task] = {}


state = AppState()


# ============================================
# 公共工具函数
# ============================================
def _require_user(request: Request, roles: Optional[set[str]] = None) -> Dict:
    if not state.database:
        raise HTTPException(status_code=503, detail="数据库未连接")
    authorization = request.headers.get("authorization", "")
    token = authorization.removeprefix("Bearer ").strip() or request.cookies.get(
        "industrial_vision_token", ""
    )
    user = state.database.get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="请先登录")
    if roles and user.get("role") not in roles:
        raise HTTPException(status_code=403, detail="无权执行该操作")
    return user


def _decode_base64_image(image_data: str):
    if not image_data:
        return None
    if image_data.startswith("data:image"):
        image_data = image_data.split(",", 1)[-1]
    try:
        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception:
        return None


def _crop_violation_region(image: np.ndarray, violation: Optional[Dict] = None) -> np.ndarray:
    """按违规人员框裁剪识别区域"""
    if image is None or not violation:
        return image
    bbox = (
        violation.get("person_bbox")
        or violation.get("bbox")
        or violation.get("person", {}).get("bbox")
    )
    if not bbox or len(bbox) != 4:
        return image
    h, w = image.shape[:2]
    x1, y1, x2, y2 = [int(float(v)) for v in bbox]
    margin_x = int(max(1, x2 - x1) * 0.3)
    margin_y = int(max(1, y2 - y1) * 0.2)
    x1, y1 = max(0, x1 - margin_x), max(0, y1 - margin_y)
    x2, y2 = min(w, x2 + margin_x), min(h, y2 + margin_y)
    if x2 <= x1 or y2 <= y1:
        return image
    return image[y1:y2, x1:x2]


def _recognize_employee_from_image(
    image: np.ndarray,
    violation: Optional[Dict] = None,
):
    """识别图像中的在职员工"""
    if image is None or not state.face_recognizer or not state.database:
        return None, None, None, None
    try:
        target = _crop_violation_region(image, violation)
        emp_number, similarity, info = state.face_recognizer.recognize_face(target)
        if not emp_number:
            return None, None, None, None
        employee = state.database.get_employee_by_number(emp_number)
        if not employee or employee.get("status", "active") != "active":
            return None, emp_number, None, similarity
        employee_name = (employee.get("name") or (info or {}).get("name") or emp_number)
        return employee.get("id"), emp_number, employee_name, similarity
    except Exception as exc:
        print(f"[人脸识别] 识别失败: {exc}")
        return None, None, None, None


def _refresh_employee_face(employee: Dict):
    """根据员工状态和照片刷新内存人脸库"""
    if not state.face_recognizer or not employee:
        return False
    emp_number = str(employee.get("employee_number", "")).strip()
    if not emp_number:
        return False
    if employee.get("status", "active") != "active":
        state.face_recognizer.unregister_employee(emp_number)
        return False
    photo_path = employee.get("face_photo_path") or ""
    if not photo_path:
        state.face_recognizer.unregister_employee(emp_number)
        return False
    emp_dir = Path(photo_path)
    if not emp_dir.is_dir():
        if emp_dir.exists():
            img = cv2.imread(str(emp_dir))
            if img is not None:
                info = {
                    "id": employee.get("id"), "name": employee.get("name", ""),
                    "employee_number": emp_number, "department": employee.get("department", ""),
                    "position": employee.get("position", ""),
                }
                return state.face_recognizer.register_employee(emp_number, img, info)
        state.face_recognizer.unregister_employee(emp_number)
        return False
    state.face_recognizer._load_employee_features(emp_number)
    info = {
        "id": employee.get("id"), "name": employee.get("name", ""),
        "employee_number": emp_number, "department": employee.get("department", ""),
        "position": employee.get("position", ""),
    }
    with state.face_recognizer._lock:
        state.face_recognizer._employee_info[emp_number] = info
    feature_count = len(state.face_recognizer._face_db.get(emp_number, []))
    print(f"[员工管理] 员工 {emp_number} 加载 {feature_count} 张人脸特征")
    return feature_count > 0


def apply_config():
    """从数据库读取配置并应用到各模块"""
    if not state.database:
        return
    try:
        config_keys = [
            'conf_threshold', 'iou_threshold', 'max_tracks',
            'face_rec_threshold', 'min_face_size',
            'alarm_cooldown',
        ]
        config = {}
        for key in config_keys:
            val = state.database.get_config(key)
            if val is not None:
                config[key] = val

        if state.detector and state.detector.is_loaded():
            if 'conf_threshold' in config:
                state.detector.conf_threshold = float(config['conf_threshold'])
            if 'iou_threshold' in config:
                state.detector.iou_threshold = float(config['iou_threshold'])
            print(f"[配置] 检测器已更新: conf={state.detector.conf_threshold}, iou={state.detector.iou_threshold}")

        if state.face_recognizer:
            if 'face_rec_threshold' in config:
                state.face_recognizer.recognition_threshold = float(config['face_rec_threshold'])
            if 'min_face_size' in config:
                min_sz = int(config['min_face_size'])
                state.face_recognizer._detect_faces = _make_detect_with_min_size(state.face_recognizer, min_sz)
            print(f"[配置] 人脸识别已更新: threshold={state.face_recognizer.recognition_threshold}")

        if state.alarm_manager:
            if 'alarm_cooldown' in config:
                state.alarm_manager.cooldown = float(config['alarm_cooldown'])
            print(f"[配置] 报警管理已更新: cooldown={state.alarm_manager.cooldown}s")

    except Exception as e:
        print(f"[配置] 应用配置失败: {e}")


def _make_detect_with_min_size(recognizer, min_size):
    """创建带最小人脸尺寸过滤的检测函数"""
    import numpy as np
    original_detect = recognizer._detect_faces.__func__ if hasattr(recognizer._detect_faces, '__func__') else None

    def filtered_detect(image):
        if image is None or image.size == 0 or image.ndim != 3:
            return np.empty((0, 15), dtype=np.float32)
        height, width = image.shape[:2]
        if width < 20 or height < 20:
            return np.empty((0, 15), dtype=np.float32)
        enhanced = recognizer._preprocess_image(image)
        with recognizer._lock:
            recognizer.detector.setInputSize((width, height))
            _, faces = recognizer.detector.detect(enhanced)
        if faces is None:
            return np.empty((0, 15), dtype=np.float32)
        valid = [f for f in faces if float(f[2]) >= min_size and float(f[3]) >= min_size]
        return np.array(valid, dtype=np.float32) if valid else np.empty((0, 15), dtype=np.float32)

    return filtered_detect


def cleanup_resources():
    """清理过期报警记录和关联的图片/视频文件"""
    if not state.database:
        return
    try:
        retention = 90
        val = state.database.get_config('data_retention_days')
        if val:
            retention = int(val)
        state.database.cleanup_old_records(retention)
    except Exception as e:
        print(f"[清理] 数据库清理失败: {e}")

    for folder in ['data/alarm_images', 'data/alarm_videos']:
        try:
            d = Path(folder)
            if not d.is_dir():
                continue
            cutoff = time.time() - (retention * 86400)
            for f in d.iterdir():
                if f.is_file() and f.stat().st_mtime < cutoff:
                    f.unlink(missing_ok=True)
        except Exception as e:
            print(f"[清理] 文件清理失败 {folder}: {e}")


_cleanup_stop = threading.Event()


def _cleanup_loop():
    """后台清理线程，每小时执行一次"""
    while not _cleanup_stop.is_set():
        _cleanup_stop.wait(3600)
        if _cleanup_stop.is_set():
            break
        cleanup_resources()


def _handle_stream_alarm(camera_id, location, violations, frame, video_path=""):
    """把后台视频流中的违规事件写入报警记录"""
    if not violations or not state.database:
        return
    first = violations[0]
    alarm_type = first.get("violation_type")
    if not alarm_type:
        violation_types = first.get("violation_types") or []
        alarm_type = violation_types[0] if violation_types else "violation"
    track_id = first.get("track_id") or first.get("person_track_id")
    
    # 多帧融合识别：从流缓冲区取最近5帧进行投票
    employee_id, employee_number, employee_name, similarity = None, None, None, None
    if state.face_recognizer and state.stream_manager:
        frames = state.stream_manager.get_recognition_frames(camera_id)
        if len(frames) >= 2:
            emp_number, sim, info = state.face_recognizer.recognize_face_multi_frame(frames, min_votes=2)
            if emp_number:
                employee = state.database.get_employee_by_number(emp_number)
                if employee and employee.get("status", "active") == "active":
                    employee_id = employee.get("id")
                    employee_number = emp_number
                    employee_name = employee.get("name") or (info or {}).get("name") or emp_number
                    similarity = sim
    if employee_id is None:
        employee_id, employee_number, employee_name, similarity = _recognize_employee_from_image(frame, first)
    
    if state.alarm_manager:
        if not state.alarm_manager.should_alarm(alarm_type, camera_id, employee_id=employee_id, track_id=track_id):
            return
        if not state.alarm_manager.record_violation(alarm_type, camera_id, employee_id=employee_id, track_id=track_id):
            return
    camera = state.database.get_camera(camera_id) if state.database else None
    camera_name = (camera or {}).get("name", f"摄像头 {camera_id}")
    
    # 保存图片到文件（替代 base64 存入数据库）
    image_path = ""
    ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    if ok:
        alarm_img_dir = Path("data/alarm_images")
        alarm_img_dir.mkdir(parents=True, exist_ok=True)
        image_file = alarm_img_dir / f"alarm_{camera_id}_{int(time.time() * 1000)}.jpg"
        image_file.write_bytes(encoded.tobytes())
        image_path = str(image_file)
    
    state.database.add_alarm({
        "camera_id": camera_id, "camera_name": camera_name,
        "location": location or (camera or {}).get("location", ""),
        "alarm_type": "stream", "violation_type": alarm_type,
        "image_path": image_path, "employee_id": employee_id,
        "employee_name": employee_name or "", "person_track_id": track_id,
        "face_similarity": similarity, "video_path": video_path,
    })
    from backend.cache import get_alarms_cache, get_stats_cache
    get_alarms_cache().clear()
    get_stats_cache().clear()
    if state.alarm_manager:
        state.alarm_manager.trigger_alarm(
            alarm_type=alarm_type, camera_id=camera_id, camera_name=camera_name,
            image=frame, violations=violations,
        )


# ============================================
# FastAPI 应用
# ============================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    print("=" * 60)
    print("工业视觉行为检测系统启动中...")
    print("=" * 60)
    
    print("正在加载 YOLOv8 检测模型...")
    state.detector = create_detector()
    if state.detector and state.detector.is_loaded():
        print(f"YOLOv8 检测模型加载成功 (设备: {state.detector.device})")
    else:
        print("警告: YOLOv8 检测模型加载失败，将使用模拟模式")

    print("正在加载员工行为检测模型...")
    state.behavior_service = create_behavior_service()
    if state.behavior_service.loaded:
        enabled = ", ".join(state.behavior_service.enabled)
        print(f"员工行为检测模型加载成功: {enabled}")
    else:
        print(f"警告: 行为检测模型加载失败: {state.behavior_service.error}")
    
    print("正在初始化 ByteTrack 追踪器...")
    try:
        state.tracker = create_tracker()
    except Exception as e:
        print(f"ByteTrack 追踪器初始化失败: {e}")
        state.tracker = None
    
    state.stream_manager = create_stream_manager()
    state.alarm_manager = create_alarm_manager()
    state.camera_resource_manager = create_camera_resource_manager()
    
    print("正在连接数据库...")
    state.database = create_database()
    if state.database:
        state.database.ensure_admin_user(
            os.getenv("INITIAL_ADMIN_USERNAME", "admin"),
            os.getenv("INITIAL_ADMIN_PASSWORD", ""),
        )
        print("数据库连接成功")
    else:
        print("警告: 数据库连接失败")

    if state.stream_manager:
        state.stream_manager.set_alarm_callback(_handle_stream_alarm)
    
    print("正在初始化人脸识别...")
    state.face_recognizer = create_face_recognizer()
    if state.database and state.face_recognizer:
        loaded = state.face_recognizer.load_employees_from_folder(state.database)
        print(f"人脸识别器初始化成功，已加载 {loaded} 名员工人脸")
    
    # 应用数据库中的配置
    apply_config()
    
    # 启动后台清理线程
    cleanup_thread = threading.Thread(target=_cleanup_loop, daemon=True)
    cleanup_thread.start()
    
    if state.database:
        cameras = state.database.get_cameras()
        for cam in cameras:
            if cam.get('status') == 'online':
                state.stream_manager.add_stream(cam['id'], cam['rtsp_url'], cam.get('location', ''))
        print(f"已加载 {len(cameras)} 个摄像头配置")

        # 清理重复的 camera_index 记录（保留最早的一条）
        try:
            seen_indexes = {}
            for cam in cameras:
                idx = cam.get('camera_index')
                if idx is None:
                    continue
                if idx in seen_indexes:
                    state.database.delete_camera(cam['id'])
                    print(f"[清理] 删除重复摄像头 #{cam['id']} (camera_index={idx})")
                else:
                    seen_indexes[idx] = cam
        except Exception as e:
            print(f"清理重复摄像头失败: {e}")

        # 自动检测 USB 摄像头并添加到数据库
        try:
            cameras = state.database.get_cameras()
            from backend.camera import detect_usb_cameras
            usb_cams = detect_usb_cameras()
            existing_indexes = {cam['camera_index'] for cam in cameras}
            existing_rtsp = {cam['rtsp_url'] for cam in cameras}
            added = 0
            for usb in usb_cams:
                idx = usb.get('id', -1)
                usb_url = f"usb://{idx}"
                if idx in existing_indexes or usb_url in existing_rtsp:
                    continue
                db_camera = state.database.get_camera_by_index(idx)
                if db_camera:
                    continue
                state.database.add_camera({
                    'name': usb.get('name', f'USB Camera {idx}'),
                    'rtsp_url': usb_url,
                    'location': '本地 USB',
                    'status': 'offline',
                    'is_usb': True,
                    'camera_index': idx,
                    'device_id': usb.get('device_id', str(idx)),
                    'group_id': usb.get('group_id', f'camera_group_{idx}'),
                })
                added += 1
            if added:
                print(f"自动添加了 {added} 个 USB 摄像头")
            elif usb_cams:
                print(f"检测到 {len(usb_cams)} 个 USB 摄像头，均已存在于数据库")
            else:
                print("未检测到 USB 摄像头")
        except Exception as e:
            print(f"USB 摄像头自动检测失败: {e}")

    yield
    
    print("\n正在关闭系统...")
    for task in state._detection_tasks.values():
        task.cancel()
    if state.camera_resource_manager:
        state.camera_resource_manager.cleanup()
    if state.stream_manager:
        state.stream_manager.release_all()
    if state.database:
        state.database.close()
    print("系统已关闭")
    _cleanup_stop.set()


app = FastAPI(
    title="工业视觉行为检测系统",
    description="基于 YOLOv8 的工业视觉行为检测系统",
    version="1.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
from backend.routers import auth, cameras, alarms, employees, stats, model, detect, config, stream, usb_cameras, users, training, attendance, zones, handover, camera_manager

app.include_router(auth.router)
app.include_router(cameras.router)
app.include_router(alarms.router)
app.include_router(employees.router)
app.include_router(stats.router)
app.include_router(model.router)
app.include_router(detect.router)
app.include_router(config.router)
app.include_router(stream.router)
app.include_router(usb_cameras.router)
app.include_router(users.router)
app.include_router(training.router)
app.include_router(attendance.router)
app.include_router(zones.router)
app.include_router(handover.router)
app.include_router(camera_manager.router)


@app.get("/")
async def get_index():
    """后端服务状态"""
    return {
        "name": "工业视觉行为检测系统",
        "message": "后端服务运行中，前端请访问 http://localhost:3000",
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "ok",
        "detector": state.detector is not None and state.detector.is_loaded(),
        "behavior_detector": state.behavior_service is not None and state.behavior_service.loaded,
        "streams": state.stream_manager.get_stream_count() if state.stream_manager else 0,
        "cameras": len(state.database.get_cameras()) if state.database else 0,
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="工业视觉行为检测系统")
    parser.add_argument("--host", default="0.0.0.0", help="绑定地址")
    parser.add_argument("--port", type=int, default=8000, help="端口")
    parser.add_argument("--reload", action="store_true", help="自动重载")
    args = parser.parse_args()
    print(f"\n启动工业视觉行为检测系统: http://{args.host}:{args.port}")
    print("按 Ctrl+C 停止\n")
    uvicorn.run("backend.main:app", host=args.host, port=args.port, reload=args.reload, log_level="info")
