"""摄像头资源协调路由"""

from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/camera-manager", tags=["camera-manager"])


def _get_state():
    from backend.main import state
    return state


def _require_user(request: Request):
    from backend.main import _require_user
    return _require_user(request)


@router.get("/status")
async def get_camera_status(request: Request):
    """获取所有摄像头的资源分配状态"""
    _require_user(request)
    mgr = _get_state().camera_resource_manager
    if not mgr:
        return {"code": 500, "message": "摄像头资源管理器未初始化"}
    return {"code": 200, "data": mgr.get_camera_status()}


@router.post("/request")
async def request_camera(request: Request):
    """
    请求摄像头资源

    请求体:
    {
        "task_id": "face_checkin_001",
        "function": "attendance",    // safety/attendance/inspection/monitoring
        "camera_index": 0,
        "priority": 2,               // 1=安全检测 2=签到 3=巡检 4=监控
        "duration": 0                // 0=持续
    }
    """
    _require_user(request)
    mgr = _get_state().camera_resource_manager
    if not mgr:
        return {"code": 500, "message": "摄像头资源管理器未初始化"}

    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}

    task_id = data.get('task_id', '')
    function = data.get('function', 'monitoring')
    camera_index = data.get('camera_index', 0)
    priority = data.get('priority', 4)
    duration = data.get('duration', 0)

    if not task_id:
        return {"code": 400, "message": "task_id 不能为空"}

    result = mgr.request_camera(
        task_id=task_id,
        function=function,
        camera_index=camera_index,
        priority=priority,
        duration=duration,
    )

    if result['success']:
        return {"code": 200, "data": result}
    else:
        return {"code": 409, "message": result['message'], "data": result}


@router.post("/release")
async def release_camera(request: Request):
    """
    释放摄像头资源

    请求体:
    {
        "task_id": "face_checkin_001"
    }
    """
    _require_user(request)
    mgr = _get_state().camera_resource_manager
    if not mgr:
        return {"code": 500, "message": "摄像头资源管理器未初始化"}

    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}

    task_id = data.get('task_id', '')
    if not task_id:
        return {"code": 400, "message": "task_id 不能为空"}

    mgr.release_camera(task_id)
    return {"code": 200, "message": "已释放"}


@router.get("/frame/{camera_index}")
async def get_camera_frame(camera_index: int, request: Request):
    """获取指定摄像头的当前帧（用于签到拍照等临时场景）"""
    _require_user(request)
    mgr = _get_state().camera_resource_manager
    if not mgr:
        return {"code": 500, "message": "摄像头资源管理器未初始化"}

    frame = mgr.get_frame(camera_index)
    if frame is None:
        return {"code": 404, "message": "无法获取帧，摄像头可能未启动"}

    import cv2
    _, encoded = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    import base64
    return {"code": 200, "data": {
        "image": base64.b64encode(encoded.tobytes()).decode(),
        "width": frame.shape[1],
        "height": frame.shape[0],
    }}
