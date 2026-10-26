"""考勤管理路由"""

from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Request, Query

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


def _get_state():
    from backend.main import state
    return state


def _require_user(request: Request):
    from backend.main import _require_user
    return _require_user(request)


# ============================================
# 考勤规则管理
# ============================================
@router.get("/rules")
async def get_attendance_rules(request: Request):
    """获取考勤规则列表"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    return {"code": 200, "data": db.get_attendance_rules()}


@router.post("/rules")
async def create_attendance_rule(request: Request):
    """创建考勤规则"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}
    
    if not data.get('name'):
        return {"code": 400, "message": "规则名称不能为空"}
    
    rule_id = db.add_attendance_rule(data)
    return {"code": 200, "data": {"id": rule_id}}


@router.put("/rules/{rule_id}")
async def update_attendance_rule(rule_id: int, request: Request):
    """更新考勤规则"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}
    
    db.update_attendance_rule(rule_id, data)
    return {"code": 200}


@router.delete("/rules/{rule_id}")
async def delete_attendance_rule(rule_id: int, request: Request):
    """删除考勤规则"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    db.delete_attendance_rule(rule_id)
    return {"code": 200}


@router.post("/rules/{rule_id}/activate")
async def activate_attendance_rule(rule_id: int, request: Request):
    """激活考勤规则"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    # 先停用所有规则
    rules = db.get_attendance_rules()
    for rule in rules:
        if rule['id'] != rule_id:
            db.update_attendance_rule(rule['id'], {'is_active': 0})
    
    # 激活指定规则
    db.update_attendance_rule(rule_id, {'is_active': 1})
    return {"code": 200}


# ============================================
# 考勤记录管理
# ============================================
@router.get("/records")
async def get_attendance_records(
    request: Request,
    employee_id: Optional[int] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0)
):
    """获取考勤记录列表"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    records = db.get_attendance_records(
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
        status=status,
        limit=limit,
        offset=offset
    )
    total = db.get_attendance_count(
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date
    )
    return {"code": 200, "data": records, "total": total}


@router.get("/records/{record_id}")
async def get_attendance_record(record_id: int, request: Request):
    """获取单条考勤记录"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    record = db.get_attendance_record(record_id)
    if not record:
        return {"code": 404, "message": "考勤记录不存在"}
    return {"code": 200, "data": record}


@router.post("/check-in")
async def check_in(request: Request):
    """员工签到"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}
    
    employee_id = data.get('employee_id')
    camera_id = data.get('camera_id')
    location = data.get('location', '')
    image_path = data.get('image_path', '')
    
    if not employee_id:
        return {"code": 400, "message": "员工ID不能为空"}
    
    employee = db.get_employee(employee_id)
    if not employee:
        return {"code": 404, "message": "员工不存在"}
    
    # 检查是否已签到
    today_record = db.get_today_check_in(employee_id)
    if today_record:
        return {"code": 400, "message": "今日已签到"}
    
    # 获取考勤规则
    rule = db.get_active_attendance_rule()
    now = datetime.now()
    check_in_time = now.timestamp()
    
    # 计算状态
    status = 'normal'
    late_minutes = 0
    
    if rule:
        work_start = rule['work_start_time']
        hour, minute = map(int, work_start.split(':'))
        work_start_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        
        if now > work_start_time:
            late_minutes = int((now - work_start_time).total_seconds() / 60)
            if late_minutes > rule['late_threshold']:
                status = 'late'
    
    record = {
        'employee_id': employee_id,
        'employee_name': employee.get('name', ''),
        'employee_number': employee.get('employee_number', ''),
        'department': employee.get('department', ''),
        'check_in_time': check_in_time,
        'check_in_location': location,
        'check_in_camera_id': camera_id,
        'check_in_image_path': image_path,
        'status': status,
        'late_minutes': late_minutes
    }
    
    record_id = db.add_attendance_record(record)
    return {"code": 200, "data": {"id": record_id, "status": status, "late_minutes": late_minutes}}


