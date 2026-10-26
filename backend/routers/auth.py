"""用户认证路由"""

import uuid
from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _get_state():
    from backend.main import state
    return state


@router.post("/register")
async def register(data: dict, request: Request):
    """用户注册"""
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    username = data.get('username', '')
    password = data.get('password', '')
    role = 'operator'
    
    if not username or not password:
        return {"code": 400, "message": "用户名和密码不能为空"}
    
    if db.get_user_by_username(username):
        return {"code": 400, "message": "用户名已存在"}
    
    user_id = db.create_user(username, password, role)
    db.log_audit(user_id, username, "register", f"注册用户 {username}", request.client.host if request.client else "")
    
    return {
        "code": 200,
        "data": {"id": user_id, "username": username, "role": role}
    }


@router.post("/login")
async def login(data: dict, request: Request):
    """用户登录"""
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    username = data.get('username', '')
    password = data.get('password', '')
    
    user = db.verify_user(username, password)
    if not user:
        db.log_audit(None, username, "login_failed", "登录失败", request.client.host if request.client else "")
        return {"code": 401, "message": "用户名或密码错误"}
    
    token = str(uuid.uuid4())
    db.update_user_token(user['id'], token)
    db.log_audit(user['id'], username, "login", "登录成功", request.client.host if request.client else "")
    
    return {
        "code": 200,
        "data": {
            "token": token,
            "user": {
                "id": user['id'],
                "username": user['username'],
                "role": user.get('role', 'operator')
            }
        }
    }


@router.post("/logout")
async def logout(request: Request):
    """用户登出"""
    db = _get_state().database
    if db:
        authorization = request.headers.get("authorization", "")
        token = authorization.removeprefix("Bearer ").strip() or request.cookies.get(
            "industrial_vision_token", ""
        )
        if token:
            user = db.get_user_by_token(token)
            if user:
                db.log_audit(user.get("id"), user.get("username", ""), "logout", "退出登录", request.client.host if request.client else "")
            db.clear_user_token(token)
    return {"code": 200}


@router.get("/me")
async def auth_me(request: Request):
    from backend.main import _require_user
    return {"code": 200, "data": _require_user(request)}
