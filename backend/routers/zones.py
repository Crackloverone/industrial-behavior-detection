"""区域入侵检测路由"""

from typing import Optional
from fastapi import APIRouter, Request, Query

router = APIRouter(prefix="/api/zones", tags=["zones"])


def _get_state():
    from backend.main import state
    return state


def _require_user(request: Request):
    from backend.main import _require_user
    return _require_user(request)


# ============================================
# 区域管理
# ============================================
@router.get("")
async def get_zones(request: Request):
    """获取区域列表"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}

    try:
        zones = db.execute("SELECT * FROM zones ORDER BY id")
        return {"code": 200, "data": zones}
    except Exception as e:
        return {"code": 500, "message": f"获取区域失败: {str(e)}"}


@router.post("")
async def create_zone(request: Request):
    """创建区域"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}

    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}

    if not data.get('name'):
        return {"code": 400, "message": "区域名称不能为空"}

    try:
        results = db.execute("""
            INSERT INTO zones (name, description, zone_type, points, camera_id, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            data.get('name', ''),
            data.get('description', ''),
            data.get('zone_type', 'danger'),
            data.get('points', '[]'),
            data.get('camera_id'),
            data.get('is_active', 1)
        ))
        zone_id = results[0] if results else None
        return {"code": 200, "data": {"id": zone_id}}
    except Exception as e:
        return {"code": 500, "message": f"创建区域失败: {str(e)}"}


@router.put("/{zone_id}")
async def update_zone(zone_id: int, request: Request):
    """更新区域"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}

    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}

    try:
        updates = []
        params = []

        for key in ['name', 'description', 'zone_type', 'points', 'camera_id', 'is_active']:
            if key in data:
                updates.append(f"{key} = ?")
                params.append(data[key])

        if updates:
            params.append(zone_id)
            db.execute(f"""
                UPDATE zones
                SET {', '.join(updates)}, updated_at = strftime('%s', 'now')
                WHERE id = ?
            """, params)

        return {"code": 200}
    except Exception as e:
        return {"code": 500, "message": f"更新区域失败: {str(e)}"}


@router.delete("/{zone_id}")
async def delete_zone(zone_id: int, request: Request):
    """删除区域"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}

    try:
        db.execute("DELETE FROM zones WHERE id = ?", (zone_id,))
        return {"code": 200}
    except Exception as e:
        return {"code": 500, "message": f"删除区域失败: {str(e)}"}


@router.post("/{zone_id}/toggle")
async def toggle_zone(zone_id: int, request: Request):
    """切换区域启用状态"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}

    try:
        rows = db.execute("SELECT is_active FROM zones WHERE id = ?", (zone_id,))
        if not rows:
            return {"code": 404, "message": "区域不存在"}

        new_status = 0 if rows[0]['is_active'] else 1
        db.execute("UPDATE zones SET is_active = ? WHERE id = ?", (new_status, zone_id))
        return {"code": 200, "data": {"is_active": new_status}}
    except Exception as e:
        return {"code": 500, "message": f"切换区域状态失败: {str(e)}"}


# ============================================
# 区域告警记录
# ============================================
@router.get("/alerts")
async def get_zone_alerts(
    request: Request,
    zone_id: Optional[int] = Query(None),
    limit: int = Query(100)
):
    """获取区域告警记录"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}

    try:
        query = """
            SELECT za.*, z.name as zone_name, z.zone_type,
                   e.name as employee_name, e.employee_number
            FROM zone_alerts za
            LEFT JOIN zones z ON z.id = za.zone_id
            LEFT JOIN employees e ON e.id = za.employee_id
            WHERE 1=1
        """
        params = []

        if zone_id:
            query += " AND za.zone_id = ?"
            params.append(zone_id)

        query += " ORDER BY za.timestamp DESC LIMIT ?"
        params.append(limit)

        alerts = db.execute(query, params)
        return {"code": 200, "data": alerts}
    except Exception as e:
        return {"code": 500, "message": f"获取区域告警失败: {str(e)}"}


@router.delete("/alerts/{alert_id}")
async def delete_zone_alert(alert_id: int, request: Request):
    """删除区域告警记录"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}

    try:
        db.execute("DELETE FROM zone_alerts WHERE id = ?", (alert_id,))
        return {"code": 200}
    except Exception as e:
        return {"code": 500, "message": f"删除区域告警失败: {str(e)}"}
