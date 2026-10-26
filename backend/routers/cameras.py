"""摄像头管理路由"""

from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


def _get_state():
    from backend.main import state
    return state


@router.get("")
async def get_cameras(request: Request):
    """获取摄像头列表"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    return {"code": 200, "data": db.get_cameras()}


@router.post("")
async def add_camera(camera: dict, request: Request):
    """添加摄像头"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    camera_id = db.add_camera(camera)
    
    if camera.get('status') == 'online' and camera.get('rtsp_url'):
        _get_state().stream_manager.add_stream(
            camera_id, camera['rtsp_url'], camera.get('location', '')
        )
    
    return {"code": 200, "data": {"id": camera_id}}


@router.put("/{camera_id}")
async def update_camera(camera_id: int, camera: dict, request: Request):
    """更新摄像头"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    db.update_camera(camera_id, camera)
    
    if camera.get('rtsp_url'):
        sm = _get_state().stream_manager
        if camera.get('status') == 'online':
            sm.add_stream(camera_id, camera['rtsp_url'], camera.get('location', ''))
        else:
            sm.remove_stream(camera_id)
    
    return {"code": 200}


@router.delete("/{camera_id}")
async def delete_camera(camera_id: int, request: Request):
    """删除摄像头"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    _get_state().stream_manager.remove_stream(camera_id)
    db.delete_camera(camera_id)
    return {"code": 200}
