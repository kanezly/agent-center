"""Agent 模块。

本模块提供 Agent 执行器的抽象协议和具体实现。
"""

from .base import (
    AgentProtocol,
    AgentConfig,
    AgentEvent,
    AgentResult,
)
from .registry import AgentRegistry

__all__ = [
    "AgentProtocol",
    "AgentConfig",
    "AgentEvent",
    "AgentResult",
    "AgentRegistry",
]
