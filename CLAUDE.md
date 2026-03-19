# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AgentCenter is a task orchestration platform for Claude Code CLI that provides:
- Task state visualization and dependency orchestration
- Execution isolation via git worktree
- Real-time logging via WebSocket

**Tech Stack:**
- Backend: FastAPI (Python 3.13+) with SQLite (WAL mode)
- Frontend: Next.js 14, React 18, TypeScript, TailwindCSS
- Agent: Claude Code CLI (@anthropic-ai/claude-code)

## Quick Commands

### Backend

```bash
cd backend

# Development server
uvicorn app:app --host 0.0.0.0 --port 8010

# Or use the CLI entry point
uv sync
ac  # Runs on default port 8010

# Run tests
pytest

# Lint and type check
ruff check .
mypy .
```

### Frontend

```bash
cd frontend

# Development server
npm run dev    # http://localhost:3010

# Production build
npm run build
npm run start

# Lint and type check
npm run lint
npm run type-check
```

## Architecture

### Backend Structure (`backend/`)

```
backend/
├── app.py                 # FastAPI entry point, WebSocket manager, lifespan
├── auth.py                # Session-based authentication
├── config.py              # Environment configuration
├── db.py                  # SQLite connection pool
├── middleware/
│   └── auth.py            # Authentication middleware
├── routes/
│   ├── tasks.py           # Task CRUD, execution, WebSocket logs
│   ├── plans.py           # Plan approval workflow
│   ├── inbox.py           # Idea inbox (暂存区)
│   ├── projects.py        # Project management
│   ├── filesystem.py      # File operations
│   ├── auth.py            # Login/logout
│   └── status.py          # System status
├── scheduler/
│   ├── loop.py            # RalphLoop - main scheduler (polls every 5s)
│   └── worker.py          # Worker pool management
├── services/
│   ├── task_service.py    # Task business logic
│   ├── runner_service.py  # Claude Code CLI runner (--fork-session, --resume)
│   ├── worktree_service.py # Git worktree create/merge/cleanup
│   ├── dependency_service.py # Task dependency resolution
│   └── plan_service.py    # Plan mode handling
└── utils/
    └── signals.py         # Signal handling for graceful shutdown
```

### Frontend Structure (`frontend/`)

```
frontend/
├── app/
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Main task list view
│   ├── login/
│   │   └── page.tsx       # Login page
│   └── api/               # Runtime config endpoint
├── components/
│   ├── TaskInput.tsx      # Create task form (project, mode, deps, isolation)
│   ├── UnifiedView.tsx    # Task list with filters
│   ├── TaskDrawer.tsx     # Task detail with log streaming
│   ├── PlanDrawer.tsx     # Plan review and approval
│   └── InboxCard.tsx      # Idea inbox items
├── lib/
│   ├── api.ts             # API client
│   ├── useWebSocket.ts    # WebSocket hook for logs
│   └── store.ts           # Zustand state management
├── types/
│   └── index.ts           # TypeScript type definitions
└── middleware.ts          # Auth middleware
```

### Key Data Flow

1. **Task Creation**: `POST /api/tasks` → queued state
2. **Scheduling**: RalphLoop polls every 5s → checks dependencies → assigns worker
3. **Execution**: RunnerService spawns Claude Code CLI with `--fork-session`, `--resume`, `--add-dir`
4. **Logging**: WebSocket `/ws/logs/{task_id}` streams real-time output
5. **Completion**: Auto-merge (git worktree) → cleanup → completed state

### Task States

- `queued`: Waiting for dependencies
- `running`: Claude Code CLI executing
- `reviewing`: Waiting for human approval (Plan mode or merge conflicts)
- `completed`: Finished successfully
- `failed`: Execution failed

## Environment Configuration

### Backend (`.env`)

```bash
MAX_CONCURRENT=5          # Max concurrent tasks
PASSWORD=your_password    # Login password (optional)
SESSION_MAX_AGE=86400     # Session TTL in seconds
DB_PATH=task_manager.db   # SQLite database path
TASK_TIMEOUT=3600         # Task timeout in seconds
POST_PROCESS_TIMEOUT=600  # Post-processing timeout
```

### Frontend (`.env`)

```bash
NEXT_PUBLIC_API_DOMAIN=http://localhost:8010
NEXT_PUBLIC_WS_DOMAIN=ws://localhost:8010
```

## Patterns & Conventions

### Immutability

Create new objects instead of mutating:
```python
# Use in services when updating task state
new_state = {**old_state, "status": "running"}
```

### Error Handling

- Backend: Explicit error handling in all routes, return structured errors
- Frontend: Error boundaries in components, user-friendly messages

### API Response Format

All endpoints return consistent format:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### WebSocket Protocol

```typescript
// Message format
{
  task_id: number;
  event_type: "log" | "state_change" | "error";
  payload: any;
}
```

## Testing

```bash
# Backend tests
cd backend
pytest                          # Run all tests
pytest -k test_api              # Run specific test module
pytest --cov=.                  # With coverage

# Frontend tests (if configured)
cd frontend
npm test
```

## Git Workflow

- Main branch: `main`
- Feature branches: Feature development
- Worktree branches: `task-{id}` (auto-created, auto-merged, auto-deleted)

## Docker Deployment

```bash
# Quick start
docker-compose up -d

# Access
open http://localhost:3010
```

See README.md for detailed setup instructions.
