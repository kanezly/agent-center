"""Agent 统一执行接口（高级封装）。

本模块提供统一的 Agent 执行入口，包含：
1. 通过 AgentRegistry 获取配置的 Agent 后端
2. 通用的数据库操作（保存日志、更新状态等）
3. 事件处理和广播
4. 业务逻辑（auto_approve、plan_status、依赖触发等）
5. 后处理流程（git worktree 合并和清理）

这是应用层的接口，底层 Agent 实现（如 ClaudeAgent）只负责执行和解析。
"""

from typing import Optional, Callable, Awaitable, Tuple
import asyncio
import json
import logging
import os
import shutil
import subprocess
from datetime import datetime

import aiosqlite

from .agent import AgentRegistry, AgentConfig
from .agent.base import AgentResult, AgentProtocol

logger = logging.getLogger(__name__)

# 后处理流程 prompt：用于隔离任务批准后的 merge 和清理
# 这是 git worktree 特定的后处理流程，与具体 Agent 实现无关
POST_PROCESS_PROMPT = (
    "请执行以下合并与清理流程（必须按顺序执行）："
    "1) 检查未提交代码：cd {worktree_path} 且 git status --porcelain，"
    "   如果有改动则 git add -A 并用 git diff --cached 分析改动内容后生成描述性 commit 信息然后执行 git commit，"
    "   如果没有改动则跳过提交与合并步骤，直接执行步骤 2-7；"
    "2) 切回主目录工作区：cd {main_project_path}；"
    "3) 查看主目录当前分支：git branch --show-current，记录分支名；"
    "4) 执行 merge 到当前分支：git merge --no-ff -m '合并功能分支 {branch_name}' {branch_name} "
    "   （如有不相关历史错误，添加 --allow-unrelated-histories 参数）；"
    "5) 处理 merge 冲突（如有）：git status 查看冲突，git diff 查看内容，手动编辑解决，git add 已解决的文件，git commit；"
    "6) 清理工作树：git worktree remove --force {worktree_path}；"
    "7) 清理功能分支：git branch -d {branch_name}。"
    "注意：必须完整执行所有步骤。"
    "重要警告：不要在主目录 {main_project_path} 上执行任何清理操作（如 git clean、git checkout -- . 等）"
    "- 主目录可能还有其他未提交的修改需要保留！只能清理 worktree 目录 {worktree_path}。"
)