@router.post("/check-out")
async def check_out(request: Request):
    """员工签退"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}
    
    employee_id = data.get('employee_id')
    camera_id = data.get('camera_id')
    location = data.get('location', '')
    image_path = data.get('image_path', '')
    
    if not employee_id:
        return {"code": 400, "message": "员工ID不能为空"}
    
    # 获取今日签到记录
    today_record = db.get_today_check_in(employee_id)
    if not today_record:
        return {"code": 400, "message": "今日未签到，无法签退"}
    
    if today_record.get('check_out_time'):
        return {"code": 400, "message": "今日已签退"}
    
    now = datetime.now()
    check_out_time = now.timestamp()
    
    # 获取考勤规则
    rule = db.get_active_attendance_rule()
    
    # 计算工作时长
    work_hours = (check_out_time - today_record['check_in_time']) / 3600
    
    # 计算状态
    status = today_record.get('status', 'normal')
    early_minutes = 0
    overtime_minutes = 0
    
    if rule:
        work_end = rule['work_end_time']
        hour, minute = map(int, work_end.split(':'))
        work_end_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        
        # 早退
        if now < work_end_time:
            early_minutes = int((work_end_time - now).total_seconds() / 60)
            if early_minutes > rule['early_threshold']:
                status = 'early'
        
        # 加班
        if now > work_end_time:
            overtime_minutes = int((now - work_end_time).total_seconds() / 60)
            if overtime_minutes > rule['overtime_threshold']:
                status = 'overtime'
    
    # 更新记录
    updates = {
        'check_out_time': check_out_time,
        'check_out_location': location,
        'check_out_camera_id': camera_id,
        'check_out_image_path': image_path,
        'status': status,
        'early_minutes': early_minutes,
        'overtime_minutes': overtime_minutes,
        'work_hours': work_hours
    }
    
    db.update_attendance_record(today_record['id'], updates)
    return {"code": 200, "data": {"status": status, "work_hours": work_hours, "early_minutes": early_minutes, "overtime_minutes": overtime_minutes}}


@router.delete("/records/{record_id}")
async def delete_attendance_record(record_id: int, request: Request):
    """删除考勤记录"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    record = db.get_attendance_record(record_id)
    if not record:
        return {"code": 404, "message": "考勤记录不存在"}

    # 删除相关记录
    db.execute("DELETE FROM attendance_records WHERE id = ?", (record_id,))
    return {"code": 200}


