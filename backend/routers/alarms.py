"""报警记录路由"""

import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, Response

from backend.cache import get_alarms_cache, get_stats_cache

router = APIRouter(prefix="/api/alarms", tags=["alarms"])


def _get_state():
    from backend.main import state
    return state


def _clear_alarm_related_cache():
    get_alarms_cache().clear()
    get_stats_cache().clear()


def _base64_to_jpeg_response(image_data: str):
    import base64
    if not image_data:
        return None
    if image_data.startswith("data:image"):
        image_data = image_data.split(",", 1)[-1]
    try:
        return Response(
            content=base64.b64decode(image_data),
            media_type="image/jpeg",
        )
    except Exception:
        return None


@router.get("")
async def get_alarms(
    request: Request,
    camera_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0
):
    """获取报警记录"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    cache_key = f"alarms:{camera_id}:{limit}:{offset}"
    cached = get_alarms_cache().get(cache_key)
    if cached is not None:
        return cached
    
    alarms = db.get_alarms(camera_id, limit, offset)
    total = db.get_alarm_count(camera_id)
    result = {"code": 200, "data": alarms, "total": total}
    get_alarms_cache().set(cache_key, result)
    return result


@router.get("/{alarm_id}")
async def get_alarm(alarm_id: int, request: Request):
    """获取单条报警"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    alarm = db.get_alarm(alarm_id)
    if not alarm:
        return {"code": 404, "message": "报警记录不存在"}
    return {"code": 200, "data": alarm}


@router.put("/{alarm_id}/handle")
async def handle_alarm(alarm_id: int, request: Request):
    """处理报警"""
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    from backend.main import _require_user
    user = _require_user(request)
    try:
        data = await request.json()
    except Exception:
        data = {}
    result = str(data.get("result", "confirmed")).strip()
    if result not in {"confirmed", "false_positive", "corrected", "other"}:
        return {"code": 400, "message": "无效的处理结果"}
    db.handle_alarm(
        alarm_id, user["id"], user["username"], result,
        str(data.get("note", "")).strip()[:500],
    )
    _clear_alarm_related_cache()
    return {"code": 200}


@router.post("/{alarm_id}/handle")
async def handle_alarm_post(alarm_id: int, request: Request):
    """兼容旧前端的 POST 处理请求"""
    return await handle_alarm(alarm_id, request)


@router.delete("/{alarm_id}")
async def delete_alarm(alarm_id: int, request: Request):
    """删除报警记录"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}

    alarm = db.get_alarm(alarm_id)
    if not alarm:
        return {"code": 404, "message": "报警记录不存在"}

    video_path = Path(alarm.get("video_path", ""))
    if video_path.exists() and Path("data/alarm_videos").resolve() in video_path.resolve().parents:
        video_path.unlink(missing_ok=True)
    db.delete_alarm(alarm_id)
    _clear_alarm_related_cache()
    return {"code": 200}


@router.get("/{alarm_id}/image")
async def get_alarm_image(alarm_id: int, request: Request):
    """获取报警截图"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    alarm = db.get_alarm(alarm_id)
    if not alarm:
        return {"code": 404, "message": "报警记录不存在"}
    
    image_path = alarm.get('image_path', '')
    if not image_path:
        return {"code": 404, "message": "无截图"}
    
    if os.path.exists(image_path):
        return FileResponse(image_path, media_type='image/jpeg')

    response = _base64_to_jpeg_response(image_path)
    if response:
        return response
    
    return {"code": 404, "message": "截图文件不存在"}


@router.get("/{alarm_id}/video")
async def get_alarm_video(alarm_id: int, request: Request):
    """获取违规事件视频"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    alarm = db.get_alarm(alarm_id) if db else None
    if not alarm:
        raise HTTPException(status_code=404, detail="报警记录不存在")
    raw_video_path = str(alarm.get("video_path", "")).strip()
    if not raw_video_path:
        raise HTTPException(status_code=404, detail="该报警没有事件视频")
    video_path = Path(raw_video_path)
    if not video_path.is_file():
        raise HTTPException(status_code=404, detail="该报警没有事件视频")
    return FileResponse(
        video_path, media_type="video/mp4",
        filename=video_path.name, content_disposition_type="inline",
    )