async def execute_agent(
    task_id: int,
    prompt: str,
    cwd: Optional[str] = None,
    broadcast: Optional[Callable[[int, str, dict], Awaitable[None]]] = None,
    broadcast_global: Optional[Callable[[str, dict], Awaitable[None]]] = None,
    config: Optional[AgentConfig] = None,
    db: Optional[aiosqlite.Connection] = None,
) -> str:
    """执行 Agent 任务的统一入口（高级封装）。

    本函数封装了完整的执行流程：
    1. 从配置获取 Agent 后端类型
    2. 创建 Agent 实例
    3. 执行任务并处理事件
    4. 保存日志和结果到数据库
    5. 处理业务逻辑（auto_approve、plan_status、依赖触发等）

    Args:
        task_id: 任务 ID
        prompt: 用户提示词
        cwd: 工作目录
        broadcast: 任务级 WebSocket 广播回调，signature: (task_id, event_type, payload)
        broadcast_global: 全局 WebSocket 广播回调，signature: (event_type, data)
        config: Agent 执行配置
        db: 数据库连接（可选，使用全局连接如果未提供）

    Returns:
        str: 执行状态 - "completed" | "failed" | "queued" (auto_approve plan 模式)
    """
    from db import get_connection, execute as db_execute, fetch_one as db_fetch_one
    from config import settings

    # 获取数据库连接
    if db is None:
        db = get_connection()

    # 获取配置的 Agent 后端
    agent_backend = settings.AGENT_BACKEND
    try:
        agent = AgentRegistry.get(agent_backend)
    except ValueError as e:
        logger.error(f"Failed to get agent '{agent_backend}': {e}")
        await db_execute(
            "UPDATE tasks SET status='failed', result_text=? WHERE id=?",
            (f"Agent backend not found: {agent_backend}", task_id)
        )
        return "failed"

    logger.info(f"[Task {task_id}] Using agent backend: {agent_backend}")

    if config is None:
        config = AgentConfig()

    # 更新任务状态为 running
    await db_execute(
        "UPDATE tasks SET status='running', started_at=? WHERE id=?",
        (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), task_id),
    )

    # 跟踪变量
    result_text = ""
    cost_usd = 0.0
    plan_file_path = None  # Plan 模式文件路径
    session_id: Optional[str] = None

    # 定义事件处理回调
    async def on_event(event_type: str, data: dict):
        """处理 Agent 事件：广播和保存日志。"""
        nonlocal result_text, cost_usd, session_id

        # 广播事件
        if broadcast:
            await broadcast(task_id, event_type, data)

        # 保存日志（仅保存重要事件）
        if event_type in ("result", "assistant", "error"):
            if event_type == "assistant":
                # 构建增强的日志数据结构（提取 text 和 thinking）
                enriched = {"text": "", "thinking": ""}
                msg = data.get("message", {})
                content_blocks = msg.get("content", [])
                if isinstance(content_blocks, list):
                    for b in content_blocks:
                        if isinstance(b, dict) and b.get("type") == "text":
                            enriched["text"] = b.get("text", "")
                        elif isinstance(b, dict) and b.get("type") == "thinking":
                            enriched["thinking"] = b.get("thinking", "")
                if enriched["text"] or enriched["thinking"]:
                    await db_execute(
                        "INSERT INTO task_logs (task_id, event_type, payload, ts) VALUES (?, ?, ?, datetime('now', 'localtime'))",
                        (task_id, event_type, json.dumps(enriched, ensure_ascii=False))
                    )
            else:
                # result 和 error 类型保存完整数据
                await db_execute(
                    "INSERT INTO task_logs (task_id, event_type, payload, ts) VALUES (?, ?, ?, datetime('now', 'localtime'))",
                    (task_id, event_type, json.dumps(data, ensure_ascii=False))
                )

        # 提取 session_id（从 init 事件）
        if event_type == "system" and data.get("subtype") == "init":
            extracted_session_id = data.get("session_id")
            if extracted_session_id:
                session_id = extracted_session_id
                await db_execute(
                    "UPDATE tasks SET session_id=? WHERE id=?",
                    (extracted_session_id, task_id)
                )
                logger.info(f"[Task {task_id}] Extracted session_id: {extracted_session_id}")

        # 拦截工具调用
        if event_type == "tool_use":
            tool_name = data.get("name", "")

            # 拦截 AskUserQuestion (Plan mode 决策问题)
            if tool_name == "AskUserQuestion":
                questions = data.get("input", {}).get("questions", [])
                for q in questions:
                    await db_execute(
                        """INSERT INTO plan_questions
                           (task_id, question, header, options, multi_select)
                           VALUES (?, ?, ?, ?, ?)""",
                        (
                            task_id,
                            q.get("question", ""),
                            q.get("header", ""),
                            json.dumps(q.get("options", [])),
                            1 if q.get("multiSelect", False) else 0
                        )
                    )
                logger.info(f"[Task {task_id}] Intercepted {len(questions)} AskUserQuestion(s)")

            # 拦截 Write 工具（追踪计划文件路径）
            elif tool_name == "Write" and config.mode == "plan":
                file_path = data.get("input", {}).get("file_path", "")
                if ".claude/plans/" in file_path and file_path.endswith(".md"):
                    plan_file_path = file_path
                    logger.debug(f"[Task {task_id}] Found plan file: {plan_file_path}")

        # 处理 result 事件中的 permission_denials
        if event_type == "result" and data.get("permission_denials"):
            for denial in data.get("permission_denials", []):
                if denial.get("tool_name") == "AskUserQuestion":
                    questions = denial.get("tool_input", {}).get("questions", [])
                    for q in questions:
                        await db_execute(
                            """INSERT INTO plan_questions
                               (task_id, question, header, options, multi_select)
                               VALUES (?, ?, ?, ?, ?)""",
                            (
                                task_id,
                                q.get("question", ""),
                                q.get("header", ""),
                                json.dumps(q.get("options", [])),
                                1 if q.get("multiSelect", False) else 0
                            )
                        )
                    logger.info(f"[Task {task_id}] Intercepted {len(questions)} AskUserQuestion(s) from permission_denials")

        # 提取 result
        if event_type == "result":
            result_text = data.get("result", "")
            cost_usd = data.get("total_cost_usd", 0) or 0

    # 执行 Agent 任务
    agent_result: AgentResult = await agent.execute(
        task_id=task_id,
        prompt=prompt,
        cwd=cwd,
        broadcast=on_event,
        broadcast_global=None,  # 不在这里使用 broadcast_global，由调用方处理
        config=config,
    )

    # 使用 agent_result 更新本地变量（如果 Agent 返回了结果）
    if agent_result.result_text:
        result_text = agent_result.result_text
    if agent_result.cost_usd > 0:
        cost_usd = agent_result.cost_usd
    if agent_result.session_id:
        session_id = agent_result.session_id

    # 确定最终状态
    status = agent_result.status

    # 任务失败时触发依赖任务检查
    if status == "failed":
        from services.dependency_service import DependencyService
        dep_service = DependencyService(db)

        def notify_scheduler():
            import app
            if app.scheduler:
                app.scheduler.notify()

        await dep_service.trigger_dependent_tasks(task_id, notify_scheduler)
        logger.info(f"[Task {task_id}] Triggered dependent tasks after failure")

        # 独立隔离任务清理：删除 standalone 目录
        task_for_cleanup = await db_fetch_one("SELECT is_isolated, project_id, cwd FROM tasks WHERE id=?", (task_id,))
        if task_for_cleanup and task_for_cleanup.get("is_isolated") and not task_for_cleanup.get("project_id") and task_for_cleanup.get("cwd") and "standalone-" in task_for_cleanup.get("cwd", ""):
            if os.path.exists(task_for_cleanup["cwd"]):
                import shutil
                shutil.rmtree(task_for_cleanup["cwd"])
                logger.info(f"[Task {task_id}] Cleaned up standalone directory after failure")
                await db_execute("UPDATE tasks SET cwd=NULL WHERE id=?", (task_id,))

    # Plan 模式：读取生成的 markdown 文件
    if config.mode == "plan" and plan_file_path and os.path.exists(plan_file_path):
        try:
            with open(plan_file_path, "r", encoding="utf-8") as f:
                plan_markdown_content = f.read()
            logger.info(f"[Task {task_id}] Read plan file: {len(plan_markdown_content)} chars")
            result_text = plan_markdown_content
        except Exception as e:
            logger.warning(f"[Task {task_id}] Failed to read plan file: {e}")

    # 获取 auto_approve 标志
    task_row = await db_fetch_one("SELECT auto_approve FROM tasks WHERE id=?", (task_id,))
    is_auto_approve = task_row and task_row.get("auto_approve")

    # 检查是否有决策问题（仅 Plan 模式）
    has_questions = False
    if config.mode == "plan":
        questions = await db_fetch_one(
            "SELECT COUNT(*) as cnt FROM plan_questions WHERE task_id=?",
            (task_id,)
        )
        has_questions = questions and questions["cnt"] > 0

    # 有计划问题时，auto_approve 不生效
    if has_questions:
        is_auto_approve = False

    # 计算 plan_status（仅 Plan 模式使用）
    plan_status = "generating"
    if config.mode == "plan":
        plan_status = "reviewing" if has_questions else "approved"

    # 默认 reviewing
    final_status = "reviewing"

    # 标记是否已保存对话记录
    conversation_saved = False

    # auto_approve + 无决策问题 → 直接 completed（执行模式）或 queued（计划模式）
    if is_auto_approve and config.mode == "plan":
        # 先保存 plan 模式的对话记录（在更新 tasks 之前）
        task_for_save = await db_fetch_one("SELECT * FROM tasks WHERE id=?", (task_id,))
        if task_for_save:
            current_round = task_for_save.get("round_number", 1) or 1
            await db_execute("""
                INSERT INTO task_conversations
                (task_id, round_number, user_prompt, session_id, created_at,
                 started_at, finished_at, cost_usd, result_text)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                task_id,
                current_round,
                task_for_save.get("prompt", ""),
                task_for_save.get("session_id"),
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                task_for_save.get("started_at"),
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                cost_usd,
                result_text
            ))
            logger.info(f"[Task {task_id}] Saved plan conversation for round {current_round}")
            conversation_saved = True

        # 再更新 tasks 表为 execute 模式
        await db_execute("""
            UPDATE tasks SET
               mode='execute', status='queued', plan_status='executing',
               prompt='计划已批准，请开始执行。',
               round_number=COALESCE(round_number, 1) + 1
               WHERE id=?""",
            (task_id,)
        )
        final_status = "queued"
        plan_status = "executing"
    elif is_auto_approve and config.mode == "execute":
        final_status = "completed"

    # 保存当前轮次的对话记录到 task_conversations 表
    if not conversation_saved:
        task = await db_fetch_one("SELECT * FROM tasks WHERE id=?", (task_id,))
        if task:
            current_round = task.get("round_number", 1) or 1
            # 检查当前轮次是否已有对话记录
            existing = await db_fetch_one(
                "SELECT COUNT(*) as cnt FROM task_conversations WHERE task_id=? AND round_number=?",
                (task_id, current_round)
            )
            if existing.get("cnt", 0) > 0:
                # 记录已存在，更新 result_text 和成本
                await db_execute("""
                    UPDATE task_conversations
                    SET result_text=?, cost_usd=?, finished_at=?
                    WHERE task_id=? AND round_number=?
                """, (
                    result_text,
                    cost_usd,
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    task_id,
                    current_round
                ))
                logger.info(f"[Task {task_id}] Updated conversation result for round {current_round}")
            else:
                # 记录不存在，插入新记录
                await db_execute("""
                    INSERT INTO task_conversations
                    (task_id, round_number, user_prompt, session_id, created_at,
                     started_at, finished_at, cost_usd, result_text)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    task_id,
                    current_round,
                    task.get("prompt", ""),
                    task.get("session_id"),
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    task.get("started_at"),
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    cost_usd,
                    result_text
                ))
                logger.info(f"[Task {task_id}] Recorded conversation for round {current_round}")

    # 根据 mode 决定如何更新 plan_status
    if config.mode == "plan":
        # Plan 模式：更新 plan_status
        await db_execute(
            "UPDATE tasks SET status=?, plan_status=?, finished_at=?, result_text=?, cost_usd=? WHERE id=?",
            (final_status, plan_status, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), result_text, cost_usd, task_id),
        )
    else:
        # Execute 模式：不覆盖 plan_status，只更新其他字段
        await db_execute(
            "UPDATE tasks SET status=?, finished_at=?, result_text=?, cost_usd=? WHERE id=?",
            (final_status, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), result_text, cost_usd, task_id),
        )

    # auto_approve 直接 completed 时，触发依赖任务
    if is_auto_approve and config.mode == "execute" and final_status == "completed":
        from services.dependency_service import DependencyService
        dep_service = DependencyService(db)

        def notify_scheduler():
            import app
            if app.scheduler:
                app.scheduler.notify()

        await dep_service.trigger_dependent_tasks(task_id, notify_scheduler)
        logger.info(f"[Task {task_id}] Auto-approved, triggered dependent tasks")

    if broadcast_global:
        await broadcast_global("task_updated", {"id": task_id, "status": final_status})

    logger.info(f"[Task {task_id}] Finished with status={final_status}")
    return final_status


