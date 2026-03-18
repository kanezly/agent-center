"""跨平台进程注册表 - 跟踪和管理异步子进程。

提供单例模式的进程注册表，用于跟踪所有运行的子进程，
支持通过 task_id 查找并终止对应的进程。
"""

import asyncio
import logging
from typing import Dict, Optional

from .platform import terminate_process

logger = logging.getLogger(__name__)


class ProcessRegistry:
    """进程注册表 - 单例模式。

    用于跟踪所有运行的子进程，支持通过 task_id 查找并终止对应的进程。

    使用示例:
        registry = ProcessRegistry()
        registry.register(task_id, proc)
        await registry.terminate(task_id)
    """

    _instance: Optional["ProcessRegistry"] = None

    def __new__(cls) -> "ProcessRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._processes: Dict[int, asyncio.subprocess.Process] = {}
            cls._instance._lock = asyncio.Lock()
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        """重置单例实例（用于测试）。"""
        cls._instance = None

    def register(self, task_id: int, proc: asyncio.subprocess.Process) -> None:
        """注册一个进程。

        Args:
            task_id: 任务 ID
            proc: 异步子进程对象
        """
        self._processes[task_id] = proc
        logger.debug(f"[Task {task_id}] Process registered: PID={proc.pid}")

    def unregister(self, task_id: int) -> None:
        """注销一个进程。

        Args:
            task_id: 任务 ID
        """
        proc = self._processes.pop(task_id, None)
        if proc:
            logger.debug(f"[Task {task_id}] Process unregistered: PID={proc.pid}")

    def get(self, task_id: int) -> Optional[asyncio.subprocess.Process]:
        """获取注册的进程。

        Args:
            task_id: 任务 ID

        Returns:
            进程对象，如果未找到则返回 None
        """
        return self._processes.get(task_id)

    def is_running(self, task_id: int) -> bool:
        """检查进程是否正在运行。

        Args:
            task_id: 任务 ID

        Returns:
            True 如果进程已注册且正在运行
        """
        proc = self._processes.get(task_id)
        if proc is None:
            return False
        # 检查进程是否已结束
        return proc.returncode is None

    async def terminate(self, task_id: int) -> bool:
        """终止注册的进程。

        Args:
            task_id: 任务 ID

        Returns:
            True 如果进程被成功终止，False 如果进程未注册或已终止
        """
        proc = self._processes.pop(task_id, None)
        if proc is None:
            logger.debug(f"[Task {task_id}] No process registered, nothing to terminate")
            return False

        if proc.returncode is not None:
            logger.debug(f"[Task {task_id}] Process already finished (returncode={proc.returncode})")
            return False

        try:
            logger.info(f"[Task {task_id}] Terminating process PID={proc.pid}")
            success = await terminate_process(proc)
            if success:
                logger.info(f"[Task {task_id}] Process terminated successfully")
            else:
                logger.warning(f"[Task {task_id}] Process termination returned False")
            return success
        except Exception as e:
            logger.error(f"[Task {task_id}] Failed to terminate process: {e}")
            return False

    async def terminate_all(self) -> Dict[int, bool]:
        """终止所有注册的进程。

        Returns:
            字典，key 为 task_id，value 为终止是否成功
        """
        results = {}
        task_ids = list(self._processes.keys())

        for task_id in task_ids:
            success = await self.terminate(task_id)
            results[task_id] = success

        return results

    def list_processes(self) -> Dict[int, int]:
        """列出所有注册的进程。

        Returns:
            字典，key 为 task_id，value 为 PID
        """
        return {task_id: proc.pid for task_id, proc in self._processes.items()}
