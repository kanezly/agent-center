"""FastAPI main application — routes, WebSocket, startup/shutdown."""

from typing import Optional, List, Dict

import asyncio
import json
import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import PORT, CORS_ORIGINS, settings, check_claude_cli, check_git
from db import init_db_pool, close_db_pool, migrate_db
from scheduler import RalphLoop
from utils.signals import get_signal_handler

# Import routers
from routes import tasks_router, plans_router, status_router, projects_router, filesystem_router, inbox_router, auth_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


# --- WebSocket manager ---

class ConnectionManager:
    """Manages WebSocket connections for task logs and global events."""

    def __init__(self):
        self.task_connections: Dict[int, List[WebSocket]] = {}
        self.event_connections: List[WebSocket] = []

    async def connect_task(self, ws: WebSocket, task_id: int):
        await ws.accept()
        self.task_connections.setdefault(task_id, []).append(ws)

    async def connect_events(self, ws: WebSocket):
        await ws.accept()
        self.event_connections.append(ws)

    def disconnect_task(self, ws: WebSocket, task_id: int):
        conns = self.task_connections.get(task_id, [])
        if ws in conns:
            conns.remove(ws)

    def disconnect_events(self, ws: WebSocket):
        if ws in self.event_connections:
            self.event_connections.remove(ws)

    async def broadcast(self, task_id: int, event_type: str, payload: dict):
        msg = json.dumps({"task_id": task_id, "event_type": event_type, "payload": payload}, ensure_ascii=False)

        # Send to task-specific subscribers
        for ws in list(self.task_connections.get(task_id, [])):
            try:
                await ws.send_text(msg)
            except Exception as e:
                logger.debug(f"WebSocket task broadcast failed: {e}")
                self.task_connections[task_id].remove(ws)

        # Send to global event subscribers
        for ws in list(self.event_connections):
            try:
                await ws.send_text(msg)
            except Exception as e:
                logger.debug(f"WebSocket event broadcast failed: {e}")
                self.event_connections.remove(ws)

    async def broadcast_global(self, event_type: str, data: dict):
        """Broadcast a global event (not tied to a specific task)."""
        msg = json.dumps({"type": event_type, "data": data}, ensure_ascii=False)
        for ws in list(self.event_connections):
            try:
                await ws.send_text(msg)
            except Exception as e:
                logger.debug(f"WebSocket global broadcast failed: {e}")
                self.event_connections.remove(ws)


# Global instances (accessed by routers via this module)
manager = ConnectionManager()
scheduler: Optional[RalphLoop] = None


# --- Lifespan ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    global scheduler

    # Check dependencies
    check_claude_cli()
    check_git()

    # Initialize database connection pool
    await init_db_pool(settings.DB_PATH_ABS)

    # Apply database migrations
    await migrate_db()

    scheduler = RalphLoop(
        max_concurrent=settings.MAX_CONCURRENT,
        broadcast=manager.broadcast,
        broadcast_global=manager.broadcast_global,
    )
    scheduler.start()

    # 安装信号处理器
    signal_handler = get_signal_handler()
    signal_handler.install()

    # 注册清理回调：停止调度器
    async def cleanup_running_tasks():
        logger.info("Stopping all running tasks...")
        if scheduler:
            await scheduler.stop()
        logger.info("Cleanup completed")

    signal_handler.register_cleanup(cleanup_running_tasks)

    yield

    # 卸载信号处理器
    signal_handler.uninstall()

    # Cleanup
    await scheduler.stop()
    await close_db_pool()


# --- FastAPI App ---

app = FastAPI(title="AgentCenter", lifespan=lifespan)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth Middleware (must be added after CORS)
from middleware.auth import AuthMiddleware
app.add_middleware(AuthMiddleware)

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(plans_router, prefix="/api")
app.include_router(status_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(filesystem_router, prefix="/api")
app.include_router(inbox_router, prefix="/api")


# --- Health check endpoint ---

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring and load balancers."""
    from db import get_connection
    import time

    start = time.time()
    healthy = True
    checks = {}

    # Check database
    try:
        db = get_connection()
        await db.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)[:50]}"
        healthy = False

    # Check scheduler
    checks["scheduler"] = "running" if scheduler else "stopped"

    response_time = round((time.time() - start) * 1000, 2)
    return {
        "status": "healthy" if healthy else "unhealthy",
        "checks": checks,
        "response_time_ms": response_time,
    }


# --- WebSocket endpoints ---

@app.websocket("/ws/logs/{task_id}")
async def ws_task_logs(ws: WebSocket, task_id: int):
    """WebSocket endpoint for task log streaming."""
    await manager.connect_task(ws, task_id)
    try:
        # History is loaded via HTTP GET /api/tasks/{id} — WebSocket only streams new events
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_task(ws, task_id)


@app.websocket("/ws/events")
async def ws_events(ws: WebSocket):
    """WebSocket endpoint for global event streaming."""
    await manager.connect_events(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_events(ws)


# --- Hook: post-task completion ---

original_broadcast = manager.broadcast


async def enhanced_broadcast(task_id: int, event_type: str, payload: dict):
    """Enhanced broadcast with post-task hooks."""
    await original_broadcast(task_id, event_type, payload)
    # Note: plan mode completion is handled in ralph_loop._run_and_release
    # AFTER result_text is saved to DB. Do NOT handle it here.


manager.broadcast = enhanced_broadcast


# --- Entry point ---

def run_server():
    """Entry point for the ac command."""
    import socket
    import uvicorn

    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT

    # 获取并打印本机 IP 地址，方便用户知道局域网访问地址
    local_ips = []
    try:
        hostname = socket.gethostname()
        ip_list = socket.getaddrinfo(hostname, None, socket.AF_INET)
        for ip_info in ip_list:
            ip = ip_info[4][0]
            if not ip.startswith("127."):
                local_ips.append(ip)
    except Exception as e:
        logger.warning(f"获取本机 IP 地址失败：{e}")

    logger.info("Starting AgentCenter API on port %d", port)
    logger.info("Access URLs:")
    logger.info("  Local:   http://localhost:%d", port)
    for ip in local_ips:
        logger.info("  Network: http://%s:%d", ip, port)

    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        access_log=False,
    )


if __name__ == "__main__":
    run_server()
