"""Inbox API routes."""

from typing import Optional, List
import json
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import fetch_all, fetch_one, execute, get_connection

logger = logging.getLogger(__name__)

router = APIRouter(tags=["inbox"])


class InboxCreate(BaseModel):
    prompt: str
    project_id: Optional[int] = None
    mode: str = "execute"
    depends_on_task_ids: Optional[List[int]] = None
    fork_from_task_id: Optional[int] = None
    is_isolated: Optional[bool] = None
    auto_approve: Optional[bool] = None


class InboxConvert(BaseModel):
    prompt: Optional[str] = None
    mode: str = "execute"
    is_isolated: bool = False
    auto_approve: bool = False
    project_id: Optional[int] = None
    depends_on_task_ids: Optional[List[int]] = None
    fork_from_task_id: Optional[int] = None


@router.post("/inbox")
async def create_inbox(body: InboxCreate):
    """暂存到 Inbox."""
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    task_id = await execute("""
        INSERT INTO inbox (prompt, project_id, mode, depends_on_task_ids, fork_from_task_id, is_isolated, auto_approve, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    """, (body.prompt, body.project_id, body.mode,
          json.dumps(body.depends_on_task_ids) if body.depends_on_task_ids else None,
          body.fork_from_task_id,
          body.is_isolated,
          body.auto_approve,
          created_at))

    return {"id": task_id}


@router.get("/inbox")
async def list_inbox(project_id: Optional[int] = None):
    """获取 Inbox 列表，支持按项目筛选."""
    if project_id:
        tasks = await fetch_all("""
            SELECT i.*, p.name as project_name
            FROM inbox i
            LEFT JOIN projects p ON i.project_id = p.id
            WHERE i.status = 'pending' AND i.project_id = ?
            ORDER BY i.created_at DESC
        """, (project_id,))
    else:
        tasks = await fetch_all("""
            SELECT i.*, p.name as project_name
            FROM inbox i
            LEFT JOIN projects p ON i.project_id = p.id
            WHERE i.status = 'pending'
            ORDER BY i.created_at DESC
        """)

    # 解析 JSON 字段和布尔值
    result = []
    for t in tasks:
        item = dict(t)
        # 解析 depends_on_task_ids (JSON 字符串 -> 列表)
        if item.get("depends_on_task_ids"):
            try:
                item["depends_on_task_ids"] = json.loads(item["depends_on_task_ids"])
            except (json.JSONDecodeError, TypeError):
                item["depends_on_task_ids"] = None
        # 解析 is_isolated (INTEGER -> boolean)
        item["is_isolated"] = bool(item.get("is_isolated", 0))
        # 解析 auto_approve (INTEGER -> boolean)
        item["auto_approve"] = bool(item.get("auto_approve", 0))
        # 解析 mode (TEXT -> string with default)
        item["mode"] = item.get("mode", "execute")
        result.append(item)

    return result


@router.get("/inbox/{inbox_id}")
async def get_inbox(inbox_id: int):
    """获取单个 Inbox 记录."""
    inbox = await fetch_one("""
        SELECT i.*, p.name as project_name
        FROM inbox i
        LEFT JOIN projects p ON i.project_id = p.id
        WHERE i.id = ?
    """, (inbox_id,))

    if not inbox:
        raise HTTPException(404, "Inbox record not found")

    result = dict(inbox)
    # 解析 depends_on_task_ids (JSON 字符串 -> 列表)
    if result.get("depends_on_task_ids"):
        try:
            result["depends_on_task_ids"] = json.loads(result["depends_on_task_ids"])
        except (json.JSONDecodeError, TypeError):
            result["depends_on_task_ids"] = None
    # 解析 is_isolated (INTEGER -> boolean)
    result["is_isolated"] = bool(result.get("is_isolated", 0))
    # 解析 auto_approve (INTEGER -> boolean)
    result["auto_approve"] = bool(result.get("auto_approve", 0))
    # 解析 mode (TEXT -> string with default)
    result["mode"] = result.get("mode", "execute")

    return result


@router.post("/inbox/{inbox_id}/convert")
async def convert_inbox_to_task(inbox_id: int, body: InboxConvert):
    """将 Inbox 记录转换为正式任务."""
    from services.task_service import TaskService

    inbox = await fetch_one("SELECT * FROM inbox WHERE id=?", (inbox_id,))
    if not inbox:
        raise HTTPException(404, "Inbox record not found")

    if inbox["status"] == "converted":
        raise HTTPException(400, "Inbox record already converted")

    # 使用用户编辑后的 prompt 或原 prompt
    prompt = body.prompt or inbox["prompt"]

    # 使用用户传递的 project_id 或 inbox 原有的 project_id
    project_id = body.project_id if body.project_id is not None else inbox["project_id"]

    # 使用用户传递的 mode 或 inbox 原有的 mode（优先使用 inbox 保存的值）
    mode = body.mode if body.mode is not None else inbox.get("mode", "execute")

    # 创建正式任务
    task_service = TaskService(get_connection())
    task_id = await task_service.create_task(
        prompt=prompt,
        mode=mode,
        project_id=project_id,
        is_isolated=body.is_isolated if body.is_isolated is not None else bool(inbox.get("is_isolated", False)),
        auto_approve=body.auto_approve if body.auto_approve is not None else bool(inbox.get("auto_approve", False)),
        depends_on_task_ids=body.depends_on_task_ids if body.depends_on_task_ids is not None else (inbox.get("depends_on_task_ids") if isinstance(inbox.get("depends_on_task_ids"), list) else None),
        fork_from_task_id=body.fork_from_task_id if body.fork_from_task_id is not None else inbox.get("fork_from_task_id"),
    )

    # 更新 Inbox 记录状态
    await execute("""
        UPDATE inbox SET
            status='converted',
            related_task_id=?,
            converted_at=?
        WHERE id=?
    """, (task_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), inbox_id))

    # 通知调度器
    import app
    if app.scheduler:
        app.scheduler.notify()

    return {"task_id": task_id}


@router.delete("/inbox/{inbox_id}")
async def delete_inbox(inbox_id: int):
    """删除/归档 Inbox 记录."""
    await execute("DELETE FROM inbox WHERE id=?", (inbox_id,))
    return {"deleted": True, "id": inbox_id}


@router.get("/inbox/count/unread")
async def get_inbox_count():
    """获取未读 Inbox 数量（用于徽章显示）."""
    result = await fetch_one("SELECT COUNT(*) as count FROM inbox WHERE status='pending'")
    return {"count": result["count"] if result else 0}
