"""Task service - business logic for task management."""

from typing import Optional, List, Dict, Any, Callable
import logging
import asyncio
import os
import shutil
from datetime import datetime

import aiosqlite

from db import fetch_one, fetch_all, execute

logger = logging.getLogger(__name__)


class TaskService:
    """Service for task management operations."""

    def __init__(self, db: aiosqlite.Connection):
        self.db = db

    async def create_task(
        self,
        prompt: str,
        priority: int = 0,
        mode: str = "execute",
        cwd: Optional[str] = None,
        inject_experience: Optional[str] = None,
        depends_on_task_ids: Optional[List[int]] = None,
        fork_from_task_id: Optional[int] = None,
        project_id: Optional[int] = None,
        is_isolated: Optional[bool] = None,  # 新增参数
        auto_approve: Optional[bool] = None,  # 新增参数
    ) -> int:
        """Create a new task.

        Args:
            prompt: Task prompt
            priority: Task priority (higher = more urgent)
            mode: "execute" or "plan"
            cwd: Working directory
            inject_experience: Optional experience context to prepend
            depends_on_task_ids: Optional list of task IDs this task depends on
            fork_from_task_id: Optional task ID to fork context from
            project_id: Optional project ID this task belongs to
            is_isolated: Whether to isolate task in a git worktree (default: False)

        Returns:
            Created task ID
        """
        final_prompt = prompt
        if inject_experience:
            final_prompt = f"{inject_experience}\n\n---\n\n{prompt}"

        # 处理 fork 任务的逻辑
        if fork_from_task_id:
            fork_task = await fetch_one(
                "SELECT session_id, project_id FROM tasks WHERE id=?",
                (fork_from_task_id,)
            )
            if not fork_task:
                raise ValueError(f"Fork task {fork_from_task_id} not found")
            if not fork_task.get("session_id"):
                raise ValueError(f"Fork task {fork_from_task_id} has no session_id to fork")

            # 如果未指定项目，自动继承 fork 任务的项目
            if project_id is None and fork_task.get("project_id"):
                project_id = fork_task["project_id"]
                logger.info(f"Task: Inherited project_id={project_id} from fork task {fork_from_task_id}")

            # 如果已指定项目，验证一致性
            if project_id is not None and fork_task.get("project_id") != project_id:
                raise ValueError(f"Cannot fork task from different project (fork task project_id={fork_task.get('project_id')}, current project_id={project_id})")

        # 生成当前本地时间戳（ISO 格式），避免 SQLite datetime('now', 'localtime') 时区问题
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # 插入时保存 is_isolated 和 auto_approve（SQLite 中 BOOLEAN 用 INTEGER 表示，None 转为 0）
        task_id = await execute(
            "INSERT INTO tasks (prompt, priority, mode, cwd, fork_from_task_id, project_id, is_isolated, auto_approve, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (final_prompt, priority, mode, cwd, fork_from_task_id, project_id, 1 if is_isolated else 0, 1 if auto_approve else 0, created_at),
        )
        logger.info(f"Task {task_id} created with mode={mode}, fork_from_task_id={fork_from_task_id}, project_id={project_id}, is_isolated={is_isolated}, auto_approve={auto_approve}")

        # Handle dependencies
        if depends_on_task_ids:
            from services.dependency_service import DependencyService
            dep_service = DependencyService(self.db)

            # Check for circular dependencies
            if await dep_service.check_circular_dependency(task_id, depends_on_task_ids):
                raise ValueError("Circular dependency detected")

            await dep_service.add_dependencies(task_id, depends_on_task_ids)

            # Check if all dependencies are completed
            if not await dep_service.can_task_start(task_id):
                await execute("UPDATE tasks SET status='pending' WHERE id=?", (task_id,))
                logger.info(f"Task {task_id} set to pending, waiting for dependencies")

        return task_id

    async def get_task(self, task_id: int) -> Optional[Dict[str, Any]]:
        """Get a single task by ID."""
        return await fetch_one("SELECT * FROM tasks WHERE id=?", (task_id,))

    async def list_tasks(
        self,
        status: Optional[str] = None,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """List tasks with optional filtering."""
        # 使用子查询获取第一条对话的 user_prompt（初始指令）
        base_query = """
            SELECT
                t.id,
                (SELECT tc.user_prompt FROM task_conversations tc
                 WHERE tc.task_id = t.id ORDER BY tc.round_number ASC LIMIT 1)
                    as initial_prompt,
                t.prompt, t.status, t.mode, t.priority,
                t.worktree_id, t.created_at,
                t.started_at, t.finished_at, t.cost_usd
            FROM tasks t
        """

        if status:
            query = f"{base_query} WHERE t.status=? ORDER BY t.id DESC"
            params = (status,)
        else:
            query = f"{base_query} ORDER BY t.id DESC"
            params = ()

        if limit:
            query += f" LIMIT {limit} OFFSET {offset}"

        tasks = await fetch_all(query, params)

        # 使用 initial_prompt（第一条指令）作为 prompt_short 的来源
        for t in tasks:
            initial = t.get("initial_prompt") or t["prompt"]
            t["prompt_short"] = initial[:100] if initial else ""

        return tasks

    async def update_status(
        self,
        task_id: int,
        status: str,
        worktree_id: Optional[int] = None,
    ) -> bool:
        """Update task status."""
        if worktree_id is not None:
            await execute(
                "UPDATE tasks SET status=?, worktree_id=? WHERE id=?",
                (status, worktree_id, task_id),
            )
        else:
            await execute("UPDATE tasks SET status=? WHERE id=?", (status, task_id))
        return True

    async def cancel_task(self, task_id: int) -> Optional[str]:
        """Cancel a task if it's queued or running.

        For isolated tasks with worktrees, also cleans up the worktree.
        """
        task = await self.get_task(task_id)
        if not task:
            return None

        if task["status"] in ("queued", "running"):
            # 如果是 running 状态，先终止 Claude CLI 子进程
            if task["status"] == "running":
                logger.info(f"Task {task_id}: Terminating Claude CLI subprocess")
                from utils.process_registry import ProcessRegistry
                registry = ProcessRegistry()
                await registry.terminate(task_id)

            # 如果是隔离任务且有工作树，先清理 worktree
            if task.get("is_isolated") and task.get("project_id") and task.get("cwd"):
                logger.info(f"Task {task_id}: Cleaning up isolated worktree before cancellation")
                from services.worktree_service import WorktreeService
                worktree_service = WorktreeService(self.db)
                branch_name = f"task-{task_id}"
                await worktree_service.cleanup_worktree(
                    project_id=task["project_id"],
                    task_id=task_id,
                    branch_name=branch_name,
                    worktree_path=task["cwd"],
                )
                # 清除 cwd 引用
                await execute("UPDATE tasks SET cwd=NULL WHERE id=?", (task_id,))

            # 独立隔离任务清理：删除 standalone 目录
            if task.get("is_isolated") and not task.get("project_id") and task.get("cwd") and "standalone-" in task.get("cwd", ""):
                if os.path.exists(task["cwd"]):
                    shutil.rmtree(task["cwd"])
                    logger.info(f"Task {task_id}: Cleaned up standalone directory on cancel")
                    await execute("UPDATE tasks SET cwd=NULL WHERE id=?", (task_id,))

            await self.update_status(task_id, "cancelled")
            logger.info(f"Task {task_id} cancelled")

            # 任务取消时触发依赖任务检查
            from services.dependency_service import DependencyService
            dep_service = DependencyService(self.db)

            def notify_scheduler():
                import app
                if app.scheduler:
                    app.scheduler.notify()

            await dep_service.trigger_dependent_tasks(task_id, notify_scheduler)

            return "cancelled"

        return task["status"]

    async def get_next_queued(self) -> Optional[Dict[str, Any]]:
        """Get the next queued task by priority."""
        return await fetch_one(
            "SELECT * FROM tasks WHERE status='queued' ORDER BY priority DESC, id ASC LIMIT 1"
        )

    async def get_task_counts_by_status(self) -> Dict[str, int]:
        """Get task counts grouped by status."""
        rows = await fetch_all("SELECT status, COUNT(*) as count FROM tasks GROUP BY status")
        return {row["status"]: row["count"] for row in rows}

    async def approve_task(self, task_id: int, notify_scheduler: Optional[Callable] = None) -> bool:
        """用户批准任务完成（reviewing → completed），执行后处理流程并清理工作树

        返回 True 表示批准已接受（后处理在后台执行），返回 False 表示批准失败
        """
        task = await self.get_task(task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        if task["status"] != "reviewing":
            raise ValueError(f"Task {task_id} is not in reviewing status (current: {task['status']})")

        # 原子性地更新状态为 post_processing，防止重复批准
        # 如果返回值为 0，说明没有行被更新（可能已被其他请求处理）
        from db import get_connection
        conn = get_connection()
        cursor = await conn.cursor()
        await cursor.execute(
            "UPDATE tasks SET status='post_processing' WHERE id=? AND status='reviewing'",
            (task_id,)
        )
        if cursor.rowcount == 0:
            logger.warning(f"Task {task_id}: Approve request ignored (task no longer in reviewing status)")
            return False

        logger.info(f"Task {task_id}: Status set to 'post_processing' (code merging in progress)")

        # 广播 post_processing 状态，让前端立即显示"代码合并中"
        from app import manager
        await manager.broadcast_global("task_updated", {
            "id": task_id,
            "status": "post_processing",
            "message": "代码合并中..."
        })

        # 启动后台任务执行后处理（不阻塞当前请求）
        # 注意：后处理任务在后台运行，完成后会更新状态为 completed 或 reviewing
        asyncio.create_task(self._run_post_process_background(task_id, task.copy()))

        return True

    async def _run_post_process_background(self, task_id: int, task_snapshot: dict) -> None:
        """后台执行后处理流程（不阻塞 API 请求）"""
        try:
            # 隔离任务：执行后处理流程（resume session 执行 merge 和清理）
            if task_snapshot.get("is_isolated") and task_snapshot.get("project_id") and task_snapshot.get("cwd") and task_snapshot.get("session_id"):
                from scheduler.loop import run_post_process
                from db import fetch_one as db_fetch_one
                from app import manager

                # 获取项目路径（主目录）
                project = await db_fetch_one("SELECT * FROM projects WHERE id=?", (task_snapshot["project_id"],))
                if not project:
                    logger.error(f"Task {task_id}: Project {task_snapshot['project_id']} not found")
                    # 恢复状态
                    await execute("UPDATE tasks SET status='reviewing' WHERE id=?", (task_id,))
                    return

                logger.info(f"Task {task_id}: Running post-process for user-approved isolated task")
                success, msg = await run_post_process(
                    task_id=task_id,
                    session_id=task_snapshot["session_id"],
                    worktree_path=task_snapshot["cwd"],
                    branch_name=f"task-{task_id}",
                    main_project_path=project["path"],
                    broadcast_global=manager.broadcast_global,
                )

                if not success:
                    logger.error(f"Task {task_id}: Post-process failed: {msg}")
                    # 后处理失败，恢复状态让用户重试
                    await execute("UPDATE tasks SET status='reviewing' WHERE id=?", (task_id,))
                    # 广播失败状态
                    await manager.broadcast_global("task_updated", {
                        "id": task_id,
                        "status": "reviewing",
                        "reason": "post_process_failed",
                        "message": msg
                    })
                    return

                logger.info(f"Task {task_id}: Post-process completed successfully")

            # 更新状态为 completed
            await execute("UPDATE tasks SET status='completed' WHERE id=?", (task_id,))

            # 独立隔离任务清理：删除 standalone 目录
            # 注意：task_snapshot 是方法开始时保存的，可能不包含最新 cwd
            if not task_snapshot.get("project_id") and task_snapshot.get("cwd") and "standalone-" in task_snapshot.get("cwd", ""):
                if os.path.exists(task_snapshot["cwd"]):
                    shutil.rmtree(task_snapshot["cwd"])
                    logger.info(f"Task {task_id}: Cleaned up standalone directory on complete")

            # 清理 cwd 引用
            await execute("UPDATE tasks SET cwd=NULL WHERE id=?", (task_id,))
            logger.info(f"Task {task_id} approved (reviewing → completed)")

            # 触发依赖任务
            from services.dependency_service import DependencyService
            dep_service = DependencyService(self.db)

            def notify_scheduler():
                import app
                if app.scheduler:
                    app.scheduler.notify()

            await dep_service.trigger_dependent_tasks(task_id, notify_scheduler)

            # 广播完成状态
            from app import manager
            await manager.broadcast_global("task_updated", {
                "id": task_id,
                "status": "completed",
                "type": "execute"
            })

        except Exception as e:
            logger.exception(f"Task {task_id}: Background post-process failed: {e}")
            # 异常时恢复状态
            await execute("UPDATE tasks SET status='reviewing' WHERE id=?", (task_id,))
            from app import manager
            await manager.broadcast_global("task_updated", {
                "id": task_id,
                "status": "reviewing",
                "reason": "error",
                "message": str(e)
            })

    async def continue_task(
        self,
        task_id: int,
        new_prompt: str,
        notify_scheduler: Optional[Callable] = None
    ) -> bool:
        """用户输入新命令继续执行原任务（reviewing → queued），记录当前轮次对话"""
        task = await self.get_task(task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        if task["status"] != "reviewing":
            raise ValueError(f"Task {task_id} is not in reviewing status (current: {task['status']})")

        old_prompt = task.get("prompt", "")
        session_id = task.get("session_id")
        current_round = task.get("round_number", 1) or 1

        # 检查是否已有当前轮次的对话记录，避免重复
        # 注意：fetch_one 至少返回一行，所以只需检查 cnt 是否为 0
        existing = await fetch_one(
            "SELECT COUNT(*) as cnt FROM task_conversations WHERE task_id=? AND round_number=?",
            (task_id, current_round)
        )

        # 将当前的 prompt 和 result 作为一轮对话保存到 task_conversations
        # 使用当前 round_number，这是已完成轮次的编号
        if existing.get("cnt", 0) == 0:
            await execute("""
                INSERT INTO task_conversations
                (task_id, round_number, user_prompt, session_id, created_at,
                 started_at, finished_at, cost_usd, result_text)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                task_id,
                current_round,  # 使用当前已完成的轮次编号
                old_prompt,
                session_id,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),  # created_at 使用本地时间
                task.get("started_at"),
                task.get("finished_at"),
                task.get("cost_usd", 0),
                task.get("result_text")  # 存储完整结果
            ))
            logger.info(f"Task {task_id}: Recorded conversation for round {current_round}")
        else:
            logger.info(f"Task {task_id}: Conversation for round {current_round} already exists, skipping duplicate")

        # 更新任务状态为新轮次
        new_round = current_round + 1
        await execute("""
            UPDATE tasks SET
                status='queued',
                prompt=?,
                round_number=?,
                started_at=NULL,
                finished_at=NULL,
                cost_usd=0,
                result_text=NULL,
                session_id=?
            WHERE id=?
        """, (new_prompt, new_round, session_id, task_id))

        logger.info(f"Task {task_id} continued with new prompt (round {new_round})")

        if notify_scheduler:
            notify_scheduler()

        return True