# ============================================
# 人脸识别签到
# ============================================
@router.post("/face-recognize")
async def face_recognize_check(request: Request):
    """人脸识别签到/签退 - 支持两种模式:
    1. 前端传 image (浏览器摄像头/手动拍照)
    2. 传 camera_index 从资源管理器获取帧 (工厂固定摄像头)
    """
    _require_user(request)
    db = _get_state().database
    fr = _get_state().face_recognizer
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    if not fr:
        return {"code": 500, "message": "人脸识别器未初始化"}
    
    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}
    
    image_data = data.get('image', '')
    camera_id = data.get('camera_id')
    camera_index = data.get('camera_index')
    location = data.get('location', '')
    action = data.get('action', 'auto')  # auto, check-in, check-out
    
    # 如果没有传 image 但传了 camera_index，从资源管理器获取帧
    if not image_data and camera_index is not None:
        mgr = _get_state().camera_resource_manager
        if mgr:
            frame = mgr.get_frame(int(camera_index))
            if frame is not None:
                import cv2
                _, encoded = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                import base64
                image_data = base64.b64encode(encoded.tobytes()).decode()
    
    if not image_data:
        return {"code": 400, "message": "未提供图像数据或摄像头未启动"}
    
    try:
        import cv2
        import numpy as np
        from backend.main import _decode_base64_image
        
        image = _decode_base64_image(image_data)
        if image is None:
            return {"code": 400, "message": "图像解码失败"}
        
        # 人脸识别
        employee_number, similarity, employee_info = fr.recognize_face(image)
        
        if not employee_number:
            return {"code": 200, "data": {"recognized": False, "message": "未识别到已注册员工"}}
        
        # 查找员工
        employee = db.get_employee_by_number(employee_number)
        if not employee:
            return {"code": 200, "data": {"recognized": False, "message": f"员工 {employee_number} 不存在"}}
        
        employee_id = employee['id']
        
        # 保存签到图片
        image_path = ""
        ok, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if ok:
            from pathlib import Path
            img_dir = Path("data/attendance_images")
            img_dir.mkdir(parents=True, exist_ok=True)
            img_file = img_dir / f"face_{employee_number}_{int(datetime.now().timestamp() * 1000)}.jpg"
            img_file.write_bytes(encoded.tobytes())
            image_path = str(img_file)
        
        now = datetime.now()
        rule = db.get_active_attendance_rule()
        
        # 判断操作类型
        today_record = db.get_today_check_in(employee_id)
        
        if action == 'auto':
            # 自动判断：未签到→签到，已签到未签退→签退
            if not today_record:
                action = 'check-in'
            elif not today_record.get('check_out_time'):
                action = 'check-out'
            else:
                return {"code": 200, "data": {
                    "recognized": True,
                    "action": "none",
                    "employee_id": employee_id,
                    "employee_name": employee.get('name', ''),
                    "employee_number": employee_number,
                    "similarity": similarity,
                    "message": "今日已完成签到和签退"
                }}
        
        if action == 'check-in':
            if today_record:
                return {"code": 200, "data": {
                    "recognized": True,
                    "action": "already-checked-in",
                    "employee_id": employee_id,
                    "employee_name": employee.get('name', ''),
                    "employee_number": employee_number,
                    "similarity": similarity,
                    "message": f"今日已签到 ({datetime.fromtimestamp(today_record['check_in_time']).strftime('%H:%M')})"
                }}
            
            # 计算签到状态
            status = 'normal'
            late_minutes = 0
            if rule:
                work_start = rule['work_start_time']
                hour, minute = map(int, work_start.split(':'))
                work_start_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                if now > work_start_time:
                    late_minutes = int((now - work_start_time).total_seconds() / 60)
                    if late_minutes > rule['late_threshold']:
                        status = 'late'
            
            record = {
                'employee_id': employee_id,
                'employee_name': employee.get('name', ''),
                'employee_number': employee_number,
                'department': employee.get('department', ''),
                'check_in_time': now.timestamp(),
                'check_in_location': location,
                'check_in_camera_id': camera_id,
                'check_in_image_path': image_path,
                'status': status,
                'late_minutes': late_minutes
            }
            record_id = db.add_attendance_record(record)
            
            return {"code": 200, "data": {
                "recognized": True,
                "action": "check-in",
                "record_id": record_id,
                "employee_id": employee_id,
                "employee_name": employee.get('name', ''),
                "employee_number": employee_number,
                "department": employee.get('department', ''),
                "similarity": similarity,
                "status": status,
                "late_minutes": late_minutes,
                "time": now.strftime('%H:%M:%S'),
                "message": f"签到成功{'（迟到'+str(late_minutes)+'分钟）' if late_minutes > 0 else ''}"
            }}
        
        elif action == 'check-out':
            if not today_record:
                return {"code": 200, "data": {
                    "recognized": True,
                    "action": "no-check-in",
                    "employee_id": employee_id,
                    "employee_name": employee.get('name', ''),
                    "employee_number": employee_number,
                    "similarity": similarity,
                    "message": "今日未签到，无法签退"
                }}
            
            if today_record.get('check_out_time'):
                return {"code": 200, "data": {
                    "recognized": True,
                    "action": "already-checked-out",
                    "employee_id": employee_id,
                    "employee_name": employee.get('name', ''),
                    "employee_number": employee_number,
                    "similarity": similarity,
                    "message": f"今日已签退 ({datetime.fromtimestamp(today_record['check_out_time']).strftime('%H:%M')})"
                }}
            
            check_out_time = now.timestamp()
            work_hours = (check_out_time - today_record['check_in_time']) / 3600
            
            # 计算状态
            status = today_record.get('status', 'normal')
            early_minutes = 0
            overtime_minutes = 0
            
            if rule:
                work_end = rule['work_end_time']
                hour, minute = map(int, work_end.split(':'))
                work_end_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                
                if now < work_end_time:
                    early_minutes = int((work_end_time - now).total_seconds() / 60)
                    if early_minutes > rule['early_threshold']:
                        status = 'early'
                
                if now > work_end_time:
                    overtime_minutes = int((now - work_end_time).total_seconds() / 60)
                    if overtime_minutes > rule['overtime_threshold']:
                        status = 'overtime'
            
            updates = {
                'check_out_time': check_out_time,
                'check_out_location': location,
                'check_out_camera_id': camera_id,
                'check_out_image_path': image_path,
                'status': status,
                'early_minutes': early_minutes,
                'overtime_minutes': overtime_minutes,
                'work_hours': work_hours
            }
            db.update_attendance_record(today_record['id'], updates)
            
            return {"code": 200, "data": {
                "recognized": True,
                "action": "check-out",
                "employee_id": employee_id,
                "employee_name": employee.get('name', ''),
                "employee_number": employee_number,
                "department": employee.get('department', ''),
                "similarity": similarity,
                "status": status,
                "work_hours": round(work_hours, 1),
                "early_minutes": early_minutes,
                "overtime_minutes": overtime_minutes,
                "time": now.strftime('%H:%M:%S'),
                "message": f"签退成功，工作{round(work_hours, 1)}小时"
            }}
    
    except Exception as e:
        return {"code": 500, "message": f"识别失败: {str(e)}"}


