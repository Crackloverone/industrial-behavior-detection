"""员工管理路由"""

import base64
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse

router = APIRouter(prefix="/api/employees", tags=["employees"])

FACE_DB_DIR = Path(__file__).resolve().parents[2] / "data" / "face_database"


def _get_state():
    from backend.main import state
    return state


def _refresh_employee_face(employee):
    from backend.main import _refresh_employee_face as _refresh
    return _refresh(employee)


@router.get("")
async def get_employees(request: Request):
    """获取员工列表"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    return {"code": 200, "data": db.get_employees()}


@router.get("/{employee_id}")
async def get_employee(employee_id: int, request: Request):
    """获取单个员工"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    employee = db.get_employee(employee_id)
    if not employee:
        return {"code": 404, "message": "员工不存在"}
    return {"code": 200, "data": employee}


@router.get("/{employee_id}/alarms")
async def get_employee_alarms(employee_id: int, request: Request):
    """获取指定员工的报警记录"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    employee = db.get_employee(employee_id)
    if not employee:
        return {"code": 404, "message": "员工不存在"}
    alarms = db.get_alarms_by_employee(employee_id)
    return {"code": 200, "data": alarms}


@router.post("")
async def create_employee(request: Request):
    """创建员工"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}
    
    emp_number = str(data.get('employee_number', '')).strip()
    if not data.get('name') or not emp_number:
        return {"code": 400, "message": "姓名和工号不能为空"}
    data["employee_number"] = emp_number
    if db.get_employee_by_number(emp_number):
        return {"code": 400, "message": "工号已存在"}
    
    employee_id = db.add_employee(data)
    return {"code": 200, "data": {"id": employee_id}}


@router.put("/{employee_id}")
async def update_employee(employee_id: int, request: Request):
    """更新员工"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}
    
    employee = db.get_employee(employee_id)
    if not employee:
        return {"code": 404, "message": "员工不存在"}
    
    emp_number = str(data.get('employee_number', '')).strip()
    if emp_number:
        data["employee_number"] = emp_number
        existing = db.get_employee_by_number(emp_number)
        if existing and existing['id'] != employee_id:
            return {"code": 400, "message": "工号已被其他员工使用"}
    
    db.update_employee(employee_id, data)
    updated_employee = db.get_employee(employee_id)
    if _get_state().face_recognizer:
        old_number = str(employee.get("employee_number", "")).strip()
        new_number = str((updated_employee or {}).get("employee_number", "")).strip()
        if old_number and old_number != new_number:
            _get_state().face_recognizer.unregister_employee(old_number)
        _refresh_employee_face(updated_employee)
    
    return {"code": 200}


@router.delete("/{employee_id}")
async def delete_employee(employee_id: int, request: Request):
    """删除员工"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    employee = db.get_employee(employee_id)
    if not employee:
        return {"code": 404, "message": "员工不存在"}

    emp_number = str(employee.get("employee_number", "")).strip()
    if _get_state().face_recognizer:
        _get_state().face_recognizer.unregister_employee(emp_number)

    face_dir = FACE_DB_DIR.resolve()
    for candidate in [
        employee.get("photo_path", ""),
        employee.get("id_photo_path", ""),
        employee.get("face_photo_path", ""),
        str(Path("data/face_database") / f"{emp_number}.jpg") if emp_number else "",
    ]:
        try:
            path = Path(candidate)
            if path.exists() and face_dir in path.resolve().parents:
                path.unlink()
        except Exception as exc:
            print(f"[员工管理] 删除人脸照片失败: {candidate}, {exc}")

    db.delete_employee(employee_id)
    return {"code": 200}


