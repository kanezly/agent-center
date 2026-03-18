"""跨平台 subprocess 管理工具

提供统一的异步 subprocess 管理接口，自动适配 Windows 和 Linux 平台差异。

使用示例:
    result = await run_process(
        args=["claude", "-p", "hello"],
        cwd="/path/to/workdir",
        timeout=3600,
    )
"""

import asyncio
import sys
import os
import subprocess
import logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

from .platform import get_process_create_kwargs, terminate_process

logger = logging.getLogger(__name__)


@dataclass
class ProcessResult:
    """进程执行结果"""
    returncode: int
    stdout: str = ""
    stderr: str = ""
    timed_out: bool = False


async def run_process(
    args: List[str],
    cwd: str,
    env: Optional[Dict[str, str]] = None,
    timeout: Optional[int] = None,
) -> ProcessResult:
    """
    运行进程并捕获输出

    Args:
        args: 命令行参数列表
        cwd: 工作目录
        env: 环境变量
        timeout: 超时时间（秒）

    Returns:
        ProcessResult 包含返回码和输出

    使用示例:
        result = await run_process(
            args=["claude", "-p", "hello"],
            cwd="/path/to/workdir",
            timeout=3600,
        )
    """
    try:
        # 创建进程
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
            env=env,
            **get_process_create_kwargs()
        )

        logger.debug(f"Process started with PID {proc.pid}")

        # 创建读取任务
        stdout_task = asyncio.create_task(_read_stream(proc.stdout))
        stderr_task = asyncio.create_task(_read_stream(proc.stderr))

        # 等待进程完成（带超时）
        timed_out = False
        try:
            if timeout:
                await asyncio.wait_for(proc.wait(), timeout=timeout)
            else:
                await proc.wait()

            # 等待读取完成
            stdout, stderr = await asyncio.gather(stdout_task, stderr_task)

            logger.info(f"Process completed with returncode {proc.returncode}")

            return ProcessResult(
                returncode=proc.returncode,
                stdout=stdout,
                stderr=stderr,
            )

        except asyncio.TimeoutError:
            # 超时：终止进程
            logger.error(f"Process timed out after {timeout}s")
            await terminate_process(proc)

            # 获取已读取的输出
            stdout = await _get_task_result(stdout_task)
            stderr = await _get_task_result(stderr_task)

            return ProcessResult(
                returncode=-1,
                stdout=stdout,
                stderr=stderr,
                timed_out=True,
            )

    except FileNotFoundError as e:
        # 命令不存在
        logger.error(f"Command not found: {args[0]}")
        return ProcessResult(
            returncode=127,
            stderr=f"Command not found: {args[0]}",
        )
    except Exception as e:
        # 其他错误
        logger.exception(f"Process error: {e}")
        return ProcessResult(
            returncode=1,
            stderr=str(e),
        )


async def _read_stream(stream: asyncio.StreamReader) -> str:
    """异步读取流的所有内容"""
    lines = []
    try:
        while True:
            line = await stream.readline()
            if not line:
                break
            decoded = line.decode('utf-8', errors='replace').rstrip()
            if decoded:  # 跳过空行
                lines.append(decoded)
    except Exception as e:
        logger.warning(f"Stream read error: {e}")
    return "\n".join(lines)


async def _get_task_result(task: asyncio.Task) -> str:
    """
    获取任务结果，如果任务未完成则返回已读取的部分
    """
    if task.done():
        return task.result()
    try:
        return await asyncio.wait_for(task, timeout=2)
    except asyncio.TimeoutError:
        return ""
