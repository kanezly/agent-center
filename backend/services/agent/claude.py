"""Claude Code CLI Agent 实现。

本模块实现了 AgentProtocol 接口，用于调用 Claude Code CLI。
"""

from typing import Optional, Callable, Awaitable, Dict, Any, List
import asyncio
import json
import logging
import os
import shutil
from datetime import datetime

from .base import (
    AgentProtocol,
    AgentConfig,
    AgentEvent,
    AgentResult,
)
from utils.platform import get_process_create_kwargs, terminate_process
from utils.process_registry import ProcessRegistry
from utils.subprocess_manager import ProcessResult

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
    fork_session_id: Optional[str] = None,
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


def classify_claude_event(data: dict) -> str:
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


class ClaudeAgent(AgentProtocol):
    """Claude Code CLI Agent 实现。"""

    def get_name(self) -> str:
        return "claude"

    def build_args(
        self,
        prompt: str,
        config: AgentConfig,
        cwd: Optional[str] = None,
    ) -> List[str]:
        """构建 Claude CLI 命令参数。"""
        return build_claude_args(
            prompt=prompt,
            cwd=cwd,
            mode=config.mode,
            permission_mode=config.permission_mode,
            session_id=config.session_id,
            system_prompt=config.system_prompt,
            fork_session_id=config.fork_session_id,
        )

    def parse_event(self, line: str) -> Optional[AgentEvent]:
        """解析 Claude stream-json 输出的一行文本为事件。"""
        if not line:
            return None

        try:
            data = json.loads(line)
            event_type = data.get("type", "raw")
            classified_type = classify_claude_event(data)
            return AgentEvent(
                event_type=event_type,
                data=data,
                classified_type=classified_type,
            )
        except json.JSONDecodeError:
            return AgentEvent(
                event_type="raw",
                data={"type": "raw", "text": line},
                classified_type="system",
            )

    def classify_event(self, event: AgentEvent) -> str:
        """对 Claude 事件进行分类。"""
        return event.classified_type

    async def execute(
        self,
        task_id: int,
        prompt: str,
        cwd: Optional[str] = None,
        broadcast: Optional[Callable[[int, str, dict], Awaitable[None]]] = None,
        broadcast_global: Optional[Callable[[str, dict], Awaitable[None]]] = None,
        config: Optional[AgentConfig] = None,
    ) -> AgentResult:
        """执行 Claude Code CLI 任务。

        这是 Claude Agent 的核心执行逻辑，包括：
        1. 构建命令行参数
        2. 创建子进程
        3. 流式解析输出
        4. 广播事件
        5. 保存会话 ID 和结果

        注意：此函数不直接操作数据库，调用方负责数据库更新。
        """
        if config is None:
            config = AgentConfig()

        # 构建命令参数
        args = self.build_args(prompt, config, cwd)
        logger.info(f"[Task {task_id}] Mode: {config.mode}, Permission: {config.permission_mode}")
        logger.info(f"[Task {task_id}] Full args: {' '.join(args)}")

        result_text = ""
        cost_usd = 0.0
        session_id: Optional[str] = None

        # 准备环境
        env = dict(os.environ)
        env.pop("CLAUDECODE", None)
        env.pop("CLAUDE_CODE_ENTRYPOINT", None)
        env["PYTHONIOENCODING"] = "utf-8"

        # 创建队列用于接收输出
        queue: asyncio.Queue = asyncio.Queue()

        # 获取超时配置
        from config import settings
        timeout_seconds = config.timeout or settings.TASK_TIMEOUT

        logger.info(f"[Task {task_id}] Starting process with timeout {timeout_seconds}s")

        # 创建进程并流式处理输出
        result = await self._run_process_and_stream(
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

            if not line:
                continue

            # 只处理 stdout 的 JSON 事件
            if source == "stdout":
                event = self.parse_event(line)
                if event is None:
                    continue

                # 提取 session_id
                if event.event_type == "system" and event.data.get("subtype") == "init":
                    extracted_session_id = event.data.get("session_id")
                    if extracted_session_id:
                        session_id = extracted_session_id
                        logger.info(f"[Task {task_id}] Extracted session_id: {extracted_session_id}")

                # Broadcast
                if broadcast:
                    await broadcast(task_id, event.classified_type, event.data)

                # Extract result
                if event.event_type == "result":
                    result_text = event.data.get("result", "")
                    cost_usd = event.data.get("total_cost_usd", 0) or 0

        # 检查结果
        if result.timed_out:
            return AgentResult(
                status="failed",
                result_text=f"任务超时（超过 {timeout_seconds} 秒）",
                session_id=session_id,
            )
        elif result.returncode == 0:
            return AgentResult(
                status="completed",
                result_text=result_text,
                cost_usd=cost_usd,
                session_id=session_id,
            )
        else:
            return AgentResult(
                status="failed",
                result_text=f"进程退出码 {result.returncode}",
                session_id=session_id,
            )

    async def cleanup(self, task_id: int) -> None:
        """清理 Claude 进程。"""
        registry = ProcessRegistry()
        proc = registry.get(task_id)
        if proc:
            await terminate_process(proc)
            registry.unregister(task_id)

    async def _run_process_and_stream(
        self,
        args: List[str],
        cwd: str,
        queue: asyncio.Queue,
        env: Optional[Dict[str, str]] = None,
        timeout: Optional[int] = None,
        task_id: Optional[int] = None,
    ) -> ProcessResult:
        """运行进程并流式输出到队列。"""
        try:
            # 验证 cwd 是否有效
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
                stdout_task = asyncio.create_task(self._read_to_queue(proc.stdout, queue, "stdout", task_id))
                stderr_task = asyncio.create_task(self._read_to_queue(proc.stderr, queue, "stderr", task_id))

                # 等待进程完成（带超时）
                timed_out = False
                returncode = -1

                try:
                    if timeout:
                        await asyncio.wait_for(proc.wait(), timeout=timeout)
                    else:
                        await proc.wait()

                    # 等待读取完成
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
                    await asyncio.gather(stdout_task, stderr_task, return_exceptions=True)

                return ProcessResult(
                    returncode=returncode if not timed_out else -1,
                    stderr="",
                    timed_out=timed_out,
                )
            finally:
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
        self,
        stream: asyncio.StreamReader,
        queue: asyncio.Queue,
        source: str,
        task_id: int,
    ):
        """读取流并推送到队列。"""
        try:
            while True:
                try:
                    line = await stream.readline()
                    if not line:
                        break
                    decoded = line.decode('utf-8', errors='replace').strip()
                    await queue.put((source, decoded))
                except asyncio.IncompleteReadError as e:
                    if e.partial:
                        decoded = e.partial.decode('utf-8', errors='replace').strip()
                        if decoded:
                            await queue.put((source, decoded))
                    break
                except asyncio.LimitOverrunError:
                    logger.warning(f"[Task {task_id}] Line too long, reading chunk")
                    chunk = await stream.read(8192)
                    if not chunk:
                        break
                    decoded = chunk.decode('utf-8', errors='replace').strip()
                    if decoded:
                        await queue.put((source, decoded))
        except Exception as e:
            logger.warning(f"[Task {task_id}] Stream read error from {source}: {e}")
        finally:
            await queue.put(None)
