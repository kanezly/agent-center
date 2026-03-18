"""配置管理 - 使用 Pydantic Settings 进行类型安全的环境变量管理"""

import shutil
import logging
from typing import List
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """应用配置，从环境变量加载"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 服务器配置
    PORT: int = Field(default=8010, description="API 服务端口")

    # 调度器配置
    MAX_CONCURRENT: int = Field(default=5, ge=1, le=32, description="最大并发任务数")

    # 数据库配置
    DB_PATH: str = Field(
        default="backend/task_manager.db",
        description="数据库文件路径（相对于项目根目录）"
    )

    @property
    def DB_PATH_ABS(self) -> str:
        """获取数据库绝对路径"""
        db_path = Path(self.DB_PATH)
        if db_path.is_absolute():
            return str(db_path)
        # 相对于项目根目录
        project_root = Path(__file__).parent.parent
        return str(project_root / self.DB_PATH)

    # CORS 配置 - 使用逗号分隔的字符串
    CORS_ORIGINS_STR: str = Field(
        default="http://localhost:3010,http://127.0.0.1:3010",
        description="允许的 CORS 源（逗号分隔）"
    )

    @property
    def CORS_ORIGINS(self) -> List[str]:
        """解析 CORS 源列表，自动添加本机所有 IP 地址"""
        import socket
        origins = [origin.strip() for origin in self.CORS_ORIGINS_STR.split(",") if origin.strip()]

        # 添加 localhost 和 127.0.0.1
        origins.extend([
            f"http://localhost:{self.PORT}",
            f"http://127.0.0.1:{self.PORT}"
        ])

        # 自动获取本机所有 IPv4 地址并添加到 CORS 白名单
        # 这样手机/平板访问本机 IP 时不会被 CORS 阻止
        try:
            hostname = socket.gethostname()
            ip_list = socket.getaddrinfo(hostname, None, socket.AF_INET)
            for ip_info in ip_list:
                ip = ip_info[4][0]
                if not ip.startswith("127."):  # 跳过回环地址
                    origins.append(f"http://{ip}:{self.PORT}")
        except Exception as e:
            logger.warning(f"获取本机 IP 地址失败：{e}")

        # 去重
        return list(dict.fromkeys(origins))

    # 任务超时配置
    TASK_TIMEOUT: int = Field(default=3600, ge=60, le=86400, description="任务执行超时时间（秒）")

    # 后处理超时配置
    POST_PROCESS_TIMEOUT: int = Field(default=600, ge=60, le=3600, description="后处理超时时间（秒）")

    # 认证配置
    PASSWORD: str = Field(default="", description="登录密码（未设置则跳过认证）")

    # Session 配置
    SESSION_MAX_AGE: int = Field(default=86400, ge=3600, le=604800, description="Session 有效期（秒）")


# 全局配置实例
settings = Settings()

# 导出常用配置变量
PORT = settings.PORT
DB_PATH = settings.DB_PATH
CORS_ORIGINS = settings.CORS_ORIGINS
MAX_CONCURRENT = settings.MAX_CONCURRENT
TASK_TIMEOUT = settings.TASK_TIMEOUT
POST_PROCESS_TIMEOUT = settings.POST_PROCESS_TIMEOUT


def check_claude_cli() -> bool:
    """检查 Claude CLI 是否已安装"""
    if shutil.which("claude"):
        logger.info("Claude CLI 已安装")
        return True
    logger.warning("Claude CLI 未安装，请运行：npm install -g @anthropic-ai/claude-code")
    return False


def check_git() -> bool:
    """检查 Git 是否可用"""
    if shutil.which("git"):
        logger.info("Git 已安装")
        return True
    logger.warning("Git 未安装，worktree 功能将被禁用")
    return False
