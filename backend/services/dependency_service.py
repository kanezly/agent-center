"""Task dependency service - manages task-to-task dependencies."""

from typing import List, Optional, Set, Callable
import logging

from db import fetch_one, fetch_all, execute

logger = logging.getLogger(__name__)


class DependencyService:
    """Service for managing task dependencies."""

    def __init__(self, db):
        self.db = db

    async def check_circular_dependency(self, task_id: int, depends_on_ids: List[int]) -> bool:
        """检测是否会形成循环依赖，返回 True 表示有循环"""
        if not depends_on_ids:
            return False
        if task_id in depends_on_ids:
            return True

        # 构建依赖图
        existing = await fetch_all("SELECT task_id, depends_on_task_id FROM task_dependencies")
        graph = {}
        for row in existing:
            tid, dep = row["task_id"], row["depends_on_task_id"]
            graph.setdefault(tid, []).append(dep)

        # 添加待添加的依赖
        graph.setdefault(task_id, []).extend(depends_on_ids)

        # DFS 检测循环
        def can_reach(start: int, target: int, visited: Set[int]) -> bool:
            if start == target:
                return True
            if start in visited:
                return False
            visited.add(start)
            for dep in graph.get(start, []):
                if can_reach(dep, target, visited):
                    return True
            return False

        for dep_id in depends_on_ids:
            if can_reach(dep_id, task_id, set()):
                return True
        return False

    async def add_dependency(self, task_id: int, depends_on_task_id: int):
        """添加单个依赖关系"""
        await execute(
            "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)",
            (task_id, depends_on_task_id)
        )

    async def add_dependencies(self, task_id: int, depends_on_ids: List[int]):
        """添加多个依赖关系"""
        for dep_id in depends_on_ids:
            await self.add_dependency(task_id, dep_id)

    async def get_dependencies(self, task_id: int) -> List[int]:
        """获取任务依赖的前序任务 ID 列表"""
        rows = await fetch_all(
            "SELECT depends_on_task_id FROM task_dependencies WHERE task_id=? ORDER BY id",
            (task_id,)
        )
        return [r["depends_on_task_id"] for r in rows]

    async def get_dependent_tasks(self, task_id: int) -> List[int]:
        """获取依赖当前任务的后置任务 ID 列表"""
        rows = await fetch_all(
            "SELECT task_id FROM task_dependencies WHERE depends_on_task_id=?",
            (task_id,)
        )
        return [r["task_id"] for r in rows]

    async def can_task_start(self, task_id: int) -> bool:
        """检查任务是否可以开始：所有前序依赖必须是 completed/failed/cancelled"""
        deps = await self.get_dependencies(task_id)
        if not deps:
            return True

        # 获取所有依赖任务的状态
        placeholders = ",".join("?" * len(deps))
        rows = await fetch_all(
            f"SELECT id, status FROM tasks WHERE id IN ({placeholders})",
            deps
        )

        # 终端状态：只有 completed/failed/cancelled 才能触发后置任务
        # reviewing 是待检视状态，可能被驳回重新执行，不算终端状态
        terminal_statuses = {'completed', 'failed', 'cancelled'}
        return all(row["status"] in terminal_statuses for row in rows)

    async def trigger_dependent_tasks(self, task_id: int, notify_scheduler: Optional[Callable] = None):
        """当前置任务完成时，触发后置任务检查"""
        dependent_ids = await self.get_dependent_tasks(task_id)
        for dep_task_id in dependent_ids:
            if await self.can_task_start(dep_task_id):
                task = await fetch_one("SELECT status FROM tasks WHERE id=?", (dep_task_id,))
                if task and task["status"] == "pending":
                    await execute("UPDATE tasks SET status='queued' WHERE id=?", (dep_task_id,))
                    logger.info(f"Dependency satisfied: task {dep_task_id} moved from pending to queued")
                    if notify_scheduler:
                        notify_scheduler()