@router.post("/face-check-in")
async def face_check_in(request: Request):
    """人脸识别签到 - 接收摄像头图像，识别员工并签到"""
    _require_user(request)
    db = _get_state().database
    fr = _get_state().face_recognizer
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    if not fr:
        return {"code": 500, "message": "人脸识别器未初始化"}
    
    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}
    
    image_data = data.get('image', '')
    camera_id = data.get('camera_id')
    location = data.get('location', '')
    
    if not image_data:
        return {"code": 400, "message": "未提供图像数据"}
    
    try:
        import cv2
        import numpy as np
        from backend.main import _decode_base64_image
        
        image = _decode_base64_image(image_data)
        if image is None:
            return {"code": 400, "message": "图像解码失败"}
        
        employee_number, similarity, employee_info = fr.recognize_face(image)
        
        if not employee_number:
            return {"code": 200, "data": {"recognized": False, "message": "未识别到已注册员工"}}
        
        employee = db.get_employee_by_number(employee_number)
        if not employee:
            return {"code": 200, "data": {"recognized": False, "message": f"员工 {employee_number} 不存在"}}
        
        employee_id = employee['id']
        today_record = db.get_today_check_in(employee_id)
        if today_record:
            return {"code": 200, "data": {
                "recognized": True,
                "employee_id": employee_id,
                "employee_name": employee.get('name', ''),
                "employee_number": employee_number,
                "similarity": similarity,
                "message": f"今日已签到 ({datetime.fromtimestamp(today_record['check_in_time']).strftime('%H:%M')})"
            }}
        
        image_path = ""
        ok, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if ok:
            from pathlib import Path
            img_dir = Path("data/attendance_images")
            img_dir.mkdir(parents=True, exist_ok=True)
            img_file = img_dir / f"checkin_{employee_number}_{int(datetime.now().timestamp() * 1000)}.jpg"
            img_file.write_bytes(encoded.tobytes())
            image_path = str(img_file)
        
        now = datetime.now()
        rule = db.get_active_attendance_rule()
        status = 'normal'
        late_minutes = 0
        
        if rule:
            work_start = rule['work_start_time']
            hour, minute = map(int, work_start.split(':'))
            work_start_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if now > work_start_time:
                late_minutes = int((now - work_start_time).total_seconds() / 60)
                if late_minutes > rule['late_threshold']:
                    status = 'late'
        
        record = {
            'employee_id': employee_id,
            'employee_name': employee.get('name', ''),
            'employee_number': employee_number,
            'department': employee.get('department', ''),
            'check_in_time': now.timestamp(),
            'check_in_location': location,
            'check_in_camera_id': camera_id,
            'check_in_image_path': image_path,
            'status': status,
            'late_minutes': late_minutes
        }
        record_id = db.add_attendance_record(record)
        
        return {"code": 200, "data": {
            "recognized": True,
            "record_id": record_id,
            "employee_id": employee_id,
            "employee_name": employee.get('name', ''),
            "employee_number": employee_number,
            "department": employee.get('department', ''),
            "similarity": similarity,
            "status": status,
            "late_minutes": late_minutes,
            "time": now.strftime('%H:%M:%S'),
            "message": f"签到成功{'（迟到'+str(late_minutes)+'分钟）' if late_minutes > 0 else ''}"
        }}
    except Exception as e:
        return {"code": 500, "message": f"识别签到失败: {str(e)}"}


