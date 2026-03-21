"""认证中间件 - 保护 API"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

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
        # CORS 预检请求直接放行
        if request.method == "OPTIONS":
            return await call_next(request)

        # 公开路径跳过认证
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        # 未配置密码则拒绝访问（强制启用认证）
        if not is_auth_enabled():
            return JSONResponse(
                status_code=401,
                content={"error": "auth_not_configured", "message": "认证未启用，请先设置 PASSWORD 环境变量"},
                headers={
                    "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
                    "Access-Control-Allow-Credentials": "true",
                }
            )

        # 检查是否已认证
        session_id = request.cookies.get("session_id")
        if not require_auth(session_id):
            return JSONResponse(
                status_code=401,
                content={"error": "unauthorized", "message": "请先登录"},
                headers={
                    "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
                    "Access-Control-Allow-Credentials": "true",
                }
            )

        return await call_next(request)
