"""统计数据路由"""

from fastapi import APIRouter, Request

from backend.cache import get_stats_cache

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _get_state():
    from backend.main import state
    return state


@router.get("")
async def get_stats(request: Request, days: int = 7, start_date: str = "", end_date: str = ""):
    """获取统计数据"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    cache_key = f"stats:{days}:{start_date}:{end_date}"
    cached = get_stats_cache().get(cache_key)
    if cached is not None:
        return cached
    
    if start_date and end_date:
        try:
            from datetime import datetime
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            import time
            start_ts = start_dt.timestamp()
            end_ts = end_dt.timestamp()
            days = max(1, int((end_ts - start_ts) / 86400) + 1)
        except Exception:
            pass
    
    stats = db.get_stats(days)
    result = {"code": 200, "data": stats}
    get_stats_cache().set(cache_key, result)
    return result


@router.get("/daily")
async def get_daily_stats(days: int = 30):
    """获取每日统计数据"""
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    return {"code": 200, "data": db.get_daily_stats(days)}


@router.get("/camera/{camera_id}")
async def get_camera_stats(camera_id: int, days: int = 7):
    """获取指定摄像头的统计数据"""
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    return {"code": 200, "data": db.get_camera_stats(camera_id, days)}