@router.post("/face-check-out")
async def face_check_out(request: Request):
    """人脸识别签退 - 接收摄像头图像，识别员工并签退"""
    _require_user(request)
    db = _get_state().database
    fr = _get_state().face_recognizer
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    if not fr:
        return {"code": 500, "message": "人脸识别器未初始化"}
    
    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}
    
    image_data = data.get('image', '')
    camera_id = data.get('camera_id')
    location = data.get('location', '')
    
    if not image_data:
        return {"code": 400, "message": "未提供图像数据"}
    
    try:
        import cv2
        import numpy as np
        from backend.main import _decode_base64_image
        
        image = _decode_base64_image(image_data)
        if image is None:
            return {"code": 400, "message": "图像解码失败"}
        
        employee_number, similarity, employee_info = fr.recognize_face(image)
        
        if not employee_number:
            return {"code": 200, "data": {"recognized": False, "message": "未识别到已注册员工"}}
        
        employee = db.get_employee_by_number(employee_number)
        if not employee:
            return {"code": 200, "data": {"recognized": False, "message": f"员工 {employee_number} 不存在"}}
        
        employee_id = employee['id']
        today_record = db.get_today_check_in(employee_id)
        
        if not today_record:
            return {"code": 200, "data": {
                "recognized": True,
                "employee_id": employee_id,
                "employee_name": employee.get('name', ''),
                "employee_number": employee_number,
                "similarity": similarity,
                "message": "今日未签到，无法签退"
            }}
        
        if today_record.get('check_out_time'):
            return {"code": 200, "data": {
                "recognized": True,
                "employee_id": employee_id,
                "employee_name": employee.get('name', ''),
                "employee_number": employee_number,
                "similarity": similarity,
                "message": f"今日已签退 ({datetime.fromtimestamp(today_record['check_out_time']).strftime('%H:%M')})"
            }}
        
        image_path = ""
        ok, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if ok:
            from pathlib import Path
            img_dir = Path("data/attendance_images")
            img_dir.mkdir(parents=True, exist_ok=True)
            img_file = img_dir / f"checkout_{employee_number}_{int(datetime.now().timestamp() * 1000)}.jpg"
            img_file.write_bytes(encoded.tobytes())
            image_path = str(img_file)
        
        now = datetime.now()
        check_out_time = now.timestamp()
        work_hours = (check_out_time - today_record['check_in_time']) / 3600
        
        rule = db.get_active_attendance_rule()
        status = today_record.get('status', 'normal')
        early_minutes = 0
        overtime_minutes = 0
        
        if rule:
            work_end = rule['work_end_time']
            hour, minute = map(int, work_end.split(':'))
            work_end_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            if now < work_end_time:
                early_minutes = int((work_end_time - now).total_seconds() / 60)
                if early_minutes > rule['early_threshold']:
                    status = 'early'
            
            if now > work_end_time:
                overtime_minutes = int((now - work_end_time).total_seconds() / 60)
                if overtime_minutes > rule['overtime_threshold']:
                    status = 'overtime'
        
        updates = {
            'check_out_time': check_out_time,
            'check_out_location': location,
            'check_out_camera_id': camera_id,
            'check_out_image_path': image_path,
            'status': status,
            'early_minutes': early_minutes,
            'overtime_minutes': overtime_minutes,
            'work_hours': work_hours
        }
        db.update_attendance_record(today_record['id'], updates)
        
        return {"code": 200, "data": {
            "recognized": True,
            "employee_id": employee_id,
            "employee_name": employee.get('name', ''),
            "employee_number": employee_number,
            "department": employee.get('department', ''),
            "similarity": similarity,
            "status": status,
            "work_hours": round(work_hours, 1),
            "early_minutes": early_minutes,
            "overtime_minutes": overtime_minutes,
            "time": now.strftime('%H:%M:%S'),
            "message": f"签退成功，工作{round(work_hours, 1)}小时"
        }}
    except Exception as e:
        return {"code": 500, "message": f"识别签退失败: {str(e)}"}


