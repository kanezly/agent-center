"""简单密码认证 - 单体用户设计"""

import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict

from config import settings

# 内存存储 session（轻量级，重启即失效）
sessions: Dict[str, dict] = {}


def is_auth_enabled() -> bool:
    """检查是否启用了认证（密码已配置）"""
    return bool(settings.PASSWORD and settings.PASSWORD.strip())


def verify_password(password: str) -> bool:
    """验证密码"""
    return secrets.compare_digest(password, settings.PASSWORD)


def create_session() -> str:
    """创建新 session，返回 session_id"""
    session_id = secrets.token_hex(32)
    expires_at = datetime.now() + timedelta(seconds=settings.SESSION_MAX_AGE)
    sessions[session_id] = {"created_at": datetime.now(), "expires_at": expires_at}
    return session_id


def validate_session(session_id: str) -> bool:
    """验证 session 是否有效"""
    if session_id not in sessions:
        return False
    session = sessions[session_id]
    if datetime.now() > session["expires_at"]:
        del sessions[session_id]
        return False
    return True


def require_auth(session_id: Optional[str]) -> bool:
    """检查是否已认证"""
    if not is_auth_enabled():
        return True
    if not session_id:
        return False
    return validate_session(session_id)
