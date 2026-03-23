"""Ralph Loop scheduler - central dispatcher with worktree management."""

from typing import Optional, Dict, List, Callable, Awaitable

import asyncio
import logging
import os

from db import fetch_one, fetch_all, execute, get_connection
from services.agent_runner import execute_agent, run_post_process
from services.agent import AgentRegistry, AgentConfig
from services.worktree_service import create_worktree
from utils.platform import get_process_create_kwargs, terminate_process
from config import settings
from .worker import Worker

logger = logging.getLogger(__name__)

EXECUTE_SYSTEM_PROMPT = """执行无需用户交互的一镜到底任务。全程不主动发起交互，仅在任务完成后，在最终返回的 result 消息中提交报告，报告内容包括：1) 执行流程与成果（步骤、阶段性目标及达成情况）；2) 遇到的关键问题及解决方案（可选）。
"""

PLAN_SYSTEM_PROMPT = """在最终返回的 result 消息中，必须完整包含生成或修改后的计划内容，并清晰列出需要与用户对齐的所有问题。
"""

SYSTEM_PROMPT_MAP = {
    "execute": EXECUTE_SYSTEM_PROMPT,
    "plan": PLAN_SYSTEM_PROMPT,
}


def get_system_prompt_for_task(
    mode: str
) -> str:
    """根据任务模式获取对应的 system prompt。

    Args:
        mode: 任务模式，"execute" 或 "plan"

    Returns:
        对应的 system prompt 字符串
    """
    if mode == "plan":
        return SYSTEM_PROMPT_MAP["plan"]
    elif mode == "execute":
        # 统一使用 execute prompt
        return SYSTEM_PROMPT_MAP["execute"]
    else:
        # 未知模式，返回默认值
        return EXECUTE_SYSTEM_PROMPT