# ============================================
# 请假管理
# ============================================
@router.get("/leaves")
async def get_leave_records(
    request: Request,
    employee_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0)
):
    """获取请假记录列表"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    records = db.get_leave_records(
        employee_id=employee_id,
        status=status,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset
    )
    return {"code": 200, "data": records}


@router.get("/leaves/{record_id}")
async def get_leave_record(record_id: int, request: Request):
    """获取单条请假记录"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    record = db.get_leave_record(record_id)
    if not record:
        return {"code": 404, "message": "请假记录不存在"}
    return {"code": 200, "data": record}


@router.post("/leaves")
async def create_leave_record(request: Request):
    """创建请假记录"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}
    
    employee_id = data.get('employee_id')
    if not employee_id:
        return {"code": 400, "message": "员工ID不能为空"}
    
    employee = db.get_employee(employee_id)
    if not employee:
        return {"code": 404, "message": "员工不存在"}
    
    record = {
        'employee_id': employee_id,
        'employee_name': employee.get('name', ''),
        'employee_number': employee.get('employee_number', ''),
        'leave_type': data.get('leave_type', 'annual'),
        'start_date': data.get('start_date', ''),
        'end_date': data.get('end_date', ''),
        'duration': data.get('duration', 0),
        'reason': data.get('reason', ''),
        'status': 'pending'
    }
    
    record_id = db.add_leave_record(record)
    return {"code": 200, "data": {"id": record_id}}


@router.put("/leaves/{record_id}")
async def update_leave_record(record_id: int, request: Request):
    """更新请假记录"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}
    
    record = db.get_leave_record(record_id)
    if not record:
        return {"code": 404, "message": "请假记录不存在"}
    
    db.update_leave_record(record_id, data)
    return {"code": 200}


@router.delete("/leaves/{record_id}")
async def delete_leave_record(record_id: int, request: Request):
    """删除请假记录"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    record = db.get_leave_record(record_id)
    if not record:
        return {"code": 404, "message": "请假记录不存在"}
    
    db.delete_leave_record(record_id)
    return {"code": 200}


@router.put("/leaves/{record_id}/approve")
async def approve_leave_record(record_id: int, request: Request):
    """审批请假记录"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}
    
    record = db.get_leave_record(record_id)
    if not record:
        return {"code": 404, "message": "请假记录不存在"}
    
    status = data.get('status', 'approved')
    user = _require_user(request)
    
    updates = {
        'status': status,
        'approved_by': user.get('id'),
        'approved_at': datetime.now().timestamp()
    }
    
    db.update_leave_record(record_id, updates)
    return {"code": 200}