async def run_post_process(
    agent: AgentProtocol,
    task_id: int,
    session_id: str,
    worktree_path: str,
    branch_name: str,
    main_project_path: str,
    broadcast_global: Optional[Callable[[str, dict], Awaitable[None]]] = None,
) -> Tuple[bool, str]:
    """在隔离任务所在文件夹 resume session，执行合并与清理流程。

    此函数使用传入的 Agent 实例执行后处理流程，不依赖具体的 Agent 实现。

    注意：此函数仅执行后处理，不更新任务状态。调用方负责状态更新。

    Args:
        agent: Agent 实例，用于执行后处理任务
        task_id: 任务 ID
        session_id: Session ID（用于 --resume）
        worktree_path: worktree 路径
        branch_name: 功能分支名称
        main_project_path: 主目录工作区路径
        broadcast_global: async callable(event_type, data) for global event broadcast

    Returns:
        Tuple of (success: bool, message: str)
    """
    # 验证必需参数
    if not main_project_path:
        logger.error(f"Task {task_id}: main_project_path is required but was empty or None")
        return False, "main_project_path is required but was empty or None"

    # 构建后处理 prompt
    prompt = POST_PROCESS_PROMPT.format(
        main_project_path=main_project_path,
        task_id=task_id,
        branch_name=branch_name,
        worktree_path=worktree_path,
    )

    logger.info(f"Task {task_id}: Post-process prompt length={len(prompt)}, preview={prompt[:500]}...")

    # 构建 Agent 配置
    config = AgentConfig(
        mode="execute",
        session_id=session_id,
        system_prompt=None,  # 后处理不需要特殊的 system prompt
    )

    # 使用 Agent 的 build_args 方法构建参数
    # 后处理流程需要访问 worktree 和主项目目录
    args = agent.build_args(
        prompt=prompt,
        config=config,
        cwd=worktree_path,  # 主工作目录是 worktree
    )

    # 额外添加主项目路径到授权目录
    # 在 --dangerously-skip-permissions 之前插入 --add-dir
    try:
        skip_perms_index = args.index("--dangerously-skip-permissions")
        args.insert(skip_perms_index, "--add-dir")
        args.insert(skip_perms_index + 1, main_project_path)
    except ValueError:
        # 如果没有找到 --dangerously-skip-permissions，追加到末尾
        args.extend(["--add-dir", main_project_path])

    logger.info(f"Task {task_id}: Running post-process with args: {' '.join(args)}")

    try:
        # 确保 worktree 路径存在
        if not os.path.exists(worktree_path):
            return False, f"Worktree path does not exist: {worktree_path}"

        # 准备环境
        env = dict(os.environ)
        env.pop("CLAUDECODE", None)
        env.pop("CLAUDE_CODE_ENTRYPOINT", None)
        env["PYTHONIOENCODING"] = "utf-8"

        # 获取超时配置
        from config import settings

        # 创建进程执行
        result = await _run_post_process_process(
            args=args,
            cwd=worktree_path,
            env=env,
            timeout=settings.POST_PROCESS_TIMEOUT,
            task_id=task_id,
        )

        returncode, timed_out = result

        if timed_out:
            return False, f"Post-process timed out after {settings.POST_PROCESS_TIMEOUT}s"

        if returncode != 0:
            logger.warning(f"Task {task_id}: Post-process returned non-zero: {returncode}")

        # 检查 git worktree list 输出，确认 worktree 是否已被移除
        try:
            result_check = subprocess.run(
                ["git", "worktree", "list"],
                capture_output=True,
                text=True,
                cwd=main_project_path,
                timeout=10,
            )
            worktree_list = result_check.stdout
            normalized_worktree_path = os.path.abspath(worktree_path).replace("\\", "/")
            if normalized_worktree_path in worktree_list.replace("\\", "/"):
                return False, f"Post-process failed: worktree still registered at {worktree_path}"
            logger.info(f"Task {task_id}: Worktree successfully removed from git")
        except Exception as e:
            logger.warning(f"Task {task_id}: Failed to check worktree status: {e}")
            if os.path.exists(worktree_path):
                return False, f"Post-process failed: worktree folder still exists at {worktree_path}"

        # 后处理成功，删除 worktree 文件夹
        try:
            if os.path.exists(worktree_path):
                shutil.rmtree(worktree_path)
                logger.info(f"Task {task_id}: Worktree folder deleted: {worktree_path}")
        except Exception as e:
            logger.warning(f"Task {task_id}: Failed to delete worktree folder: {e}")

        logger.info(f"Task {task_id}: Post-process completed")
        return True, "Success"

    except Exception as e:
        logger.exception(f"Task {task_id}: Post-process error: {e}")
        if broadcast_global:
            await broadcast_global("task_updated", {
                "id": task_id,
                "status": "reviewing",
                "reason": "error",
                "message": str(e)
            })
        return False, f"Post-process error: {str(e)}"


