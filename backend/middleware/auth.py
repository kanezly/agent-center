"""认证中间件 - 保护 API"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from auth import require_auth, is_auth_enabled

# 不需要认证的路径
PUBLIC_PATHS = {
    "/api/auth/login",
    "/api/auth/status",
    "/api/auth/logout",
    "/health",
}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 公开路径跳过认证
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        # 未配置密码则跳过认证
        if not is_auth_enabled():
            return await call_next(request)

        # 检查是否已认证
        session_id = request.cookies.get("session_id")
        if not require_auth(session_id):
            return JSONResponse(
                status_code=401,
                content={"error": "unauthorized", "message": "请先登录"}
            )

        return await call_next(request)