class RalphLoop:
    """Task scheduler with dynamic worktree management."""

    def __init__(
        self,
        max_concurrent: int | None = None,
        broadcast: Optional[Callable[[int, str, dict], Awaitable[None]]] = None,
        broadcast_global: Optional[Callable[[str, dict], Awaitable[None]]] = None,
    ):
        self.max_concurrent = max_concurrent or settings.MAX_CONCURRENT
        self.broadcast = broadcast
        self.broadcast_global = broadcast_global
        self.workers: List[Worker] = [Worker(id=i) for i in range(self.max_concurrent)]
        self._running: Dict[int, asyncio.Task] = {}
        self._wake = asyncio.Event()
        self._stop = False
        self._loop_task: Optional[asyncio.Task] = None

    def start(self) -> None:
        self._stop = False
        self._loop_task = asyncio.create_task(self._loop())
        logger.info(f"Ralph Loop started ({self.max_concurrent} workers)")

    async def stop(self) -> None:
        self._stop = True
        self._wake.set()
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
        if self._running:
            await asyncio.gather(*self._running.values(), return_exceptions=True)
        logger.info("Ralph Loop stopped")

    def notify(self) -> None:
        self._wake.set()

    def get_workers(self) -> List[dict]:
        return [w.to_dict() for w in self.workers]

    async def _loop(self) -> None:
        while not self._stop:
            self._wake.clear()
            await self._cleanup_finished_workers()
            await self._dispatch_tasks()
            await self._broadcast_status()
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                pass

    async def _cleanup_finished_workers(self) -> None:
        for wid, atask in list(self._running.items()):
            if atask.done():
                del self._running[wid]
                self.workers[wid].reset()

    async def _dispatch_tasks(self) -> None:
        for w in self.workers:
            if w.status == "busy" or w.id in self._running:
                continue

            task_row = await fetch_one(
                "SELECT * FROM tasks WHERE status='queued' ORDER BY priority DESC, id ASC LIMIT 1"
            )
            if not task_row:
                break

            task_id = task_row["id"]

            from services.dependency_service import DependencyService
            dep_service = DependencyService(get_connection())
            can_start = await dep_service.can_task_start(task_id)
            if not can_start:
                logger.debug(f"Task {task_id} has unsatisfied dependencies, skipping")
                continue

            # 读取 is_isolated 字段（默认为 false）
            is_isolated = task_row.get("is_isolated", 0) != 0  # 默认 0=false
            project_id = task_row.get("project_id")

            worktree_info = None
            cwd = task_row.get("cwd")
            session_id = task_row.get("session_id")

            if project_id and is_isolated:
                # 检查是否为 Git 项目
                from services.project_service import ProjectService
                project_service = ProjectService(get_connection())
                project = await project_service.get_project(project_id)

                if project and await project_service.is_git_repo(project["path"]):
                    # 创建 worktree
                    logger.info(f"Task {task_id}: Creating worktree for isolated task in git project {project_id}")
                    worktree_info = await create_worktree(project_id, task_id)
                    if worktree_info:
                        cwd = worktree_info["path"]
                        # 添加主目录工作区路径（用于 system prompt）
                        worktree_info["main_project_path"] = project["path"]
                        logger.info(f"Task {task_id}: Created worktree at {cwd} (branch={worktree_info.get('branch')})")
                    else:
                        logger.error(f"Task {task_id}: Failed to create worktree for project {project_id}")
                else:
                    # 非 Git 项目，不创建 worktree
                    logger.info(f"Task {task_id}: Skipping worktree creation for non-git project")
                    worktree_info = None
            elif project_id:
                # 非隔离任务但有 project_id，获取项目路径作为 cwd
                # 注意：非隔离任务不创建 worktree，直接在项目主目录执行
                from services.project_service import ProjectService
                project_service = ProjectService(get_connection())
                project = await project_service.get_project(project_id)

                if project and project.get("path"):
                    cwd = project["path"]
                    logger.info(f"Task {task_id}: Using project path as cwd: {cwd}")
                else:
                    logger.warning(f"Task {task_id}: Project {project_id} not found or has no path")
                worktree_info = None  # 非隔离任务没有 worktree

            if not cwd and not worktree_info:
                logger.warning(f"Task {task_id} has no project_id or cwd, using current directory")
                cwd = None

            # 独立隔离任务：创建 standalone 目录（只是普通文件夹，不是 git worktree）
            if not project_id and is_isolated and not cwd:
                # 获取项目根目录（backend 的父目录）
                backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                project_root = os.path.dirname(backend_root)
                worktrees_dir = os.path.join(project_root, "worktrees")
                standalone_dir = os.path.join(worktrees_dir, f"standalone-{task_id}")
                os.makedirs(worktrees_dir, exist_ok=True)
                os.makedirs(standalone_dir, exist_ok=True)
                cwd = standalone_dir
                logger.info(f"Task {task_id}: Created standalone directory at {cwd}")

            # 更新 cwd 到数据库（包括 standalone 目录和 worktree）
            if cwd or worktree_info:
                await execute(
                    "UPDATE tasks SET cwd=?, plan_status=? WHERE id=?",
                    (cwd, "executing" if task_row.get("mode") == "execute" else task_row.get("plan_status"), task_id),
                )

            await execute("UPDATE tasks SET status='running' WHERE id=?", (task_id,))

            if self.broadcast_global:
                await self.broadcast_global("task_updated", {"id": task_id, "status": "running"})

            w.status = "busy"
            w.task_id = task_id
            w.task_prompt = task_row["prompt"]
            w.worktree_name = worktree_info["branch"] if worktree_info else ""
            w.worktree_id = project_id

            atask = asyncio.create_task(
                self._run_and_release(w, task_id, task_row["prompt"], cwd, worktree_info)
            )
            self._running[w.id] = atask
            logger.info(f"Worker {w.id}: task {task_id} -> {worktree_info['path'] if worktree_info else 'no-wt'}")

    async def _run_and_release(
        self,
        worker: Worker,
        task_id: int,
        prompt: str,
        cwd: Optional[str],
        worktree_info: Optional[dict],
    ) -> None:
        try:
            task_row = await fetch_one("SELECT mode, session_id, project_id, fork_from_task_id, is_isolated FROM tasks WHERE id=?", (task_id,))
            mode = task_row.get("mode", "execute") if task_row else "execute"
            is_isolated = task_row.get("is_isolated", 0) != 0 if task_row else False
            session_id = task_row.get("session_id") if task_row else None
            fork_from_task_id = task_row.get("fork_from_task_id") if task_row else None

            # 获取 fork session ID（如果任务是通过 fork 创建的）
            # 注意：只有当任务自己没有 session_id 时才使用 fork-session
            # 如果任务已经有 session_id（继续执行场景），使用 resume 而不是 fork
            fork_session_id = None
            if fork_from_task_id and not session_id:
                fork_task = await fetch_one(
                    "SELECT session_id FROM tasks WHERE id=?",
                    (fork_from_task_id,)
                )
                if fork_task and fork_task.get("session_id"):
                    fork_session_id = fork_task["session_id"]
                    logger.info(f"Task {task_id}: Forking from task {fork_from_task_id} session={fork_session_id[:20]}...")

            # 准备隔离模式所需的参数
            main_project_path = None
            branch_name = None
            wt_path = None
            if worktree_info:
                main_project_path = worktree_info.get("main_project_path")
                branch_name = worktree_info.get("branch")
                wt_path = worktree_info.get("path")

            # 使用 resume 的场景：
            # 1. 任务有自己的 session_id（继续执行、重试）
            # 使用 fork-session 的场景：
            # 1. 任务是首次执行且是通过 fork 创建的（没有自己的 session_id，但有 fork_from_task_id）

            # 构建 Agent 配置
            agent_config = AgentConfig(
                mode=mode,
                session_id=session_id,
                fork_session_id=fork_session_id,
                system_prompt=get_system_prompt_for_task(mode=mode),
            )

            # 通过统一接口执行 Agent 任务
            status = await execute_agent(
                task_id=task_id,
                prompt=prompt,
                cwd=cwd,
                broadcast=self.broadcast,
                broadcast_global=self.broadcast_global,
                config=agent_config,
            )

            # 只有隔离任务才需要检查 worktree 清理
            if is_isolated and worktree_info and status == "completed" and worktree_info.get("project_id"):
                # 获取 auto_approve 标志
                task_row = await fetch_one("SELECT auto_approve FROM tasks WHERE id=?", (task_id,))
                is_auto_approve = task_row and task_row.get("auto_approve")

                if is_auto_approve:
                    # 验证必需参数
                    if not worktree_info.get("main_project_path"):
                        logger.error(f"Task {task_id}: main_project_path is missing - this is required for post-process merge")
                        # 恢复状态，等待用户手动处理
                        await execute("UPDATE tasks SET status='reviewing' WHERE id=?", (task_id,))
                        if self.broadcast_global:
                            await self.broadcast_global("task_updated", {
                                "id": task_id,
                                "status": "reviewing",
                                "reason": "missing_main_project_path",
                                "message": "项目路径丢失，无法执行后处理合并"
                            })
                        return

                    # 重新从数据库查询 session_id（因为 run_claude_task 执行后才保存 session_id）
                    task_after_run = await fetch_one("SELECT session_id FROM tasks WHERE id=?", (task_id,))
                    current_session_id = task_after_run.get("session_id") if task_after_run else None
                    if not current_session_id:
                        logger.error(f"Task {task_id}: session_id is missing after run_claude_task")
                        await execute("UPDATE tasks SET status='reviewing' WHERE id=?", (task_id,))
                        if self.broadcast_global:
                            await self.broadcast_global("task_updated", {
                                "id": task_id,
                                "status": "reviewing",
                                "reason": "missing_session_id",
                                "message": "session_id 丢失，无法执行后处理"
                            })
                        return

                    # 自动批准：执行后处理流程（resume session 执行 merge 和清理）
                    # 先更新数据库状态为 post_processing（run_post_process 会广播该状态）
                    await execute("UPDATE tasks SET status='post_processing' WHERE id=?", (task_id,))

                    logger.info(f"Task {task_id}: Running post-process for auto-approved isolated task")
                    # 获取 Agent 实例用于后处理
                    agent = AgentRegistry.get(settings.AGENT_BACKEND)

                    success, msg = await run_post_process(
                        agent=agent,
                        task_id=task_id,
                        session_id=current_session_id,
                        worktree_path=worktree_info["path"],
                        branch_name=worktree_info["branch"],
                        main_project_path=worktree_info["main_project_path"],
                        broadcast_global=self.broadcast_global,
                    )
                    if success:
                        logger.info(f"Task {task_id}: Post-process completed successfully")
                        await execute("UPDATE tasks SET cwd=NULL, plan_status='completed' WHERE id=?", (task_id,))
                        await execute("UPDATE tasks SET status='completed' WHERE id=?", (task_id,))
                        if self.broadcast_global:
                            await self.broadcast_global("task_updated", {"id": task_id, "status": "completed"})
                    else:
                        logger.error(f"Task {task_id}: Post-process failed: {msg}")
                        await execute("UPDATE tasks SET status='reviewing' WHERE id=?", (task_id,))
                        if self.broadcast_global:
                            await self.broadcast_global("task_updated", {
                                "id": task_id,
                                "status": "reviewing",
                                "reason": "post_process_failed",
                                "message": msg
                            })
                else:
                    # 非自动批准：worktree 仍存在，等待用户批准后触发后处理
                    logger.info(f"Task {task_id}: Worktree exists, waiting for user approval")
                    await execute("UPDATE tasks SET status='reviewing' WHERE id=?", (task_id,))
                    if self.broadcast_global:
                        await self.broadcast_global("task_updated", {
                            "id": task_id,
                            "status": "reviewing",
                            "reason": "waiting_user_approval",
                            "worktree_path": worktree_info["path"]
                        })
            elif status == "completed":
                # 非隔离任务：无需 merge，但需要检查 mode
                task_row = await fetch_one("SELECT mode, plan_status, auto_approve FROM tasks WHERE id=?", (task_id,))
                is_plan_mode = task_row and task_row.get("mode") == "plan"
                is_auto_approve = task_row and task_row.get("auto_approve")

                if is_plan_mode:
                    # Plan 任务等待用户批准
                    logger.info(f"Task {task_id}: Non-isolated Plan task waiting for user approval")
                elif is_auto_approve:
                    # auto_approve：状态已在 runner_service 中设置，无需额外操作
                    logger.info(f"Task {task_id}: auto_approve completed (handled by runner_service)")
                else:
                    # 普通任务：直接设置为 completed
                    logger.info(f"Task {task_id}: Non-isolated Execute task, marking as completed")
                    await execute("UPDATE tasks SET status='completed' WHERE id=?", (task_id,))
                    if self.broadcast_global:
                        await self.broadcast_global("task_updated", {"id": task_id, "status": "completed"})

        except Exception as e:
            logger.exception(f"Worker {worker.id}: task {task_id} failed: {e}")
            await execute("UPDATE tasks SET status='failed' WHERE id=?", (task_id,))
            if self.broadcast_global:
                await self.broadcast_global("task_updated", {"id": task_id, "status": "failed"})
            # 失败时保留工作树，让用户可以查看问题
            # 不自动清理，等待用户处理或通过 /cleanup 端点手动清理
        finally:
            self._wake.set()

    async def _broadcast_status(self) -> None:
        if self.broadcast:
            await self.broadcast(0, "scheduler", {"type": "scheduler_status", "workers": self.get_workers()})
