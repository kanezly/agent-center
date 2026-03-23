# Agent 抽象接口与调用流程

## 概述

AgentCenter 的 Agent 模块提供了一套统一的执行接口，用于调度和管理不同类型的 Agent 后端（如 Claude Code CLI）。通过抽象层设计，系统可以灵活地支持多种 Agent 实现，同时保持调用方代码的稳定性。

## 模块结构

```
backend/services/agent/
├── base.py          # Agent 协议定义（抽象基类）和数据模型
├── claude.py        # Claude Code CLI Agent 实现
├── registry.py      # Agent 注册表和工厂
└── __init__.py      # 模块导出
```

## 核心组件

### 1. AgentProtocol（抽象协议）

**位置**: `backend/services/agent/base.py`

定义了所有 Agent 后端必须实现的统一接口：

```python
class AgentProtocol(ABC):
    @abstractmethod
    def get_name(self) -> str: ...

    @abstractmethod
    def build_args(self, prompt: str, config: AgentConfig, cwd: str) -> List[str]: ...

    @abstractmethod
    def parse_event(self, line: str) -> Optional[AgentEvent]: ...

    @abstractmethod
    def classify_event(self, event: AgentEvent) -> str: ...

    @abstractmethod
    async def execute(...) -> AgentResult: ...

    @abstractmethod
    async def cleanup(self, task_id: int) -> None: ...
```

**设计目的**:
- **解耦**: 调用方不依赖具体 Agent 实现
- **可扩展**: 新增 Agent 后端（如 OpenManus）只需实现协议即可
- **一致性**: 所有 Agent 返回统一的 `AgentResult` 结构

### 2. AgentConfig（执行配置）

```python
@dataclass
class AgentConfig:
    mode: str = "execute"              # 任务模式："execute" 或 "plan"
    permission_mode: Optional[str] = None  # 权限控制模式
    session_id: Optional[str] = None   # 会话 ID（用于 resume）
    fork_session_id: Optional[str] = None  # Fork 会话 ID
    system_prompt: Optional[str] = None    # 追加的系统提示词
    timeout: Optional[int] = None      # 超时时间（秒）
    metadata: Dict[str, Any] = field(default_factory=dict)
```

### 3. AgentResult（执行结果）

```python
@dataclass
class AgentResult:
    status: str           # "completed" | "failed" | "cancelled"
    result_text: str = ""
    cost_usd: float = 0.0
    session_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
```

### 4. AgentRegistry（注册表）

**位置**: `backend/services/agent/registry.py`

管理 Agent 后端的注册和获取：

```python
# 注册 Agent
AgentRegistry.register("claude", ClaudeAgent, set_default=True)

# 获取 Agent 实例
agent = AgentRegistry.get("claude")

# 列出所有已注册的 Agent
names = AgentRegistry.list()
```

**自动注册机制**: 模块加载时自动注册内置的 `ClaudeAgent`。

### 5. ClaudeAgent（具体实现）

**位置**: `backend/services/agent/claude.py`

实现了 `AgentProtocol` 接口，负责调用 Claude Code CLI：

- **build_args**: 构建 Claude CLI 命令行参数（包括 `--resume`、`--fork-session`、`--permission-mode` 等）
- **parse_event**: 解析 JSON 流式输出为结构化事件
- **execute**: 创建子进程、流式读取输出、广播事件
- **cleanup**: 清理进程资源

### 6. execute_agent（统一执行入口）

**位置**: `backend/services/agent_runner.py`

这是**应用层**的统一执行接口，封装了完整的业务流程：

```python
async def execute_agent(
    task_id: int,
    prompt: str,
    cwd: Optional[str] = None,
    broadcast: Optional[Callable] = None,
    broadcast_global: Optional[Callable] = None,
    config: Optional[AgentConfig] = None,
    db: Optional[aiosqlite.Connection] = None,
) -> str:
```

**职责范围**:
1. 通过 `AgentRegistry` 获取配置的 Agent 后端
2. 创建 Agent 实例并执行任务
3. 处理事件（广播、保存日志到数据库）
4. 拦截特定工具调用（如 `AskUserQuestion` 用于 Plan 决策）
5. 更新任务状态和对话记录
6. 处理 `auto_approve` 逻辑
7. 触发依赖任务检查

---

## 调用流程

### 完整调用链

