"""信号处理工具 - 仅 Linux/macOS 使用

提供优雅的信号处理，支持 SIGTERM 和 SIGINT 信号，
确保应用收到信号后能够正确清理资源并退出。

使用示例:
    from utils.signals import get_signal_handler

    # 在应用启动时安装信号处理器
    signal_handler = get_signal_handler()
    signal_handler.install()

    # 注册清理回调
    signal_handler.register_cleanup(cleanup_function)

    # 在应用关闭时卸载
    signal_handler.uninstall()
"""

import asyncio
import signal
import logging
import sys
import os
from typing import Callable, List, Optional

logger = logging.getLogger(__name__)


class SignalHandler:
    """优雅的信号处理器

    功能：
    - 注册 SIGTERM 和 SIGINT 信号处理
    - 支持多个清理回调
    - 优雅关闭（等待清理完成）

    注意：
        Windows 不支持 asyncio 的信号处理，会降级为日志警告
    """

    def __init__(self):
        self._shutdown_event = asyncio.Event()
        self._cleanup_callbacks: List[Callable] = []
        self._running = False
        self._shutdown_initiated = False

    def register_cleanup(self, callback: Callable) -> None:
        """注册清理回调

        Args:
            callback: 清理函数，可以是普通函数或 async 函数
        """
        self._cleanup_callbacks.append(callback)
        logger.debug(f"Registered cleanup callback: {callback}")

    @property
    def shutdown_event(self) -> asyncio.Event:
        """返回关闭事件

        可用于等待关闭完成：
            await signal_handler.shutdown_event.wait()
        """
        return self._shutdown_event

    @property
    def is_running(self) -> bool:
        """返回信号处理器是否正在运行"""
        return self._running

    @property
    def is_shutting_down(self) -> bool:
        """返回是否正在关闭中"""
        return self._shutdown_initiated

    def install(self) -> None:
        """安装信号处理器

        在 Linux/macOS 上注册 SIGTERM 和 SIGINT 信号处理。
        在 Windows 上仅记录警告，不进行任何操作。
        """
        if sys.platform == "win32":
            # Windows 不支持 asyncio 的信号处理
            logger.warning("Signal handling is limited on Windows - using basic handling only")
            # Windows 下设置事件，但不注册信号处理器
            self._running = True
            return

        loop = asyncio.get_event_loop()

        # 注册信号处理器
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(
                sig,
                lambda s=sig: asyncio.create_task(self._handle_signal(s))
            )

        self._running = True
        logger.info(f"Signal handlers installed for SIGTERM and SIGINT (PID: {os.getpid()})")

    async def _handle_signal(self, sig: signal.Signals) -> None:
        """处理信号

        Args:
            sig: 接收到的信号
        """
        if self._shutdown_initiated:
            # 已经在关闭中，忽略重复信号
            logger.debug(f"Ignoring duplicate signal {sig.name}")
            return

        logger.info(f"Received signal {sig.name}, initiating graceful shutdown...")
        self._shutdown_initiated = True

        # 执行所有清理回调
        cleanup_tasks = []
        for i, callback in enumerate(self._cleanup_callbacks):
            try:
                logger.debug(f"Executing cleanup callback {i+1}/{len(self._cleanup_callbacks)}")
                if asyncio.iscoroutinefunction(callback):
                    task = asyncio.create_task(callback())
                    cleanup_tasks.append(task)
                else:
                    # 同步回调，在线程池中执行
                    loop = asyncio.get_event_loop()
                    task = loop.run_in_executor(None, callback)
                    cleanup_tasks.append(task)
            except Exception as e:
                logger.error(f"Error starting cleanup callback {i+1}: {e}")

        # 等待所有清理完成（带超时）
        if cleanup_tasks:
            try:
                await asyncio.wait_for(
                    asyncio.gather(*cleanup_tasks, return_exceptions=True),
                    timeout=30  # 30 秒超时
                )
            except asyncio.TimeoutError:
                logger.warning("Cleanup timed out, some callbacks may not have completed")
            except Exception as e:
                logger.error(f"Error during cleanup: {e}")

        # 设置关闭事件
        self._shutdown_event.set()
        logger.info("Graceful shutdown completed")

    def uninstall(self) -> None:
        """卸载信号处理器

        在 Linux/macOS 上移除信号处理。
        在 Windows 上仅更新状态。
        """
        if sys.platform == "win32":
            self._running = False
            logger.debug("Signal handling disabled")
            return

        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.remove_signal_handler(sig)

        self._running = False
        logger.info("Signal handlers uninstalled")


# 全局信号处理器实例
_signal_handler: Optional[SignalHandler] = None


def get_signal_handler() -> SignalHandler:
    """获取全局信号处理器

    Returns:
        全局 SignalHandler 实例（单例）
    """
    global _signal_handler
    if _signal_handler is None:
        _signal_handler = SignalHandler()
    return _signal_handler


