"""Claude Code subprocess runner with stream-json parsing.

This service handles:
- Building Claude CLI arguments
- Running subprocess with async subprocess manager (cross-platform)
- Parsing stream-json output
- Broadcasting events via WebSocket
- Tracking costs
"""

from typing import Optional, List, Callable, Awaitable, Dict

import asyncio
import json
import logging
import os
import shutil
from datetime import datetime

import aiosqlite

from utils.subprocess_manager import ProcessResult
from utils.platform import get_process_create_kwargs, terminate_process
from utils.process_registry import ProcessRegistry

logger = logging.getLogger(__name__)


def get_claude_cmd() -> str:
    """Get Claude CLI command path at runtime to handle PATH differences."""
    cmd = shutil.which("claude")
    if cmd:
        return cmd
    # Fallback for Windows: try with .cmd extension
    if os.name == "nt":
        cmd = shutil.which("claude.cmd")
        if cmd:
            return cmd
    return "claude"


def build_claude_args(
    prompt: str,
    cwd: Optional[str] = None,
    mode: str = "execute",
    permission_mode: Optional[str] = None,
    session_id: Optional[str] = None,
    system_prompt: Optional[str] = None,
    fork_session_id: Optional[str] = None,  # 新增：fork 会话 ID
) -> List[str]:
    """Build Claude CLI command arguments.

    Args:
        prompt: The prompt to send
        cwd: Working directory (optional)
        mode: Task mode - "execute" or "plan"
        permission_mode: Permission mode override (e.g., "plan")
        session_id: Session ID to resume (for --resume)
        system_prompt: Optional system prompt to append
        fork_session_id: Session ID to fork (for --fork-session)

    Note:
        --fork-session takes precedence over --resume
    """
    # Note: --verbose is REQUIRED for --output-format stream-json
    args = [
        get_claude_cmd(),
        "-p", prompt,
        "--output-format", "stream-json",
        "--verbose",
    ]

    # 新增：添加工作目录到授权目录列表（Linux 下必需）
    # Linux 下 Claude CLI 默认只信任当前目录，需要通过 --add-dir 显式授权
    if cwd:
        args.extend(["--add-dir", cwd])

    # Fork 会话优先于 resume
    if fork_session_id:
        args.extend(["--fork-session", fork_session_id])
    elif session_id:
        args.extend(["--resume", session_id])

    # Add permission mode for plan tasks
    if permission_mode:
        args.extend(["--permission-mode", permission_mode])
    elif mode == "plan":
        args.extend(["--permission-mode", "plan"])
    else:
        # For execute mode, add --dangerously-skip-permissions
        args.append("--dangerously-skip-permissions")

    # Add system prompt if provided
    if system_prompt:
        args.extend(["--append-system-prompt", system_prompt])

    return args


def classify_event(data: dict) -> str:
    """Classify a stream-json event into a category."""
    etype = data.get("type", "")
    if etype == "assistant":
        return "assistant"
    if etype == "tool_use":
        return "tool_use"
    if etype == "tool_result":
        return "tool_result"
    if etype == "result":
        return "result"
    if etype == "error":
        return "error"
    # system events (including init with session_id)
    if etype == "system":
        return "system"
    # content_block events
    if etype in ("content_block_start", "content_block_delta", "content_block_stop"):
        return "assistant"
    if etype == "message_start":
        return "system"
    if etype == "message_delta":
        return "system"
    if etype == "message_stop":
        return "system"
    return "system"


class RunnerService:
    """Service for running Claude CLI tasks."""

    def __init__(self, db: aiosqlite.Connection):
        self.db = db

    async def run(
        self,
        task_id: int,
        prompt: str,
        cwd: Optional[str] = None,
        broadcast: Optional[Callable[[int, str, dict], Awaitable[None]]] = None,
        broadcast_global: Optional[Callable[[str, dict], Awaitable[None]]] = None,
        fork_session_id: Optional[str] = None,
    ) -> str:
        """Run a claude CLI subprocess and stream results.

        Args:
            task_id: DB task id
            prompt: The prompt to send
            cwd: Working directory for the subprocess
            broadcast: async callable(task_id, event_type, payload_dict) for WebSocket push
            broadcast_global: async callable(event_type, data) for global event broadcast
            fork_session_id: Session ID to fork (for --fork-session)

        Returns:
            Final status string: "completed" or "failed"
        """
        return await run_claude_task(
            task_id=task_id,
            prompt=prompt,
            cwd=cwd,
            broadcast=broadcast,
            broadcast_global=broadcast_global,
            db=self.db,
            fork_session_id=fork_session_id,
        )


