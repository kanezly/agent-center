# 系统架构设计文档

## 概述

AgentCenter 是一个全栈任务管理系统，用于自动化执行 Claude Code CLI 任务。系统采用**前后端分离架构**，通过 WebSocket 实现实时通信，使用 Git Worktree 实现任务隔离。

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **后端** | Python 3.13 + FastAPI | 高性能异步 Web 框架 |
| **数据库** | SQLite (aiosqlite) | 异步 SQL 操作，WAL 模式 |
| **前端** | Next.js 14 + React 18 | App Router + TypeScript |
| **实时通信** | WebSocket | 双通道设计（日志流 + 全局事件） |
| **状态管理** | Zustand + React Query | UI 状态 + 服务器状态分离 |
| **容器化** | Docker + Docker Compose | 一键部署 |

---

## 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          前端 (Next.js 14)                               │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  TaskList    │  │  TaskDrawer  │  │  AuthGuard   │  │  useAuth()  │ │
│  │  (任务列表)  │  │  (任务详情)  │  │  (路由保护)  │  │  (认证 Hook)│ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────────────┘ │
│         │                 │                  │                           │
│         │ REST API        │ WebSocket        │ 认证状态                   │
│         │ /api/tasks/*    │ /ws/logs/{id}    │                           │
│         ▼                 ▼                  ▼                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    React Query + Zustand                             ││
│  │         (服务器状态缓存)           (UI 状态管理)                      ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP + WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         后端 (FastAPI)                                   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      API Routes                                      ││
│  │  /api/tasks/*  /api/auth/*  /api/plans/*  /api/workers/*  /health   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│         │                  │                  │                          │
│         ▼                  ▼                  ▼                          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                    │
│  │TaskService  │   │   Auth      │   │  WebSocket  │                    │
│  │(任务逻辑)   │   │  (认证)     │   │  Connection │                    │
│  └──────┬──────┘   └──────┬──────┘   │  Manager    │                    │
│         │                 │          └─────────────┘                    │
│         ▼                 │                  │                          │
│  ┌─────────────┐          │                  ▼                          │
│  │Dependency   │          │          ┌─────────────┐                    │
│  │Service      │          │          │ /ws/logs/*  │                    │
│  │(依赖检查)   │          │          │ /ws/events  │                    │
│  └──────┬──────┘          │          └─────────────┘                    │
│         │                 │                                              │
│         ▼                 ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    Ralph Loop (调度器)                               ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  ││
│  │  │ Worker Pool │  │  Depend-    │  │  Post-      │                  ││
│  │  │ (并发控制)  │  │  ency Check │  │  Process    │                  ││
│  │  └─────────────┘  └─────────────┘  │ (Git Merge) │                  ││
│  │                                   └─────────────┘                  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐        │
│  │  Worktree       │   │  Runner         │   │  Subprocess     │        │
│  │  Service        │   │  Service        │   │  Manager        │        │
│  │  (Git 隔离)     │   │  (任务执行)     │   │  (子进程管理)   │        │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘        │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      SQLite Database                                 ││
│  │  tasks | task_logs | task_conversations | plan_questions | projects ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Git Repository (项目仓库)                            │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  main_branch (当前分支)                                              ││
│  │         │                                                          ││
│  │         ├── worktrees/                                             ││
│  │         │   └── {project_name}-{task_id}/  ← 任务隔离目录           ││
│  │         │       (项目内部的 worktrees 目录)                           ││
│  │         │                                                          ││
│  │         └── branches/                                              ││
│  │             └── task-{task_id}  ← 任务分支                          ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 核心系统设计

### 1. WebSocket 双通道设计

#### 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                       WebSocket 双通道                           │
│                                                                  │
│  通道 1: /ws/logs/{task_id} - 任务日志流                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ - 每个任务一个独立连接                                       ││
│  │ - 事件类型：assistant, tool_use, tool_result, result, error ││
│  │ - 前端按需订阅感兴趣的任务                                   ││
│  │ - 断开重连后通过 HTTP 补全历史日志                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  通道 2: /ws/events - 全局事件                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ - 单例连接（所有组件共享）                                   ││
│  │ - 事件类型：task_created, task_updated, task_cancelled,     ││
│  │            scheduler_status                                  ││
│  │ - 前端使用 useGlobalEvents hook 统一监听                      ││
│  │ - 触发 React Query 数据失效                                   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

#### 设计优点

| 优点 | 说明 |
|------|------|
| **关注点分离** | 日志流与系统事件分离，减少不必要的数据传输 |
| **按需订阅** | 前端只订阅感兴趣的任务日志，节省带宽 |
| **全局通知** | 单例全局连接确保状态同步，避免重复连接 |
| **重连机制** | 日志通道断开时只影响单个任务，全局通道保持连接 |

#### 后端实现 (backend/app.py)

```python
class ConnectionManager:
    """WebSocket 连接管理器"""

    def __init__(self):
        # 任务日志连接：{task_id: [ws1, ws2, ...]}
        self.task_logs: Dict[int, List[WebSocket]] = {}
        # 全局事件连接：[ws1, ws2, ...]
        self.global_events: List[WebSocket] = []

    async def connect_task_log(self, websocket: WebSocket, task_id: int):
        """连接任务日志通道"""
        self.task_logs.setdefault(task_id, []).append(websocket)

    async def connect_global_event(self, websocket: WebSocket):
        """连接全局事件通道"""
        self.global_events.append(websocket)

    async def broadcast_to_task_logs(self, task_id: int, data: dict):
        """广播到任务日志通道"""
        message = json.dumps({"type": "log", "data": data})
        disconnected = []
        for i, ws in enumerate(self.task_logs.get(task_id, [])):
            try:
                await ws.send_text(message)
            except Exception:
                disconnected.append(i)
        # 清理断开的连接
        for i in reversed(disconnected):
            self.task_logs[task_id].pop(i)

    async def broadcast_global_event(self, data: dict):
        """广播到全局事件通道"""
        message = json.dumps({"type": "event", "data": data})
        disconnected = []
        for i, ws in enumerate(self.global_events):
            try:
                await ws.send_text(message)
            except Exception:
                disconnected.append(i)
        # 清理断开的连接
        for i in reversed(disconnected):
            self.global_events.pop(i)
```

#### 前端实现 (frontend/lib/hooks/useWebSocket.ts)

```typescript
// 全局 WebSocket 单例
let globalWsRef: GlobalWsRef | null = null;

export function initGlobalWebSocket() {
  if (globalWsRef?.ws?.readyState === WebSocket.OPEN) {
    return globalWsRef.listeners;
  }

  const listeners = new Set<(data: unknown) => void>();
  globalWsRef = { ws: null, listeners, isReconnecting: false };

  // 创建连接
  const ws = new WebSocket(`${WS_BASE_URL}/ws/events`);

  ws.onopen = () => {
    globalWsRef = { ws, listeners, isReconnecting: false };
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      listeners.forEach((listener) => listener(data));
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  };

  ws.onclose = () => {
    // 重连逻辑
    if (!globalWsRef?.isReconnecting) {
      scheduleReconnect();
    }
  };

  return listeners;
}

export function useGlobalEvents() {
  useEffect(() => {
    initGlobalWebSocket();
    const handleMessage = (data: unknown) => {
      const msg = data as { type?: string; data?: unknown };
      if (msg.type === 'task_updated') {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
    };
    globalWsRef?.listeners.add(handleMessage);
    return () => globalWsRef?.listeners.delete(handleMessage);
  }, []);
}
```

---

### 2. 任务调度系统 (Ralph Loop)

#### 调度流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      Ralph Loop 调度流程                         │
│                                                                  │
│  ┌─────────────┐                                               │
│  │ 1. 扫描任务 │ 扫描 queued 状态的任务                         │
│  └──────┬──────┘                                               │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │ 2. 检查依赖 │ DependencyService.check_dependencies()        │
│  └──────┬──────┘ 依赖不满足 → 跳过，等待下一轮                   │
│         ▼ 依赖满足                                               │
│  ┌─────────────┐                                               │
│  │ 3. 分配     │ 检查 Worker 池是否有空闲槽位                   │
│  └──────┬──────┘ 无空闲 → 等待                                   │
│         ▼ 有空闲                                                │
│  ┌─────────────┐                                               │
│  │ 4. 创建     │ WorktreeService.create_worktree()             │
│  │    Worktree │ - 创建分支 task-{task_id}                     │
│  │             │ - 创建隔离目录 worktrees/{project}-{task_id}  │
│  └──────┬──────┘                                               │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │ 5. 执行任务 │ RunnerService.run_claude_task()               │
│  │             │ - 启动 Claude CLI 子进程                        │
│  │             │ - 实时流式输出日志                             │
│  │             │ - 拦截 Plan 模式问答                            │
│  └──────┬──────┘                                               │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │ 6. 后处理   │ 隔离任务 → Git Merge + 清理 Worktree          │
│  └──────┬──────┘ 非隔离任务 → 直接完成                          │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │ 7. 更新状态 │ completed / reviewing / failed                │
│  └─────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

#### Worker 池管理

```python
class RalphLoop:
    def __init__(self, scheduler, db):
        self.scheduler = scheduler
        self.db = db
        self._workers = {}  # {task_id: worker_coroutine}
        self._lock = asyncio.Lock()

    async def _loop(self):
        """主调度循环"""
        while True:
            try:
                # 扫描可调度任务
                tasks = await self._scan_queued_tasks()
                # 检查依赖并分配
                await self._dispatch_tasks(tasks)
            except Exception as e:
                logger.exception(f"Dispatch error: {e}")
            # 5 秒后再次唤醒（或被 notify() 主动唤醒）
            await asyncio.sleep(5)

    async def _dispatch_tasks(self, tasks):
        """分发任务到 Worker"""
        async with self._lock:
            # 清理已完成的 Worker
            done = [tid for tid, t in self._workers.items() if t.done()]
            for tid in done:
                del self._workers[tid]

            # 分配新任务（不超过并发限制）
            for task in tasks:
                if len(self._workers) >= settings.MAX_CONCURRENT:
                    break
                if task['id'] in self._workers:
                    continue
                # 启动 Worker
                worker = asyncio.create_task(
                    self._run_and_release(task)
                )
                self._workers[task['id']] = worker
```

#### 任务执行流程 (runner_service.py)

```python
async def run_claude_task(task: dict, project: dict, worktree: dict | None = None) -> str:
    """执行 Claude Code CLI 任务"""

    # 1. 构建 CLI 参数
    args = build_claude_args(task, project, worktree)

    # 2. 启动子进程（流式输出）
    process = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=worktree_path or project_path
    )

    # 3. 读取并解析 stream-json 输出
    async for line in process.stdout:
        event = parse_json_line(line)
        if event is None:
            continue

        # 3.1 记录日志到数据库
        await record_task_log(task_id, event)

        # 3.2 广播到 WebSocket
        await broadcast_to_task_logs(task_id, event)

        # 3.3 分类处理事件
        if event['type'] == 'assistant':
            # 检测是否进入 Plan 模式
            if is_plan_mode_question(event['content']):
                await intercept_plan_mode(task_id, event)

        elif event['type'] == 'result':
            result = event['result']  # 'success' / 'failure' / 'error'

    # 4. 等待子进程结束
    returncode = await process.wait()

    # 5. 返回最终状态
    return 'completed' if returncode == 0 else 'failed'
```

---

### 3. Git Worktree 任务隔离

#### Worktree 创建流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    Worktree 创建流程                             │
│                                                                  │
│  项目目录：/path/to/project (main 分支)                          │
│                     │                                            │
│                     │ git worktree add -b task-{task_id}        │
│                     ▼                                            │
│  Worktree 目录：/path/to/project/worktrees/{project_name}-{task_id}          │
│                     │                                            │
│                     │ HEAD → task-{task_id} 分支                 │
│                     │                                            │
│                     ▼                                            │
│  Claude Code 在 worktree 目录内执行                              │
│  - 所有修改隔离在独立分支                                        │
│  - 不影响主项目                                                  │
│                                                                  │
│  任务完成后：                                                    │
│  1. git add -A (提交更改)                                        │
│  2. git commit -m "task-{task_id}: ..."                          │
│  3. git checkout {source_branch} (切回主项目)                    │
│  4. git merge --no-ff task-{task_id} (合并到主分支)              │
│  5. git worktree remove (删除 worktree)                          │
│  6. git branch -D task-{task_id} (删除分支)                      │
└─────────────────────────────────────────────────────────────────┘
```

#### Worktree 服务实现

```python
class WorktreeService:
    async def create_worktree(
        self,
        project_id: int,
        task_id: int,
        branch_name: Optional[str] = None,
    ) -> Optional[Dict[str, str]]:
        """为任务创建 Worktree"""
        project = await self.get_project(project_id)
        project_path = project["path"]

        # 获取当前分支（而非固定的 main_branch）
        code, current_branch, _ = await self._run_git(
            ["rev-parse", "--abbrev-ref", "HEAD"], cwd=project_path
        )
        source_branch = current_branch.strip() if code == 0 else project.get("main_branch", "main")

        # Worktree 路径：${project_path}/worktrees/${project_name}-${task_id}
        # 所有项目的 worktree 统一放到项目内部的 worktrees 目录下
        worktree_path = os.path.join(
            project_path,
            "worktrees",
            f"{project['name']}-{task_id}"
        )

        # 创建 worktree + 新分支
        code, out, err = await self._run_git(
            ["worktree", "add", "-b", f"task-{task_id}", worktree_path, source_branch],
            cwd=project_path
        )

        return {"path": worktree_path, "branch": f"task-{task_id}", "project_id": project_id}

    async def merge_and_cleanup(
        self,
        project_id: int,
        task_id: int,
        branch_name: str,
        worktree_path: str,
        commit_msg: str,
    ) -> Tuple[bool, str]:
        """提交更改、合并到主分支、清理 worktree"""
        project = await self.get_project(project_id)
        project_path = project["path"]

        # 1. 提交 worktree 内的更改
        await self._run_git(["add", "-A"], cwd=worktree_path)
        await self._run_git(["commit", "-m", commit_msg], cwd=worktree_path)

        # 2. 合并到源分支
        await self._run_git(["checkout", source_branch], cwd=project_path)
        await self._run_git(
            ["merge", "--no-ff", "-m", commit_msg, branch_name],
            cwd=project_path
        )

        # 3. 清理 worktree 和分支
        await self._run_git(["worktree", "remove", worktree_path, "--force"], cwd=project_path)
        await self._run_git(["branch", "-D", branch_name], cwd=project_path)
```

---

### 4. 前端状态管理

#### Zustand + React Query 混合架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    前端状态管理架构                              │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    Zustand Store                           │ │
│  │  (UI 状态 - 瞬时、交互相关)                                 │ │
│  │                                                            │ │
│  │  - selectedTaskId: number | null    (选中的任务 ID)         │ │
│  │  - wsConnected: boolean             (WebSocket 连接状态)    │ │
│  │  - toasts: Toast[]                  (通知消息)             │ │
│  │  - drawerOpen: boolean              (抽屉打开状态)          │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                  React Query Cache                         │ │
│  │  (服务器状态 - 持久、可同步)                                │ │
│  │                                                            │ │
│  │  - ['tasks']: Task[]                (任务列表)             │ │
│  │  - ['tasks', id]: Task              (单个任务)             │ │
│  │  - ['workers']: Worker[]            (Worker 状态)          │ │
│  │  - ['status']: SystemStatus         (系统状态)             │ │
│  │  - ['plans']: Plan[]                (任务计划)             │ │
│  │                                                            │ │
│  │  配置：staleTime: 5000 (5 秒后失效)                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  WebSocket 事件触发数据同步：                                    │
│  - task_created  → invalidateQueries(['tasks'])                 │
│  - task_updated  → invalidateQueries(['tasks'])                 │
│  - scheduler_status → setQueryData(['status'], newStatus)       │
└─────────────────────────────────────────────────────────────────┘
```

#### 设计优点

| 优点 | 说明 |
|------|------|
| **职责分离** | Zustand 管理 UI 状态，React Query 管理服务器数据 |
| **自动缓存** | React Query 自动处理缓存、失效、重新获取 |
| **乐观更新** | 支持乐观更新，提升用户体验 |
| **WebSocket 同步** | WebSocket 事件触发数据失效，保持实时性 |

---

### 5. 认证系统

详见 [AUTHENTICATION.md](./AUTHENTICATION.md)

#### 核心特性

- **可选认证**: 未配置密码时自动跳过
- **内存 Session**: 轻量级，重启即失效
- **HttpOnly Cookie**: 防 XSS，SameSite=Lax 防 CSRF
- **自动过期**: 默认 24 小时，可配置 1-7 天

---

## 数据库设计

### 核心表结构

```sql
-- 任务表
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    prompt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',  -- queued | running | reviewing | completed | cancelled | failed
    priority INTEGER DEFAULT 5,
    cwd TEXT,  -- 工作目录
    is_isolated BOOLEAN DEFAULT 1,  -- 是否使用 worktree 隔离
    depends_on TEXT,  -- JSON 数组，依赖的任务 ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 任务日志表
CREATE TABLE task_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,  -- assistant | tool_use | tool_result | result | error
    content TEXT,  -- JSON 格式
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 任务对话表（多轮对话历史）
CREATE TABLE task_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    round INTEGER NOT NULL DEFAULT 1,  -- 第几轮
    prompt TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Plan 模式问题表
CREATE TABLE plan_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    question_index INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,  -- 用户回答
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | answered
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 项目表
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    main_branch TEXT DEFAULT 'main',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 索引优化

```sql
-- 任务查询优化
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);

-- 日志查询优化
CREATE INDEX idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX idx_task_logs_created_at ON task_logs(created_at);
```

---

## API 设计

### 任务相关

| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/tasks` | GET | ✅ | 获取任务列表（支持分页、过滤） |
| `/api/tasks` | POST | ✅ | 创建新任务 |
| `/api/tasks/{id}` | GET | ✅ | 获取单个任务详情 |
| `/api/tasks/{id}` | PUT | ✅ | 更新任务信息 |
| `/api/tasks/{id}` | DELETE | ✅ | 删除任务 |
| `/api/tasks/{id}/approve` | POST | ✅ | 批准任务（Plan 模式） |
| `/api/tasks/{id}/answer` | POST | ✅ | 回答 Plan 模式问题 |
| `/api/tasks/{id}/continue` | POST | ✅ | 继续执行（新 prompt） |
| `/api/tasks/{id}/cancel` | POST | ✅ | 取消任务 |

### 认证相关

| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/auth/login` | POST | ❌ | 密码登录 |
| `/api/auth/status` | GET | ❌ | 检查认证状态 |
| `/api/auth/logout` | POST | ❌ | 登出 |

### WebSocket 相关

| 端点 | 事件 | 说明 |
|------|------|------|
| `/ws/logs/{task_id}` | `log` | 任务日志流式输出 |
| `/ws/events` | `task_created` | 新任务创建 |
| `/ws/events` | `task_updated` | 任务状态更新 |
| `/ws/events` | `task_cancelled` | 任务取消 |
| `/ws/events` | `scheduler_status` | 调度器状态 |

---

## 部署架构

### Docker Compose 部署

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - PASSWORD=${PASSWORD:-}
      - SESSION_MAX_AGE=86400
      - DATABASE_URL=sqlite+aiosqlite:///data/agent-center.db
    volumes:
      - ./data:/data
      - /var/run/docker.sock:/var/run/docker.sock  # Claude CLI 需要
    ports:
      - "8010:8010"
    networks:
      - ac-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_API_DOMAIN=http://backend:8010
        - NEXT_PUBLIC_WS_DOMAIN=ws://localhost:8010
    ports:
      - "3000:3000"
    depends_on:
      - backend
    networks:
      - ac-network

networks:
  ac-network:
    driver: bridge
```

### 环境变量配置

```bash
# .env 文件

# 认证（可选）
PASSWORD="your_secure_password"

# Session 有效期（秒）
SESSION_MAX_AGE=86400  # 24 小时

# 最大并发任务数
MAX_CONCURRENT=3

# 数据库路径
DATABASE_URL=sqlite+aiosqlite:///data/agent-center.db

# 日志级别
LOG_LEVEL=INFO  # DEBUG | INFO | WARNING | ERROR
```

---

## 安全性

### 已实现的安全措施

| 措施 | 说明 |
|------|------|
| **HttpOnly Cookie** | 防止 XSS 攻击窃取 session_id |
| **SameSite=Lax** | 基础 CSRF 防护 |
| **常量时间密码比较** | 使用 `secrets.compare_digest` 防止时序攻击 |
| **CORS 限制** | 默认只允许 localhost 访问 |
| **输入验证** | Pydantic 验证请求数据 |
| **Git 隔离** | Worktree 隔离任务，防止互相干扰 |

### 待增强的安全领域

| 领域 | 建议 |
|------|------|
| **输入验证** | 添加命令注入防护（cwd、prompt 转义） |
| **CSRF Token** | 表单场景添加 CSRF Token |
| **速率限制** | 登录接口添加限流保护 |
| **审计日志** | 记录敏感操作日志 |

---

## 性能优化

### 已实现的优化

| 优化 | 说明 |
|------|------|
| **数据库索引** | status、priority、created_at 字段索引 |
| **WAL 模式** | SQLite WAL 模式支持并发读取 |
| **连接池** | 10 个数据库连接池 |
| **WebSocket 单例** | 全局事件通道单例连接 |
| **事件驱动调度** | `scheduler.notify()` 主动唤醒，减少轮询延迟 |
| **React Query 缓存** | 5 秒 staleTime，减少不必要请求 |

### 待优化领域

| 领域 | 建议 |
|------|------|
| **日志归档** | 定期清理/归档旧日志，防止数据库膨胀 |
| **分页查询** | 任务列表支持游标分页 |
| **Redis Session** | 多机部署时共享 Session |

---

## 限制与注意事项

### 1. 内存 Session 的局限性

- 服务重启后所有用户需重新登录
- 多服务器部署时 Session 不共享

**解决方案**: 使用 Redis 存储 Session

### 2. Worktree 创建失败处理

- Worktree 创建失败时任务可能进入 `running` 状态

**建议**: 添加 worktree 创建失败时的状态回滚机制

### 3. 前端测试缺失

- 当前无单元测试和 E2E 测试

**建议**: 添加 Jest + React Testing Library 单元测试，Playwright E2E 测试

### 4. 错误处理/重试机制

- 子进程超时后无自动重试

**建议**: 添加可配置的重试机制（最大重试次数、重试间隔）

---

## 相关文件索引

| 文件 | 路径 | 说明 |
|------|------|------|
| **后端入口** | `backend/app.py` | FastAPI 应用、WebSocket 管理 |
| **调度器** | `backend/scheduler/loop.py` | Ralph Loop 调度逻辑 |
| **任务执行** | `backend/runner_service.py` | Claude CLI 子进程管理 |
| **Worktree** | `backend/worktree_service.py` | Git Worktree 操作 |
| **依赖检查** | `backend/services/dependency_service.py` | 任务依赖管理 |
| **认证逻辑** | `backend/auth.py` | Session 管理 |
| **认证中间件** | `backend/middleware/auth.py` | 请求认证拦截 |
| **前端 Hook** | `frontend/lib/hooks/useWebSocket.ts` | WebSocket 单例管理 |
| **全局事件** | `frontend/lib/hooks/useGlobalEvents.ts` | 全局事件监听 |
| **任务抽屉** | `frontend/components/drawers/TaskDrawer.tsx` | 任务详情 + 日志流 |
| **数据库** | `backend/db.py` | SQLite Schema |

---

## 常见问题

### Q1: WebSocket 断开后如何处理？

**A**: 前端会自动重连。重连后，TaskDrawer 组件会通过 HTTP API (`GET /api/tasks/{id}`) 补全历史日志。

### Q2: 多任务并发如何控制？

**A**: 通过 `MAX_CONCURRENT` 环境变量控制 Worker 池大小，默认 3 个并发。

### Q3: Worktree 隔离和非隔离有什么区别？

**A**:
- **隔离任务**: 创建独立 worktree 和分支，执行完成后 Git Merge 回主分支
- **非隔离任务**: 直接在主项目目录执行，无 Git 操作

### Q4: Plan 模式如何工作？

**A**: Claude Code CLI 进入 Plan 模式时会提出问题，后端拦截并存储到 `plan_questions` 表，前端通过 Approval UI 让用户回答。

### Q5: 如何临时禁用认证？

**A**: 设置 `PASSWORD=""` 环境变量，重启后端服务即可。
