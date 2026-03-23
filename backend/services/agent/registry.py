"""Agent 注册表和工厂。

本模块提供 Agent 后端的注册、查找和创建功能。
"""

from typing import Dict, Type, Optional
from .base import AgentProtocol


class AgentRegistry:
    """Agent 注册表。

    使用示例:
        # 注册 Agent 后端
        AgentRegistry.register("claude", ClaudeAgent)

        # 获取 Agent 实例
        agent = AgentRegistry.get("claude")

        # 获取所有已注册的 Agent 名称
        names = AgentRegistry.list()
    """

    _agents: Dict[str, Type[AgentProtocol]] = {}
    _default: Optional[str] = None

    @classmethod
    def register(
        cls,
        name: str,
        agent_cls: Type[AgentProtocol],
        *,
        set_default: bool = False,
    ) -> None:
        """注册一个 Agent 后端。

        Args:
            name: Agent 名称，如 "claude"、"openmanus"
            agent_cls: Agent 实现类
            set_default: 是否设为默认 Agent
        """
        cls._agents[name] = agent_cls
        if set_default or cls._default is None:
            cls._default = name

    @classmethod
    def get(cls, name: Optional[str] = None) -> AgentProtocol:
        """获取一个 Agent 实例。

        Args:
            name: Agent 名称，如不指定则使用默认 Agent

        Returns:
            AgentProtocol: Agent 实例

        Raises:
            ValueError: 当指定的 Agent 不存在时
        """
        agent_name = name or cls._default
        if not agent_name:
            raise ValueError("No agent registered and no name specified")
        if agent_name not in cls._agents:
            raise ValueError(f"Unknown agent: {agent_name}")
        return cls._agents[agent_name]()

    @classmethod
    def list(cls) -> list:
        """获取所有已注册的 Agent 名称。

        Returns:
            list: Agent 名称列表
        """
        return list(cls._agents.keys())

    @classmethod
    def has(cls, name: str) -> bool:
        """检查是否已注册指定的 Agent。

        Args:
            name: Agent 名称

        Returns:
            bool: 是否已注册
        """
        return name in cls._agents

    @classmethod
    def set_default(cls, name: str) -> None:
        """设置默认 Agent。

        Args:
            name: Agent 名称
        """
        if name not in cls._agents:
            raise ValueError(f"Unknown agent: {name}")
        cls._default = name


# 自动注册内置的 Agent 后端
# 延迟导入，避免循环依赖
def _register_builtin_agents():
    """注册内置的 Agent 后端。"""
    from .claude import ClaudeAgent
    AgentRegistry.register("claude", ClaudeAgent, set_default=True)


# 在模块加载时自动注册
_register_builtin_agents()
