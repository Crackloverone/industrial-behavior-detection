"""用户管理路由"""

from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/users", tags=["users"])


def _get_state():
    from backend.main import state
    return state


@router.get("")
async def get_users(request: Request):
    """获取用户列表"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    users = db.get_users()
    for user in users:
        user.pop('password_hash', None)
    return {"code": 200, "data": users}


@router.post("")
async def create_user(data: dict, request: Request):
    """创建用户"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    username = data.get('username', '')
    password = data.get('password', '')
    role = data.get('role', 'operator')
    
    if not username or not password:
        return {"code": 400, "message": "用户名和密码不能为空"}
    
    user_id = db.create_user(username, password, role)
    if user_id == -1:
        return {"code": 400, "message": "用户名已存在"}
    return {"code": 200, "data": {"id": user_id}}


@router.delete("/{user_id}")
async def delete_user(user_id: int, request: Request):
    """删除用户"""
    from backend.main import _require_user
    current = _require_user(request)
    if current.get("id") == user_id:
        return {"code": 400, "message": "不能删除当前登录账号"}
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    db.delete_user(user_id)
    return {"code": 200}