@router.post("/{employee_id}/photo")
async def upload_employee_photo(employee_id: int, request: Request, photo_type: str = "id"):
    """上传员工照片"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    employee = db.get_employee(employee_id)
    if not employee:
        return {"code": 404, "message": "员工不存在"}
    
    try:
        content_type = request.headers.get('content-type', '')
        photo_path = None
        emp_number = str(employee.get("employee_number", "")).strip()
        
        if 'application/json' in content_type:
            data = await request.json()
            photo_data = data.get('photo', '')
            if photo_data and isinstance(photo_data, str):
                photo_dir = FACE_DB_DIR
                photo_dir.mkdir(parents=True, exist_ok=True)
                if photo_type == "face" and emp_number:
                    emp_dir = photo_dir / emp_number
                    emp_dir.mkdir(parents=True, exist_ok=True)
                    existing = sorted(emp_dir.glob("*.jpg"))
                    photo_path = emp_dir / f"face_{len(existing) + 1}.jpg"
                else:
                    photo_path = photo_dir / f"employee_{employee_id}_id.jpg"
                if photo_data.startswith("data:image"):
                    photo_data = photo_data.split(",", 1)[-1]
                img_bytes = base64.b64decode(photo_data)
                with open(photo_path, 'wb') as f:
                    f.write(img_bytes)
        else:
            form = await request.form()
            photo_file = form.get('photo')
            if photo_file and hasattr(photo_file, 'read'):
                photo_dir = FACE_DB_DIR
                photo_dir.mkdir(parents=True, exist_ok=True)
                if photo_type == "face" and emp_number:
                    emp_dir = photo_dir / emp_number
                    emp_dir.mkdir(parents=True, exist_ok=True)
                    existing = sorted(emp_dir.glob("*.jpg"))
                    photo_path = emp_dir / f"face_{len(existing) + 1}.jpg"
                else:
                    photo_path = photo_dir / f"employee_{employee_id}_id.jpg"
                file_bytes = await photo_file.read()
                if isinstance(file_bytes, bytes):
                    with open(photo_path, 'wb') as f:
                        f.write(file_bytes)
        
        if photo_path:
            if photo_type == "face" and emp_number:
                emp_dir = FACE_DB_DIR / emp_number
                updates = {"face_photo_path": str(emp_dir)}
            else:
                updates = {"id_photo_path": str(photo_path), "photo_path": str(photo_path)}
            db.update_employee(employee_id, updates)
            employee = db.get_employee(employee_id)
            
            if photo_type == "face" and _get_state().face_recognizer:
                try:
                    success = _refresh_employee_face(employee)
                    print(f"[员工管理] 人脸注册{'成功' if success else '失败'}: {employee.get('name')}")
                except Exception as e:
                    print(f"[员工管理] 人脸注册异常: {e}")
        
        if not photo_path:
            return {"code": 400, "message": "未提供照片"}

        return {
            "code": 200,
            "data": {
                "photo_path": str(photo_path),
                "photo_type": photo_type,
                "face_registered": photo_type == "face",
            },
        }
    except Exception as e:
        return {"code": 500, "message": f"保存照片失败: {str(e)}"}


@router.get("/{employee_id}/photo")
async def get_employee_photo(employee_id: int, request: Request, photo_type: str = "id"):
    """获取员工照片"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    employee = db.get_employee(employee_id) if db else None
    if not employee:
        return {"code": 404, "message": "员工不存在"}
    
    photo_path = (
        employee.get('face_photo_path', '')
        if photo_type == "face"
        else employee.get('id_photo_path') or employee.get('photo_path', '')
    )
    if not photo_path or not Path(photo_path).exists():
        return {"code": 404, "message": "照片不存在"}
    
    return FileResponse(photo_path)