```
┌─────────────────────────────────────────────────────────────────────┐
│  RalphLoop (scheduler/loop.py)                                      │
│  - 轮询待执行任务                                                    │
│  - 检查依赖是否满足                                                  │
│  - 管理 Worker 和隔离环境（worktree/standalone）                     │
│  - 调用 execute_agent                                                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  execute_agent (services/agent_runner.py)                           │
│  - 获取 Agent 配置（从 settings.AGENT_BACKEND）                       │
│  - 通过 AgentRegistry.get() 获取 Agent 实例                          │
│  - 定义 on_event 回调（处理广播、日志、决策问题拦截）                │
│  - 调用 agent.execute()                                              │
│  - 处理执行结果（更新数据库、触发依赖任务、auto_approve 逻辑）        │
│  - 返回状态："completed" | "failed" | "queued"                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ClaudeAgent.execute() (services/agent/claude.py)                   │
│  - 调用 build_args() 构建命令行参数                                  │
│  - 创建子进程（asyncio.create_subprocess_exec）                     │
│  - 流式读取 stdout/stderr 到队列                                     │
│  - 解析事件（parse_event）并调用 broadcast 回调                      │
│  - 提取 session_id、result、cost_usd                                │
│  - 返回 AgentResult                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Claude Code CLI                                                     │
│  - 执行用户 prompt                                                    │
│  - 输出 JSON 流式事件到 stdout                                        │
│  - 调用工具（如 AskUserQuestion、Write、Read 等）                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 事件处理流程

在 `execute_agent` 中定义的 `on_event` 回调处理以下事件：

| 事件类型 | 处理逻辑 |
|---------|---------|
| `assistant` | 保存助理由文本和思考过程到 `task_logs` 表 |
| `tool_use` | 拦截 `AskUserQuestion` 保存到 `plan_questions` 表；拦截 `Write` 追踪计划文件路径 |
| `result` | 提取 `result_text`、`cost_usd`；处理 `permission_denials` 中的决策问题 |
| `system` (init) | 提取 `session_id` 并保存到数据库 |
| `error` | 保存错误日志 |

---

## 关键设计决策

### 1. 为什么要分离 `AgentProtocol` 和 `execute_agent`？

**分层职责**:
- **AgentProtocol**: 底层协议，只关心如何执行单个 Agent 任务
- **execute_agent**: 应用层逻辑，处理数据库、业务规则、依赖触发等

**优势**:
- 新增 Agent 后端时，只需实现 `AgentProtocol`，无需关心业务逻辑
- 业务逻辑变更（如 auto_approve 规则）不影响 Agent 实现

### 2. 为什么使用 `AgentRegistry` 而不是直接实例化？

**动态配置**: 系统可能通过配置文件或环境变量切换 Agent 后端：
```python
# config.py
settings.AGENT_BACKEND = "claude"  # 或 "openmanus"

# agent_runner.py
agent = AgentRegistry.get(settings.AGENT_BACKEND)
```

**未来扩展**: 支持多个 Agent 同时工作时，可通过注册表管理。

### 3. 为什么 `execute_agent` 返回字符串状态而非 `AgentResult`？

因为 `execute_agent` 处理了业务逻辑（如 `auto_approve + plan` 模式会转换为 `queued` 状态），返回的是**最终业务状态**，而非 Agent 执行的原始状态。

### 4. 为什么需要 `broadcast` 和 `broadcast_global` 两个回调？

- **broadcast (task_id, event_type, payload)**: 任务级广播，用于 WebSocket 向特定任务的客户端推送日志
- **broadcast_global (event_type, data)**: 全局广播，用于通知系统级事件（如 `task_updated`）

---

## 扩展新 Agent 后端的步骤

1. **创建实现文件** (`backend/services/agent/xxx.py`):
```python
from .base import AgentProtocol, AgentConfig, AgentEvent, AgentResult

class XXXAgent(AgentProtocol):
    def get_name(self) -> str:
        return "xxx"

    def build_args(self, prompt: str, config: AgentConfig, cwd: str) -> List[str]:
        # 构建命令行参数
        return ["xxx-cli", "-p", prompt, ...]

    def parse_event(self, line: str) -> Optional[AgentEvent]:
        # 解析输出
        ...

    def classify_event(self, event: AgentEvent) -> str:
        # 事件分类
        ...

    async def execute(...) -> AgentResult:
        # 执行逻辑
        ...

    async def cleanup(self, task_id: int) -> None:
        # 清理资源
        ...
```

2. **注册 Agent** (`backend/services/agent/registry.py`):
```python
def _register_builtin_agents():
    from .xxx import XXXAgent
    AgentRegistry.register("xxx", XXXAgent, set_default=False)
```

3. **配置使用** (`.env` 或环境变量):
```bash
AGENT_BACKEND=xxx
```

---

## 相关文件

| 文件 | 职责 |
|------|------|
| `backend/scheduler/loop.py` | 调度器，轮询任务并分配给 Worker |
| `backend/scheduler/worker.py` | Worker 状态管理 |
| `backend/services/agent_runner.py` | Agent 统一执行入口（应用层） |
| `backend/services/agent/base.py` | Agent 协议定义（底层） |
| `backend/services/agent/claude.py` | Claude Code CLI 实现 |
| `backend/services/agent/registry.py` | Agent 注册表 |
| `backend/services/worktree_service.py` | Git worktree 管理（隔离任务） |
| `backend/services/dependency_service.py` | 依赖任务检查和触发 |