async def run_claude_task(
    task_id: int,
    prompt: str,
    cwd: Optional[str] = None,
    broadcast: Optional[Callable[[int, str, dict], Awaitable[None]]] = None,
    broadcast_global: Optional[Callable[[str, dict], Awaitable[None]]] = None,
    db: Optional[aiosqlite.Connection] = None,
    mode: str = "execute",
    session_id: Optional[str] = None,
    system_prompt: Optional[str] = None,
    fork_session_id: Optional[str] = None,  # 新增：fork 会话 ID
) -> str:
    """Run a claude CLI subprocess and stream results.

    Args:
        task_id: DB task id
        prompt: The prompt to send
        cwd: Working directory for the subprocess
        broadcast: async callable(task_id, event_type, payload_dict) for WebSocket push
        broadcast_global: async callable(event_type, data) for global event broadcast
        db: Database connection (optional, uses global if not provided)
        mode: Task mode - "execute" or "plan"
        session_id: Session ID to resume (for --resume)
        system_prompt: Optional system prompt to append
        fork_session_id: Session ID to fork (for --fork-session)

    Returns:
        Final status string: "completed" or "failed"
    """
    from db import get_connection, execute as db_execute, fetch_one as db_fetch_one

    # Use provided db or get global connection
    if db is None:
        db = get_connection()

    # Determine permission mode
    permission_mode = "plan" if mode == "plan" else None
    args = build_claude_args(prompt, cwd, mode=mode, permission_mode=permission_mode, session_id=session_id, system_prompt=system_prompt, fork_session_id=fork_session_id)
    logger.info(f"[Task {task_id}] Mode: {mode}, Permission: {permission_mode}")
    logger.info(f"[Task {task_id}] Full args: {' '.join(args)}")

    await db_execute(
        "UPDATE tasks SET status='running', started_at=? WHERE id=?",
        (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), task_id),
    )

    result_text = ""
    cost_usd = 0.0
    plan_file_path = None  # Track plan file path for plan mode

    # 准备环境
    env = dict(os.environ)
    env.pop("CLAUDECODE", None)
    env.pop("CLAUDE_CODE_ENTRYPOINT", None)
    env["PYTHONIOENCODING"] = "utf-8"

    # 创建队列用于接收输出
    queue = asyncio.Queue()

    # 获取超时配置
    from config import settings
    timeout_seconds = settings.TASK_TIMEOUT

    logger.info(f"[Task {task_id}] Starting process with timeout {timeout_seconds}s")

    # 直接创建进程并流式处理输出
    result = await _run_process_and_stream(
        args=args,
        cwd=cwd or os.getcwd(),
        env=env,
        queue=queue,
        timeout=timeout_seconds,
        task_id=task_id,
    )

    # 处理队列中的输出
    while True:
        try:
            item = await asyncio.wait_for(queue.get(), timeout=0.1)
        except asyncio.TimeoutError:
            # 队列为空，检查是否还有数据
            if result.timed_out or result.returncode != -1:
                break
            continue

        if item is None:
            break

        # 解析 item
        if isinstance(item, tuple):
            source, line = item
        else:
            source = "stdout"
            line = item

        # 跳过空行
        if not line:
            continue

        # 只处理 stdout 的 JSON 事件
        if source == "stdout":
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                data = {"type": "raw", "text": line}

            event_type = classify_event(data)

            # 提取 session_id
            if data.get("type") == "system" and data.get("subtype") == "init":
                extracted_session_id = data.get("session_id")
                if extracted_session_id:
                    await db_execute(
                        "UPDATE tasks SET session_id=? WHERE id=?",
                        (extracted_session_id, task_id)
                    )
                    logger.info(f"[Task {task_id}] Extracted session_id: {extracted_session_id}")

            # Broadcast
            if broadcast:
                await broadcast(task_id, event_type, data)

            # 保存日志
            if event_type in ("result", "assistant", "error"):
                if event_type == "assistant":
                    # 构建增强的日志数据结构
                    enriched = {
                        "text": "",        # text 内容
                        "thinking": "",    # thinking 内容（如有）
                    }

                    # 从 data["message"]["content"] 提取
                    msg = data.get("message", {})
                    content_blocks = msg.get("content", [])

                    # 类型验证：确保 content_blocks 是列表
                    if isinstance(content_blocks, list):
                        # 1. 提取 text 块
                        for b in content_blocks:
                            if isinstance(b, dict) and b.get("type") == "text":
                                enriched["text"] = b.get("text", "")

                        # 2. 提取 thinking 块（如有）
                        for b in content_blocks:
                            if isinstance(b, dict) and b.get("type") == "thinking":
                                enriched["thinking"] = b.get("thinking", "")

                    # 只有内容非空时才记录
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
                elif tool_name == "Write" and mode == "plan":
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

            # Extract result
            if data.get("type") == "result":
                result_text = data.get("result", "")
                # 直接从 total_cost_usd 获取费用
                cost_usd = data.get("total_cost_usd", 0) or 0

    # 检查结果
    if result.timed_out:
        status = "failed"
        result_text = f"任务超时（超过 {timeout_seconds} 秒）"
        logger.error(f"[Task {task_id}] Timed out after {timeout_seconds}s")
    elif result.returncode == 0:
        status = "completed"
    else:
        status = "failed"
        if result.stderr and not result_text:
            result_text = f"进程退出码 {result.returncode}: {result.stderr[:500]}"
        logger.warning(f"[Task {task_id}] Process failed with returncode {result.returncode}")

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
                shutil.rmtree(task_for_cleanup["cwd"])
                logger.info(f"[Task {task_id}] Cleaned up standalone directory after failure")
                await db_execute("UPDATE tasks SET cwd=NULL WHERE id=?", (task_id,))

    # For plan mode, read the generated markdown file and store in result_text
    if mode == "plan" and plan_file_path and os.path.exists(plan_file_path):
        try:
            with open(plan_file_path, "r", encoding="utf-8") as f:
                plan_markdown_content = f.read()
            logger.info(f"[Task {task_id}] Read plan file: {len(plan_markdown_content)} chars")
            # Store markdown in result_text for easy access
            result_text = plan_markdown_content
        except Exception as e:
            logger.warning(f"[Task {task_id}] Failed to read plan file: {e}")

    # 获取 auto_approve 标志
    task_row = await db_fetch_one("SELECT auto_approve FROM tasks WHERE id=?", (task_id,))
    is_auto_approve = task_row and task_row.get("auto_approve")

    # 检查是否有决策问题（仅 Plan 模式）
    has_questions = False
    if mode == "plan":
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
    if mode == "plan":
        plan_status = "reviewing" if has_questions else "approved"

    # 默认 reviewing
    final_status = "reviewing"

    # 标记是否已保存对话记录（auto_approve plan 模式在更新前已保存）
    conversation_saved = False

    # auto_approve + 无决策问题 → 直接 completed（执行模式）或 queued（计划模式）
    if is_auto_approve and mode == "plan":
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
                current_round,  # 1
                task_for_save.get("prompt", ""),  # 原始 prompt
                task_for_save.get("session_id"),
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),  # created_at 使用本地时间
                task_for_save.get("started_at"),
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                cost_usd,
                result_text  # plan 执行结果
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
    elif is_auto_approve and mode == "execute":
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
                # 记录已存在（由 continue_task/answer_questions 创建），更新 result_text 和成本
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
                # 记录不存在，插入新记录（适用于没有经过 continue_task/answer_questions 的直接执行）
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
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),  # created_at 使用本地时间
                    task.get("started_at"),
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    cost_usd,
                    result_text
                ))
                logger.info(f"[Task {task_id}] Recorded conversation for round {current_round}")

    # 根据 mode 决定如何更新 plan_status
    if mode == "plan":
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
    if is_auto_approve and mode == "execute" and final_status == "completed":
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


