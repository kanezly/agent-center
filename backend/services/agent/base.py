"""Agent 抽象协议定义。

本模块定义了 Agent 执行器的统一接口，所有 Agent 后端（Claude Code、OpenManus 等）
都必须实现此协议。
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Callable, Awaitable, Dict, Any, List, Iterator
import logging

logger = logging.getLogger(__name__)


@dataclass
class AgentConfig:
    """Agent 执行配置。

    Attributes:
        mode: 任务模式 - "execute" 或 "plan"
        permission_mode: 权限控制模式（如 "plan"），None 表示使用默认值
        session_id: 会话 ID，用于恢复已有会话
        fork_session_id: Fork 会话 ID，用于从其他会话派生
        system_prompt: 追加的系统提示词
        timeout: 任务超时时间（秒），None 表示使用全局默认值
        metadata: 额外的元数据，供特定 Agent 实现使用
    """
    mode: str = "execute"
    permission_mode: Optional[str] = None
    session_id: Optional[str] = None
    fork_session_id: Optional[str] = None
    system_prompt: Optional[str] = None
    timeout: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentEvent:
    """Agent 执行过程中的事件。

    Attributes:
        event_type: 事件类型，如 "assistant"、"tool_use"、"result"、"error" 等
        data: 事件原始数据（dict）
        classified_type: 分类后的事件类型（由具体 Agent 实现）
    """
    event_type: str
    data: Dict[str, Any]
    classified_type: str = "system"


@dataclass
class AgentResult:
    """Agent 执行结果。

    Attributes:
        status: 执行状态 - "completed" | "failed" | "cancelled"
        result_text: 执行结果文本
        cost_usd: 本次执行的成本（美元）
        session_id: 本次执行生成的会话 ID（用于后续 resume）
        metadata: 额外的元数据，如 token 使用量、执行时间等
    """
    status: str
    result_text: str = ""
    cost_usd: float = 0.0
    session_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class AgentProtocol(ABC):
    """Agent 执行器协议。

    所有 Agent 后端实现必须继承此类并实现所有抽象方法。

    使用示例:
        class ClaudeAgent(AgentProtocol):
            async def execute(self, task_id, prompt, ...) -> AgentResult:
                ...

        agent = ClaudeAgent()
        result = await agent.execute(task_id=1, prompt="...", ...)
    """

    def __init__(self):
        """初始化 Agent 执行器。"""
        pass

    @abstractmethod
    def get_name(self) -> str:
        """返回 Agent 后端名称。

        Returns:
            str: Agent 名称，如 "claude"、"openmanus" 等
        """
        pass

    @abstractmethod
    def build_args(
        self,
        prompt: str,
        config: AgentConfig,
        cwd: Optional[str] = None,
    ) -> List[str]:
        """构建 Agent 命令行参数。

        Args:
            prompt: 用户提示词
            config: Agent 执行配置
            cwd: 工作目录

        Returns:
            List[str]: 命令行参数列表
        """
        pass

    @abstractmethod
    def parse_event(self, line: str) -> Optional[AgentEvent]:
        """解析 Agent 输出的一行文本为事件。

        Args:
            line: Agent 输出的一行文本

        Returns:
            Optional[AgentEvent]: 解析后的事件，如果无法解析则返回 None
        """
        pass

    @abstractmethod
    def classify_event(self, event: AgentEvent) -> str:
        """对事件进行分类。

        Args:
            event: 待分类的事件

        Returns:
            str: 事件类型，如 "assistant"、"tool_use"、"result" 等
        """
        pass

    @abstractmethod
    async def execute(
        self,
        task_id: int,
        prompt: str,
        cwd: Optional[str] = None,
        broadcast: Optional[Callable[[int, str, dict], Awaitable[None]]] = None,
        broadcast_global: Optional[Callable[[str, dict], Awaitable[None]]] = None,
        config: Optional[AgentConfig] = None,
    ) -> AgentResult:
        """执行 Agent 任务。

        Args:
            task_id: 任务 ID
            prompt: 用户提示词
            cwd: 工作目录
            broadcast: 任务级 WebSocket 广播回调，signature: (task_id, event_type, payload)
            broadcast_global: 全局 WebSocket 广播回调，signature: (event_type, data)
            config: Agent 执行配置

        Returns:
            AgentResult: 执行结果
        """
        pass

    @abstractmethod
    async def cleanup(self, task_id: int) -> None:
        """清理 Agent 资源（如进程、临时文件）。

        Args:
            task_id: 任务 ID
        """
        pass