# ============================================
# 考勤统计
# ============================================
@router.get("/statistics")
async def get_attendance_statistics(
    request: Request,
    employee_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0)
):
    """获取考勤统计"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    stats = db.get_attendance_statistics(
        employee_id=employee_id,
        department=department,
        year=year,
        month=month,
        limit=limit,
        offset=offset
    )
    return {"code": 200, "data": stats}


@router.get("/statistics/summary")
async def get_attendance_summary(
    request: Request,
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None)
):
    """获取考勤汇总统计"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    if not year:
        year = datetime.now().year
    if not month:
        month = datetime.now().month
    
    # 获取所有员工统计
    stats = db.get_attendance_statistics(year=year, month=month)
    
    # 计算汇总
    total_employees = len(stats)
    total_work_days = sum(s.get('work_days', 0) for s in stats)
    total_late_days = sum(s.get('late_days', 0) for s in stats)
    total_early_days = sum(s.get('early_days', 0) for s in stats)
    total_absent_days = sum(s.get('absent_days', 0) for s in stats)
    total_overtime_hours = sum(s.get('overtime_hours', 0) for s in stats)
    total_leave_days = sum(s.get('leave_days', 0) for s in stats)
    
    avg_attendance_rate = 0
    if total_employees > 0:
        avg_attendance_rate = sum(s.get('attendance_rate', 0) for s in stats) / total_employees
    
    return {
        "code": 200,
        "data": {
            "year": year,
            "month": month,
            "total_employees": total_employees,
            "total_work_days": total_work_days,
            "total_late_days": total_late_days,
            "total_early_days": total_early_days,
            "total_absent_days": total_absent_days,
            "total_overtime_hours": total_overtime_hours,
            "total_leave_days": total_leave_days,
            "avg_attendance_rate": avg_attendance_rate
        }
    }


@router.get("/today")
async def get_today_attendance(request: Request):
    """获取今日考勤情况"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    today = date.today().isoformat()
    records = db.get_attendance_records(start_date=today, end_date=today)
    
    # 获取所有员工
    employees = db.get_employees()
    total_employees = len(employees)
    checked_in = len(records)
    late_count = len([r for r in records if r.get('status') == 'late'])
    early_count = len([r for r in records if r.get('status') == 'early'])
    absent_count = total_employees - checked_in
    
    return {
        "code": 200,
        "data": {
            "date": today,
            "total_employees": total_employees,
            "checked_in": checked_in,
            "late_count": late_count,
            "early_count": early_count,
            "absent_count": absent_count,
            "records": records
        }
    }


@router.get("/employee/{employee_id}/monthly")
async def get_employee_monthly_attendance(
    employee_id: int,
    request: Request,
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None)
):
    """获取员工月度考勤详情"""
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    if not year:
        year = datetime.now().year
    if not month:
        month = datetime.now().month
    
    # 获取员工信息
    employee = db.get_employee(employee_id)
    if not employee:
        return {"code": 404, "message": "员工不存在"}
    
    # 获取月度考勤记录
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year+1}-01-01"
    else:
        end_date = f"{year}-{month+1:02d}-01"
    
    records = db.get_attendance_records(
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date
    )
    
    # 获取月度统计
    stats = db.get_attendance_statistics(
        employee_id=employee_id,
        year=year,
        month=month
    )
    
    # 获取请假记录
    leaves = db.get_leave_records(
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return {
        "code": 200,
        "data": {
            "employee": employee,
            "year": year,
            "month": month,
            "records": records,
            "statistics": stats[0] if stats else None,
            "leaves": leaves
        }
    }