async def _run_process_and_stream(
    args: List[str],
    cwd: Optional[str],
    queue: asyncio.Queue,
    env: Optional[Dict[str, str]] = None,
    timeout: Optional[int] = None,
    task_id: Optional[int] = None,
) -> ProcessResult:
    """
    运行进程并流式输出到队列

    这是简化的内部函数，避免依赖已删除的 run_process_with_stream
    """
    try:
        # 验证 cwd 是否有效（不 fallback 到 os.getcwd()，避免任务在错误目录执行）
        if cwd and not os.path.isdir(cwd):
            raise NotADirectoryError(f"[Task {task_id}] cwd does not exist: {cwd}")

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

        # 注册进程到全局注册表
        registry = ProcessRegistry()
        registry.register(task_id, proc)

        try:
            # 创建读取任务
            stdout_task = asyncio.create_task(_read_to_queue(proc.stdout, queue, "stdout", task_id))
            stderr_task = asyncio.create_task(_read_to_queue(proc.stderr, queue, "stderr", task_id))

            # 等待进程完成（带超时）
            timed_out = False
            returncode = -1

            try:
                if timeout:
                    await asyncio.wait_for(proc.wait(), timeout=timeout)
                else:
                    await proc.wait()

                # 等待读取完成（带短超时，避免无限阻塞）
                try:
                    await asyncio.wait_for(asyncio.gather(stdout_task, stderr_task), timeout=10)
                except asyncio.TimeoutError:
                    logger.warning(f"[Task {task_id}] Read tasks timed out, cancelling...")
                    stdout_task.cancel()
                    stderr_task.cancel()
                    await asyncio.gather(stdout_task, stderr_task, return_exceptions=True)
                returncode = proc.returncode

            except asyncio.TimeoutError:
                timed_out = True
                logger.error(f"[Task {task_id}] Process timed out after {timeout}s")
                await terminate_process(proc)
                # 等待读取任务完成
                await asyncio.gather(stdout_task, stderr_task, return_exceptions=True)

            return ProcessResult(
                returncode=returncode if not timed_out else -1,
                stderr="",
                timed_out=timed_out,
            )
        finally:
            # 进程结束后注销
            registry.unregister(task_id)

    except FileNotFoundError as e:
        logger.error(f"Command not found: {args[0]}")
        return ProcessResult(
            returncode=127,
            stderr=f"Command not found: {args[0]}",
        )
    except Exception as e:
        logger.exception(f"Process error: {e}")
        return ProcessResult(
            returncode=1,
            stderr=str(e),
        )


