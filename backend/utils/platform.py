"""跨平台工具函数 - 处理 Linux/Windows 兼容性

Provides utilities for cross-platform compatibility between Linux and Windows.
"""

import os
import sys
import signal
import subprocess
import asyncio
import logging
from pathlib import Path
from typing import Optional, Dict, Any


def normalize_path(path: str) -> str:
    """规范化路径，处理大小写和路径分隔符

    在 Windows 上，文件系统不区分大小写，但路径字符串可能区分。
    此函数确保路径在不同平台上的一致性。

    Args:
        path: 要规范化的路径

    Returns:
        规范化后的路径字符串
    """
    if not path:
        return path

    # 使用 pathlib 规范化路径
    p = Path(path)

    # 规范化路径分隔符和相对路径引用
    normalized = str(p.resolve()) if p.exists() else str(p.absolute())

    # 在 Windows 上，统一小写驱动器字母
    if os.name == "nt" and len(normalized) >= 2 and normalized[1] == ":":
        normalized = normalized[0].lower() + normalized[1:]

    return normalized


def normalize_path_for_comparison(path: str) -> str:
    """规范化路径用于比较

    由于 Linux 文件系统区分大小写而 Windows 不区分，
    此函数提供一致的路径比较格式。

    Args:
        path: 要规范化的路径

    Returns:
        用于比较的规范化路径（Windows 上转换为小写）
    """
    normalized = normalize_path(path)

    # 在 Windows 上转换为小写进行比较
    if os.name == "nt":
        return normalized.lower()

    return normalized


def paths_are_equal(path1: str, path2: str) -> bool:
    """比较两个路径是否相等，考虑平台差异

    Args:
        path1: 第一个路径
        path2: 第二个路径

    Returns:
        如果路径相等返回 True，否则返回 False
    """
    norm1 = normalize_path_for_comparison(path1)
    norm2 = normalize_path_for_comparison(path2)
    return norm1 == norm2


def is_path_child_of(child: str, parent: str) -> bool:
    """检查一个路径是否是另一个路径的子目录

    Args:
        child: 子路径
        parent: 父路径

    Returns:
        如果 child 是 parent 的子目录返回 True
    """
    try:
        child_norm = Path(normalize_path(child))
        parent_norm = Path(normalize_path(parent))

        # 尝试获取相对路径，如果 child 是 parent 的子目录则不会抛出异常
        child_norm.relative_to(parent_norm)
        return True
    except ValueError:
        return False


def get_shell_command() -> str:
    """获取当前平台的 shell 命令

    Returns:
        shell 命令（Windows 返回 'cmd.exe'，Linux/macOS 返回 '/bin/bash'）
    """
    if os.name == "nt":
        return "cmd.exe"
    return "/bin/bash"


def is_windows() -> bool:
    """检查是否在 Windows 上运行

    Returns:
        如果在 Windows 上返回 True
    """
    return os.name == "nt"


def is_linux() -> bool:
    """检查是否在 Linux 上运行

    Returns:
        如果在 Linux 上返回 True
    """
    return sys.platform.startswith("linux")


def is_macos() -> bool:
    """检查是否在 macOS 上运行

    Returns:
        如果在 macOS 上返回 True
    """
    return sys.platform == "darwin"


def quote_path_for_shell(path: str) -> str:
    """为 shell 命令引用路径

    处理路径中的空格和特殊字符。

    Args:
        path: 要引用的路径

    Returns:
        适合 shell 使用的引用路径
    """
    if not path:
        return path

    # 如果路径包含空格或特殊字符，添加引号
    if " " in path or "(" in path or ")" in path:
        if os.name == "nt":
            return f'"{path}"'
        else:
            # Unix shell 使用单引号更安全
            return f"'{path}'"

    return path


def join_path(*parts: str) -> str:
    """跨平台路径连接

    Args:
        *parts: 路径部分

    Returns:
        连接后的路径
    """
    return str(Path(*parts))


def ensure_absolute_path(path: str, base_dir: Optional[str] = None) -> str:
    """确保路径是绝对路径

    如果路径是相对路径，则相对于 base_dir 转换为绝对路径。

    Args:
        path: 要检查的路径
        base_dir: 基础目录（默认为当前工作目录）

    Returns:
        绝对路径
    """
    if not path:
        return path

    p = Path(path)
    if p.is_absolute():
        return str(p)

    if base_dir is None:
        base_dir = os.getcwd()

    return str(Path(base_dir) / p)


# ============================================================
# 进程管理相关工具函数
# ============================================================


# 模块级 logger
logger = logging.getLogger(__name__)


def get_process_create_kwargs() -> Dict[str, Any]:
    """获取 asyncio.create_subprocess_exec 的平台特定参数

    Windows:
        - 防止控制台窗口弹出 (CREATE_NO_WINDOW)
        - 使用 STARTUPINFO 配置窗口

    Linux/macOS:
        - 创建新会话 (start_new_session=True)
        - 关闭继承的文件描述符 (close_fds=True)

    Returns:
        传递给 asyncio.create_subprocess_exec 的 kwargs
    """
    if sys.platform == "win32":
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        return {
            "startupinfo": startupinfo,
            "creationflags": subprocess.CREATE_NO_WINDOW,
        }
    else:
        return {
            "start_new_session": True,
            "close_fds": True,
        }


async def terminate_process(proc: asyncio.subprocess.Process, timeout: int = 5) -> bool:
    """
    终止进程（包括子进程）

    Windows:
        使用 taskkill /T /F 终止整个进程树

    Linux/macOS:
        1. 发送 SIGTERM 到进程组
        2. 等待超时
        3. 发送 SIGKILL 强制终止

    Args:
        proc: 要终止的进程
        timeout: 等待 SIGTERM 的超时时间（秒）

    Returns:
        True 如果进程成功终止，False 如果进程已不存在
    """
    if proc.returncode is not None:
        # 进程已结束
        return False

    if sys.platform == "win32":
        return await _terminate_process_windows(proc)
    else:
        return await _terminate_process_unix(proc, timeout)


async def _terminate_process_windows(proc: asyncio.subprocess.Process) -> bool:
    """Windows: 使用 taskkill 终止进程树"""
    try:
        logger.debug(f"Terminating process tree for PID {proc.pid}")

        kill_proc = await asyncio.create_subprocess_exec(
            "taskkill",
            "/T",  # 终止子进程树
            "/F",  # 强制终止
            "/PID", str(proc.pid),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        await kill_proc.wait()
        await proc.wait()

        logger.debug(f"Process tree for PID {proc.pid} terminated")
        return True
    except Exception as e:
        logger.error(f"Error terminating Windows process tree: {e}")
        return False


async def _terminate_process_unix(proc: asyncio.subprocess.Process, timeout: int = 5) -> bool:
    """Linux/macOS: 使用进程组信号终止"""
    try:
        pgid = os.getpgid(proc.pid)
        logger.debug(f"Sending SIGTERM to process group {pgid}")
        os.killpg(pgid, signal.SIGTERM)

        # 等待优雅终止
        try:
            await asyncio.wait_for(proc.wait(), timeout=timeout)
            logger.debug(f"Process {proc.pid} terminated gracefully")
            return True
        except asyncio.TimeoutError:
            # 强制终止
            logger.debug(f"Sending SIGKILL to process group {pgid}")
            os.killpg(pgid, signal.SIGKILL)
            await proc.wait()
            return True
    except ProcessLookupError:
        logger.debug(f"Process {proc.pid} already terminated")
        return False
    except Exception as e:
        logger.error(f"Error terminating Unix process: {e}")
        return False