async def _run_post_process_process(
    args: list,
    cwd: str,
    env: Optional[dict] = None,
    timeout: Optional[int] = None,
    task_id: Optional[int] = None,
) -> Tuple[int, bool]:
    """运行后处理进程并返回结果。

    Returns:
        (returncode, timed_out)
    """
    from utils.platform import get_process_create_kwargs, terminate_process
    from utils.process_registry import ProcessRegistry

    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
            env=env,
            **get_process_create_kwargs()
        )

        logger.info(f"Post-process started with PID {proc.pid}")

        registry = ProcessRegistry()
        registry.register(task_id, proc)

        try:
            async def read_stdout():
                while True:
                    line = await proc.stdout.readline()
                    if not line:
                        break

            async def read_stderr():
                while True:
                    line = await proc.stderr.readline()
                    if not line:
                        break

            stdout_task = asyncio.create_task(read_stdout())
            stderr_task = asyncio.create_task(read_stderr())

            timed_out = False
            try:
                if timeout:
                    await asyncio.wait_for(proc.wait(), timeout=timeout)
                else:
                    await proc.wait()
            except asyncio.TimeoutError:
                timed_out = True
                await terminate_process(proc)

            await asyncio.gather(stdout_task, stderr_task, return_exceptions=True)
            logger.info(f"Post-process returncode: {proc.returncode}")

            return (proc.returncode if not timed_out else -1, timed_out)
        finally:
            if task_id:
                registry.unregister(task_id)

    except FileNotFoundError as e:
        logger.error(f"Command not found: {args[0]}")
        return (127, False)
    except Exception as e:
        logger.exception(f"Process error: {e}")
        return (1, False)
