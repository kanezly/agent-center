"""Status and worker API routes."""

from fastapi import APIRouter

from db import fetch_all

router = APIRouter(tags=["status"])


@router.get("/status")
async def get_status():
    """Get system status."""
    import app

    tasks = await fetch_all("SELECT status, COUNT(*) as count FROM tasks GROUP BY status")
    status_map = {t["status"]: t["count"] for t in tasks}

    # In the new flow, worktrees are temporary and managed per-task
    # Return placeholder values for backward compatibility
    return {
        "tasks": status_map,
        "worktrees_total": 0,  # Dynamic worktrees, no persistent pool
        "worktrees_busy": 0,
        "max_concurrent": app.scheduler.max_concurrent if app.scheduler else 0,
        "workers": app.scheduler.get_workers() if app.scheduler else [],
    }


@router.get("/workers")
async def get_workers():
    """Get worker status."""
    import app

    if not app.scheduler:
        return []
    return app.scheduler.get_workers()
