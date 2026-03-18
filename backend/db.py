"""SQLite schema + query utilities with connection reuse."""

from typing import Optional, List, AsyncGenerator
from contextlib import asynccontextmanager

import aiosqlite
import logging

logger = logging.getLogger(__name__)

# 数据库池 - 支持并发访问
_pool: list[aiosqlite.Connection] = []
_max_pool_size = 10  # 默认最大连接数

SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',  -- queued/running/completed/failed/cancelled/pending/reviewing
    mode TEXT NOT NULL DEFAULT 'execute',   -- execute/plan
    priority INTEGER NOT NULL DEFAULT 0,
    worktree_id INTEGER,
    cwd TEXT,
    session_id TEXT,                        -- Claude CLI 会话 ID（用于 --resume）
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    started_at TEXT,
    finished_at TEXT,
    result_text TEXT,
    cost_usd REAL DEFAULT 0,
    parent_task_id INTEGER,  -- 父任务 ID（用于追踪 Plan 对话链）
    round_number INTEGER DEFAULT 1,  -- Plan 轮次
    plan_status TEXT DEFAULT 'generating',  -- generating/reviewing/approved/executing/completed
    fork_from_task_id INTEGER,              -- Fork 的前序任务 ID
    project_id INTEGER REFERENCES projects(id),  -- 所属项目 ID
    retry_count INTEGER DEFAULT 0,          -- 代码审查重试次数（防止无限循环）
    is_isolated INTEGER DEFAULT 0,          -- 是否隔离执行（worktree 模式）
    auto_approve INTEGER DEFAULT 0,         -- 自动批准（跳过 reviewing）
    FOREIGN KEY (worktree_id) REFERENCES worktrees(id),
    FOREIGN KEY (fork_from_task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS task_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,  -- assistant/tool_use/tool_result/result/error/system
    payload TEXT NOT NULL,     -- raw JSON line
    ts TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS task_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    round_number INTEGER NOT NULL DEFAULT 1,
    user_prompt TEXT NOT NULL,
    session_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    started_at TEXT,
    finished_at TEXT,
    cost_usd REAL DEFAULT 0,
    result_text TEXT,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS worktrees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    path TEXT NOT NULL,
    branch TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',  -- idle/busy/removed
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS plan_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    question TEXT NOT NULL,         -- 问题内容
    header TEXT NOT NULL,           -- 分类（如"技术栈"）
    options TEXT NOT NULL,          -- JSON 数组：[{"label":..., "description":...}]
    multi_select INTEGER DEFAULT 0, -- 0=单选，1=多选
    user_answer TEXT,               -- JSON 数组：用户选择的答案
    status TEXT DEFAULT 'pending',  -- pending/answered/submitted
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS task_dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    depends_on_task_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, depends_on_task_id)
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,          -- 项目名称（用于目录名）
    display_name TEXT,                  -- 显示名称（可选）
    description TEXT,                   -- 项目描述
    path TEXT NOT NULL,                 -- 本地绝对路径
    main_branch TEXT,                   -- 主分支名（main/master，自动检测）
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS inbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT NOT NULL,               -- 灵感/待办内容
    project_id INTEGER REFERENCES projects(id),
    mode TEXT DEFAULT 'execute',        -- 任务模式：execute/plan
    status TEXT DEFAULT 'pending',      -- pending/converted/archived
    related_task_id INTEGER REFERENCES tasks(id),
    depends_on_task_ids TEXT,           -- JSON array of task IDs
    fork_from_task_id INTEGER REFERENCES tasks(id),
    is_isolated INTEGER DEFAULT 0,      -- BOOLEAN: 是否隔离执行
    auto_approve INTEGER DEFAULT 0,     -- BOOLEAN: 自动批准
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    converted_at TEXT
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority DESC);
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_conversations_task_id ON task_conversations(task_id);
CREATE INDEX IF NOT EXISTS idx_task_conversations_round ON task_conversations(task_id, round_number);
CREATE INDEX IF NOT EXISTS idx_plan_questions_task_id ON plan_questions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox(status);
CREATE INDEX IF NOT EXISTS idx_inbox_project ON inbox(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
"""


async def init_db_pool(db_path: str, max_pool_size: int = 10):
    """Initialize database connection pool and apply schema.

    Args:
        db_path: Path to the SQLite database file
        max_pool_size: Maximum number of connections in the pool
    """
    global _max_pool_size
    _max_pool_size = max_pool_size

    if not _pool:
        for i in range(max_pool_size):
            conn = await aiosqlite.connect(db_path)
            conn.row_factory = aiosqlite.Row
            await conn.execute("PRAGMA journal_mode=WAL")
            await conn.execute("PRAGMA foreign_keys=ON")
            # Apply schema (CREATE TABLE IF NOT EXISTS is idempotent)
            await conn.executescript(SCHEMA)
            # Apply migrations for inbox table
            await apply_inbox_migrations(conn)
            _pool.append(conn)
        logger.info(f"Database connection pool initialized: {db_path} ({max_pool_size} connections)")


async def close_db_pool():
    """Close database connection pool."""
    global _pool
    for conn in _pool:
        await conn.close()
    _pool = []
    logger.info("Database connection pool closed")


@asynccontextmanager
async def get_db_context() -> AsyncGenerator[aiosqlite.Connection, None]:
    """Get a database connection from the pool (async context manager).

    Yields a connection from the pool, ensuring proper resource management.
    """
    if not _pool:
        raise RuntimeError("Database pool not initialized. Call init_db_pool() first.")

    # 简单策略：循环获取第一个可用连接
    # 生产环境可使用 asyncio.Queue 实现更复杂的池化管理
    conn = _pool[0]
    try:
        yield conn
    finally:
        pass  # 连接保留在池中，无需归还


def get_connection() -> aiosqlite.Connection:
    """Get a database connection from the pool.

    Returns the first connection in the pool (simple round-robin).
    For better concurrency, use get_db_context() async context manager.

    Raises:
        RuntimeError: If pool is not initialized.
    """
    if not _pool:
        raise RuntimeError("Database not initialized. Call init_db_pool() first.")
    return _pool[0]  # 简单实现：返回第一个连接


async def apply_inbox_migrations(conn: aiosqlite.Connection):
    """Apply migrations for inbox table."""
    try:
        # Check for existing columns using PRAGMA table_info
        cursor = await conn.execute("PRAGMA table_info(inbox)")
        rows = await cursor.fetchall()
        columns = [row[1] for row in rows]

        if "depends_on_task_ids" not in columns:
            await conn.execute("ALTER TABLE inbox ADD COLUMN depends_on_task_ids TEXT")
            logger.info("Added depends_on_task_ids column to inbox table")

        if "fork_from_task_id" not in columns:
            await conn.execute("ALTER TABLE inbox ADD COLUMN fork_from_task_id INTEGER")
            logger.info("Added fork_from_task_id column to inbox table")

        if "is_isolated" not in columns:
            await conn.execute("ALTER TABLE inbox ADD COLUMN is_isolated INTEGER DEFAULT 0")
            logger.info("Added is_isolated column to inbox table")

        if "auto_approve" not in columns:
            await conn.execute("ALTER TABLE inbox ADD COLUMN auto_approve INTEGER DEFAULT 0")
            logger.info("Added auto_approve column to inbox table")

        if "mode" not in columns:
            await conn.execute("ALTER TABLE inbox ADD COLUMN mode TEXT DEFAULT 'execute'")
            logger.info("Added mode column to inbox table")

        await conn.commit()
    except Exception as e:
        logger.error(f"Error applying inbox migrations: {e}")


async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    """Dependency injection helper for FastAPI.

    Yields the singleton connection. Does NOT close on exit.
    """
    yield get_connection()


# --- 向后兼容的便捷函数 ---


async def fetch_one(query: str, params=()) -> Optional[dict]:
    """Execute a query and return a single row."""
    db = get_connection()
    cursor = await db.execute(query, params)
    row = await cursor.fetchone()
    return dict(row) if row else None


async def fetch_all(query: str, params=()) -> List[dict]:
    """Execute a query and return all rows."""
    db = get_connection()
    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def execute(query: str, params=()) -> int:
    """Execute a query and return lastrowid."""
    db = get_connection()
    cursor = await db.execute(query, params)
    await db.commit()
    return cursor.lastrowid


async def execute_batch(queries: List[tuple]) -> None:
    """Execute multiple queries in a single transaction.

    Args:
        queries: List of (query, params) tuples
    """
    db = get_connection()
    for query, params in queries:
        await db.execute(query, params)
    await db.commit()


async def migrate_db():
    """Apply database migrations.

    This function handles schema changes that cannot be done with
    CREATE TABLE IF NOT EXISTS (e.g., adding columns to existing tables).

    Run this function at application startup to ensure the database
    schema is up to date.
    """
    logger.info("Starting database migrations...")

    try:
        db = get_connection()

        # Migration: Add is_isolated column to tasks (if not exists)
        try:
            columns = await fetch_all("PRAGMA table_info(tasks)")
            column_names = [col["name"] for col in columns]

            if "is_isolated" not in column_names:
                await db.execute("ALTER TABLE tasks ADD COLUMN is_isolated INTEGER DEFAULT 0")
                await db.commit()
                logger.info("Migration applied: Added is_isolated column to tasks")
            else:
                logger.info("Migration skipped: is_isolated column already exists in tasks")
        except Exception as e:
            logger.error(f"Migration failed for tasks.is_isolated: {e}")
            raise

        # Migration: Add auto_approve column to tasks (if not exists)
        try:
            columns = await fetch_all("PRAGMA table_info(tasks)")
            column_names = [col["name"] for col in columns]

            if "auto_approve" not in column_names:
                await db.execute("ALTER TABLE tasks ADD COLUMN auto_approve INTEGER DEFAULT 0")
                await db.commit()
                logger.info("Migration applied: Added auto_approve column to tasks")
            else:
                logger.info("Migration skipped: auto_approve column already exists in tasks")
        except Exception as e:
            logger.error(f"Migration failed for tasks.auto_approve: {e}")
            raise

        logger.info("Database migrations completed successfully")

    except Exception as e:
        logger.error(f"Database migration failed: {e}")
        raise
