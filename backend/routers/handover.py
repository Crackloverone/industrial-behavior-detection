"""交接班管理路由"""

from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Request, Query

router = APIRouter(prefix="/api/handover", tags=["handover"])


def _get_state():
    from backend.main import state
    return state


def _require_user(request: Request):
    from backend.main import _require_user
    return _require_user(request)


# ============================================
# 交接班记录
# ============================================
@router.get("/records")
async def get_handover_records(
    request: Request,
    employee_id: Optional[int] = Query(None),
    shift: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(100)
):
    """获取交接班记录"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}

    try:
        query = """
            SELECT hr.*,
                   e1.name as outgoing_employee_name, e1.employee_number as outgoing_employee_number,
                   e2.name as incoming_employee_name, e2.employee_number as incoming_employee_number
            FROM handover_records hr
            LEFT JOIN employees e1 ON e1.id = hr.outgoing_employee_id
            LEFT JOIN employees e2 ON e2.id = hr.incoming_employee_id
            WHERE 1=1
        """
        params = []

        if employee_id:
            query += " AND (hr.outgoing_employee_id = ? OR hr.incoming_employee_id = ?)"
            params.extend([employee_id, employee_id])

        if shift:
            query += " AND hr.shift = ?"
            params.append(shift)

        if start_date:
            query += " AND DATE(hr.handover_time, 'unixepoch') >= ?"
            params.append(start_date)

        if end_date:
            query += " AND DATE(hr.handover_time, 'unixepoch') <= ?"
            params.append(end_date)

        query += " ORDER BY hr.handover_time DESC LIMIT ?"
        params.append(limit)

        records = db.execute(query, params)
        return {"code": 200, "data": records}
    except Exception as e:
        return {"code": 500, "message": f"获取交接班记录失败: {str(e)}"}


@router.post("/records")
async def create_handover_record(request: Request):
    """创建交接班记录"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}

    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}

    if not data.get('outgoing_employee_id') or not data.get('incoming_employee_id'):
        return {"code": 400, "message": "交班人和接班人不能为空"}

    if data.get('outgoing_employee_id') == data.get('incoming_employee_id'):
        return {"code": 400, "message": "交班人和接班人不能是同一人"}

    try:
        results = db.execute("""
            INSERT INTO handover_records (outgoing_employee_id, incoming_employee_id,
                shift, handover_time, equipment_status, safety_notes, production_notes, other_notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get('outgoing_employee_id'),
            data.get('incoming_employee_id'),
            data.get('shift', 'day'),
            datetime.now().timestamp(),
            data.get('equipment_status', ''),
            data.get('safety_notes', ''),
            data.get('production_notes', ''),
            data.get('other_notes', '')
        ))
        record_id = results[0] if results else None
        return {"code": 200, "data": {"id": record_id}}
    except Exception as e:
        return {"code": 500, "message": f"创建交接班记录失败: {str(e)}"}


@router.put("/records/{record_id}")
async def update_handover_record(record_id: int, request: Request):
    """更新交接班记录"""
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

        for key in ['equipment_status', 'safety_notes', 'production_notes', 'other_notes']:
            if key in data:
                updates.append(f"{key} = ?")
                params.append(data[key])

        if updates:
            params.append(record_id)
            db.execute(f"""
                UPDATE handover_records
                SET {', '.join(updates)}
                WHERE id = ?
            """, params)

        return {"code": 200}
    except Exception as e:
        return {"code": 500, "message": f"更新交接班记录失败: {str(e)}"}


@router.delete("/records/{record_id}")
async def delete_handover_record(record_id: int, request: Request):
    """删除交接班记录"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}

    try:
        db.execute("DELETE FROM handover_records WHERE id = ?", (record_id,))
        return {"code": 200}
    except Exception as e:
        return {"code": 500, "message": f"删除交接班记录失败: {str(e)}"}


@router.get("/records/{record_id}")
async def get_handover_record(record_id: int, request: Request):
    """获取单条交接班记录"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}

    try:
        rows = db.execute("""
            SELECT hr.*,
                   e1.name as outgoing_employee_name, e1.employee_number as outgoing_employee_number,
                   e2.name as incoming_employee_name, e2.employee_number as incoming_employee_number
            FROM handover_records hr
            LEFT JOIN employees e1 ON e1.id = hr.outgoing_employee_id
            LEFT JOIN employees e2 ON e2.id = hr.incoming_employee_id
            WHERE hr.id = ?
        """, (record_id,))
        if not rows:
            return {"code": 404, "message": "交接班记录不存在"}
        return {"code": 200, "data": rows[0]}
    except Exception as e:
        return {"code": 500, "message": f"获取交接班记录失败: {str(e)}"}


# ============================================
# 交接班统计
# ============================================
@router.get("/statistics")
async def get_handover_statistics(
    request: Request,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    """获取交接班统计"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}

    try:
        # 获取总记录数
        query = "SELECT COUNT(*) as cnt FROM handover_records WHERE 1=1"
        params = []

        if start_date:
            query += " AND DATE(handover_time, 'unixepoch') >= ?"
            params.append(start_date)

        if end_date:
            query += " AND DATE(handover_time, 'unixepoch') <= ?"
            params.append(end_date)

        total_result = db.execute(query, params)
        total_records = total_result[0]['cnt'] if total_result else 0

        # 按班次统计
        shift_query = """
            SELECT shift, COUNT(*) as count
            FROM handover_records
            WHERE 1=1
        """
        shift_params = []

        if start_date:
            shift_query += " AND DATE(handover_time, 'unixepoch') >= ?"
            shift_params.append(start_date)

        if end_date:
            shift_query += " AND DATE(handover_time, 'unixepoch') <= ?"
            shift_params.append(end_date)

        shift_query += " GROUP BY shift"
        shift_rows = db.execute(shift_query, shift_params)
        by_shift = {row['shift']: row['count'] for row in shift_rows}

        # 按员工统计
        employee_query = """
            SELECT e.name, e.employee_number, COUNT(*) as count
            FROM handover_records hr
            LEFT JOIN employees e ON e.id = hr.outgoing_employee_id
            WHERE 1=1
        """
        employee_params = []

        if start_date:
            employee_query += " AND DATE(hr.handover_time, 'unixepoch') >= ?"
            employee_params.append(start_date)

        if end_date:
            employee_query += " AND DATE(hr.handover_time, 'unixepoch') <= ?"
            employee_params.append(end_date)

        employee_query += " GROUP BY hr.outgoing_employee_id"
        emp_rows = db.execute(employee_query, employee_params)
        by_employee = [{"name": row['name'], "number": row['employee_number'], "count": row['count']} for row in emp_rows]

        return {
            "code": 200,
            "data": {
                "total_records": total_records,
                "by_shift": by_shift,
                "by_employee": by_employee
            }
        }
    except Exception as e:
        return {"code": 500, "message": f"获取交接班统计失败: {str(e)}"}
