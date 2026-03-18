"""Plan API routes - simplified version.

This module provides read-only access to plan mode task results.
No approval workflow, no subtasks - just viewing generated Markdown documents.

The plan workflow is:
1. Create task with mode='plan' via POST /api/tasks
2. Claude Code runs with --permission-mode plan
3. Markdown document is stored in task_logs
4. User views via GET /api/plan/{task_id}/markdown
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import fetch_one, fetch_all, execute
from services.plan_service import PlanService

router = APIRouter(tags=["plans"])


def get_plan_service() -> PlanService:
    """Get plan service instance."""
    from db import get_connection
    return PlanService(get_connection())


@router.get("/plans")
async def list_plans():
    """List all plan tasks (tasks with mode='plan').

    Returns tasks from the tasks table where mode='plan'.
    """
    return await get_plan_service().list_plans()


@router.get("/plan/{task_id}")
async def get_plan(task_id: int):
    """Get plan task detail.

    Returns task info with parsed plan steps from Markdown.
    """
    task = await fetch_one("SELECT * FROM tasks WHERE id=?", (task_id,))
    if not task:
        raise HTTPException(404, "Task not found")

    if task.get("mode") != "plan":
        raise HTTPException(400, "Task is not a plan task")

    # Parse plan steps from Markdown
    plan_service = get_plan_service()
    plan_steps = await plan_service.get_plan_steps_from_task(task_id)

    return {
        **dict(task),
        "plan_steps": plan_steps,
    }


@router.get("/plan/{task_id}/markdown")
async def get_plan_markdown(task_id: int):
    """Get the raw Markdown content of a plan.

    This reads the plan file from the worktree directory
    or falls back to task result_text.
    """
    task = await fetch_one("SELECT * FROM tasks WHERE id=?", (task_id,))
    if not task:
        raise HTTPException(404, "Task not found")

    if task.get("mode") != "plan":
        raise HTTPException(400, "Task is not a plan task")

    markdown = ""

    # Try to read from worktree using the stored result_text
    # The result_text contains the plan markdown from runner_service
    if task.get("result_text"):
        markdown = task.get("result_text", "")

    return {"markdown": markdown}
