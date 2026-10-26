"""USB 摄像头路由"""

from fastapi import APIRouter, Request

from backend.camera import detect_usb_cameras

router = APIRouter(tags=["usb-cameras"])


def _get_state():
    from backend.main import state
    return state


@router.get("/api/usb-cameras")
async def get_usb_cameras():
    """检测并返回所有可用的 USB 摄像头"""
    try:
        cameras = detect_usb_cameras()
        return {"code": 200, "data": cameras}
    except Exception as e:
        return {"code": 500, "message": str(e)}


@router.post("/api/usb-cameras/use")
async def use_usb_camera(cam_info: dict, request: Request):
    """将 USB 摄像头添加到系统"""
    from backend.main import _require_user
    _require_user(request)
    try:
        db = _get_state().database
        if db:
            cam_idx = cam_info.get('camera_index') or cam_info.get('id', 0)
            existing = db.get_camera_by_index(cam_idx)
            if existing:
                return {"code": 200, "data": {"id": existing['id']}, "message": "摄像头已存在"}
            camera_id_db = db.add_camera({
                'name': cam_info.get('name', 'USB Camera'),
                'rtsp_url': f"usb://{cam_idx}",
                'location': cam_info.get('location', '本地 USB'),
                'status': cam_info.get('status', 'offline'),
                'is_usb': True,
                'camera_index': cam_idx,
                'device_id': cam_info.get('device_id', ''),
                'width': 1280, 'height': 720
            })
            return {"code": 200, "data": {"id": camera_id_db}}
        return {"code": 500, "message": "数据库未连接"}
    except Exception as e:
        return {"code": 500, "message": str(e)}


@router.post("/api/usb-cameras/{camera_index}/use")
async def use_usb_camera_by_index(camera_index: int, request: Request):
    """兼容旧前端路径"""
    cameras = detect_usb_cameras()
    cam_info = next((cam for cam in cameras if int(cam.get("id", -1)) == camera_index), None)
    if not cam_info:
        cam_info = {
            "name": f"USB Camera {camera_index}",
            "camera_index": camera_index,
            "device_id": str(camera_index),
            "status": "offline",
        }
    return await use_usb_camera(cam_info, request)
