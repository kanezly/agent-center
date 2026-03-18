"""subprocess_manager 模块的单元测试"""

import pytest
import asyncio
import sys
import os

from utils.subprocess_manager import (
    run_process,
    ProcessResult,
)


@pytest.mark.asyncio
async def test_successful_command():
    """测试成功执行的命令"""
    if sys.platform == "win32":
        result = await run_process(
            args=["cmd", "/c", "echo", "hello"],
            cwd=os.getcwd(),
            timeout=10,
        )
    else:
        result = await run_process(
            args=["echo", "hello"],
            cwd=os.getcwd(),
            timeout=10,
        )

    assert result.returncode == 0
    assert "hello" in result.stdout
    assert result.timed_out is False


@pytest.mark.asyncio
async def test_timeout():
    """测试超时机制"""
    if sys.platform == "win32":
        # Windows: 使用 ping 命令模拟延迟
        result = await run_process(
            args=["ping", "-n", "10", "127.0.0.1"],
            cwd=os.getcwd(),
            timeout=2,
        )
    else:
        # Linux/macOS: 使用 sleep 命令
        result = await run_process(
            args=["sleep", "10"],
            cwd=os.getcwd(),
            timeout=1,
        )

    assert result.timed_out is True
    assert result.returncode == -1


@pytest.mark.asyncio
async def test_stderr_capture():
    """测试 stderr 捕获"""
    if sys.platform == "win32":
        result = await run_process(
            args=["cmd", "/c", "echo", "error", ">&2"],
            cwd=os.getcwd(),
            timeout=10,
        )
    else:
        result = await run_process(
            args=["sh", "-c", "echo error >&2"],
            cwd=os.getcwd(),
            timeout=10,
        )

    assert result.returncode == 0
    assert "error" in result.stderr


@pytest.mark.asyncio
async def test_nonexistent_command():
    """测试不存在的命令"""
    if sys.platform == "win32":
        result = await run_process(
            args=["nonexistent_command_xyz_123"],
            cwd=os.getcwd(),
            timeout=10,
        )
        assert result.returncode != 0
    else:
        result = await run_process(
            args=["nonexistent_command_xyz_123"],
            cwd=os.getcwd(),
            timeout=10,
        )
        assert result.returncode != 0

    assert result.timed_out is False