@router.get("/{employee_id}/face-photos")
async def list_face_photos(employee_id: int, request: Request):
    """列出员工所有人脸照片"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    employee = db.get_employee(employee_id) if db else None
    if not employee:
        return {"code": 404, "message": "员工不存在"}
    
    emp_number = str(employee.get("employee_number", "")).strip()
    if not emp_number:
        return {"code": 200, "data": []}
    
    emp_dir = FACE_DB_DIR / emp_number
    if not emp_dir.is_dir():
        return {"code": 200, "data": []}
    
    photos = sorted(emp_dir.glob("face_*.jpg"))
    result = [
        {"index": i, "filename": photo.name, "url": f"/api/employees/{employee_id}/face-photos/{i}/image"}
        for i, photo in enumerate(photos)
    ]
    return {"code": 200, "data": result}


@router.get("/{employee_id}/face-photos/{photo_index}/image")
async def get_face_photo_image(employee_id: int, photo_index: int, request: Request):
    """获取指定人脸照片图片"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    employee = db.get_employee(employee_id) if db else None
    if not employee:
        return {"code": 404, "message": "员工不存在"}
    
    emp_number = str(employee.get("employee_number", "")).strip()
    if not emp_number:
        return {"code": 404, "message": "员工工号不存在"}
    
    emp_dir = FACE_DB_DIR / emp_number
    if not emp_dir.is_dir():
        return {"code": 404, "message": "员工照片目录不存在"}
    
    photos = sorted(emp_dir.glob("face_*.jpg"))
    if photo_index < 0 or photo_index >= len(photos):
        return {"code": 404, "message": "照片不存在"}
    
    return FileResponse(photos[photo_index])


@router.delete("/{employee_id}/face-photos/{photo_index}")
async def delete_face_photo(employee_id: int, photo_index: int, request: Request):
    """删除指定人脸照片"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    employee = db.get_employee(employee_id) if db else None
    if not employee:
        return {"code": 404, "message": "员工不存在"}
    
    emp_number = str(employee.get("employee_number", "")).strip()
    if not emp_number:
        return {"code": 404, "message": "员工工号不存在"}
    
    emp_dir = FACE_DB_DIR / emp_number
    if not emp_dir.is_dir():
        return {"code": 404, "message": "员工照片目录不存在"}
    
    photos = sorted(emp_dir.glob("face_*.jpg"))
    if photo_index < 0 or photo_index >= len(photos):
        return {"code": 404, "message": "照片不存在"}
    
    target = photos[photo_index]
    target.unlink(missing_ok=True)
    
    remaining = sorted(emp_dir.glob("face_*.jpg"))
    for i, photo in enumerate(remaining):
        new_name = emp_dir / f"face_{i + 1}.jpg"
        if photo.name != new_name.name:
            photo.rename(new_name)
    
    if not remaining:
        db.update_employee(employee_id, {"face_photo_path": ""})
    
    if _get_state().face_recognizer:
        try:
            _get_state().face_recognizer.delete_photo(emp_number, photo_index)
        except Exception:
            pass
    
    return {"code": 200, "message": "删除成功"}


@router.post("/recognize")
async def recognize_face_endpoint(request: Request):
    """人脸识别 - 从图像中识别员工"""
    fr = _get_state().face_recognizer
    if not fr:
        return {"code": 500, "message": "人脸识别器未初始化"}
    
    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}
    
    image_data = data.get('image', '')
    if not image_data:
        return {"code": 400, "message": "未提供图像数据"}
    
    try:
        import cv2
        import numpy as np
        from backend.main import _recognize_employee_from_image, _decode_base64_image
        
        image = _decode_base64_image(image_data)
        if image is None:
            return {"code": 400, "message": "图像解码失败"}
        
        employee_id, employee_number, employee_name, similarity = _recognize_employee_from_image(image)
        
        if employee_id is None:
            return {"code": 200, "data": {"recognized": False}}
        
        employee = _get_state().database.get_employee(employee_id)
        
        return {
            "code": 200,
            "data": {
                "recognized": True,
                "employee": employee,
                "employee_number": employee_number,
                "employee_name": employee_name,
                "similarity": float(similarity) if similarity else 0
            }
        }
    except Exception as e:
        return {"code": 500, "message": f"识别失败: {str(e)}"}
