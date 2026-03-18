"""认证 API"""

from fastapi import APIRouter, Request, Response, HTTPException
from pydantic import BaseModel

from auth import verify_password, create_session, require_auth, is_auth_enabled
from config import settings

auth_router = APIRouter(prefix="/auth")


class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    success: bool
    message: str


class AuthStatusResponse(BaseModel):
    authenticated: bool
    auth_enabled: bool


@auth_router.post("/login")
async def login(req: LoginRequest, response: Response) -> LoginResponse:
    """密码登录"""
    if not is_auth_enabled():
        raise HTTPException(status_code=400, detail="未启用认证")

    if not verify_password(req.password):
        raise HTTPException(status_code=401, detail="密码错误")

    session_id = create_session()
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        max_age=settings.SESSION_MAX_AGE,
        samesite="lax",
    )
    return LoginResponse(success=True, message="登录成功")


@auth_router.get("/status")
async def auth_status(request: Request) -> AuthStatusResponse:
    """检查登录状态"""
    session_id = request.cookies.get("session_id")
    return AuthStatusResponse(
        authenticated=require_auth(session_id),
        auth_enabled=is_auth_enabled()
    )


@auth_router.post("/logout")
async def logout(response: Response):
    """退出登录"""
    response.delete_cookie(key="session_id")
    return {"success": True}