async def _read_to_queue(
    stream: asyncio.StreamReader,
    queue: asyncio.Queue,
    source: str,
    task_id: int,
):
    """读取流并推送到队列

    注意：asyncio.StreamReader.readline() 不接受参数，
    对于大行，我们捕获 LimitOverrunError 并尝试逐字节读取。
    """
    try:
        while True:
            try:
                line = await stream.readline()
                if not line:
                    break
                decoded = line.decode('utf-8', errors='replace').strip()
                # 推送所有行到队列（包括空行），避免丢失数据
                await queue.put((source, decoded))
            except asyncio.IncompleteReadError as e:
                # 处理不完整读取（EOF 前的部分数据）
                if e.partial:
                    decoded = e.partial.decode('utf-8', errors='replace').strip()
                    if decoded:
                        await queue.put((source, decoded))
                break
            except asyncio.LimitOverrunError:
                # 行超过默认缓冲区限制（64KB），尝试读取剩余部分
                logger.warning(f"[Task {task_id}] Line too long, reading chunk")
                # 读取一大块数据作为替代方案
                chunk = await stream.read(8192)
                if not chunk:
                    break
                decoded = chunk.decode('utf-8', errors='replace').strip()
                if decoded:
                    await queue.put((source, decoded))
    except Exception as e:
        logger.warning(f"[Task {task_id}] Stream read error from {source}: {e}")
    finally:
        # 发送结束信号
        await queue.put(None)
