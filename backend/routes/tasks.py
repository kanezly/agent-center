"""Task API routes."""

from typing import Optional, List
import json
import logging
import os
import shutil
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import fetch_all, fetch_one, execute, get_connection

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tasks"])


class TaskCreate(BaseModel):
    prompt: str
    priority: int = 0
    mode: str = "execute"
    cwd: Optional[str] = None
    project_id: Optional[int] = None  # 新增：所属项目 ID
    depends_on_task_ids: Optional[List[int]] = None
    fork_from_task_id: Optional[int] = None
    is_isolated: Optional[bool] = None  # 新增：是否进行任务隔离
    auto_approve: Optional[bool] = None  # 新增：自动批准


class AnswerQuestions(BaseModel):
    answers: dict[int, list[str]]


class ApprovePlan(BaseModel):
    pass


class ContinueTask(BaseModel):
    prompt: str


@router.post("/tasks")
async def create_task(body: TaskCreate):
    """Create a new task."""
    import app

    prompt = body.prompt

    from services.task_service import TaskService
    task_service = TaskService(get_connection())

    try:
        task_id = await task_service.create_task(
            prompt=prompt,
            priority=body.priority,
            mode=body.mode,
            cwd=body.cwd,
            depends_on_task_ids=body.depends_on_task_ids,
            fork_from_task_id=body.fork_from_task_id,
            project_id=body.project_id,
            is_isolated=body.is_isolated,  # 传递 is_isolated 参数
            auto_approve=body.auto_approve,  # 传递 auto_approve 参数
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    if app.scheduler:
        app.scheduler.notify()

    task = await fetch_one("SELECT id, status, mode, prompt, created_at FROM tasks WHERE id=?", (task_id,))
    if task:
        await app.manager.broadcast_global("task_created", dict(task))

    return {"id": task_id, "status": "queued", "type": "plan" if body.mode == 'plan' else "task"}


@router.get("/tasks")
async def list_tasks(status: Optional[str] = None, filter_group: Optional[str] = None, project_id: Optional[int] = None):
    """List all tasks with optional status filter.

    使用 LEFT JOIN 替代子查询获取 initial_prompt，提升查询性能。
    """
    # 使用 LEFT JOIN 获取第一条对话的 user_prompt（初始指令）
    # 通过子查询预先聚合每个 task_id 的最小 round_number，避免多次子查询
    base_sql = """
        SELECT
            t.id,
            tc_first.user_prompt as initial_prompt,
            t.prompt, t.status, t.mode, t.priority,
            t.worktree_id, t.created_at,
            t.started_at, t.finished_at, t.cost_usd,
            t.session_id,
            t.project_id, p.name as project_name, p.path as project_path,
            t.is_isolated,
            t.status as unified_status
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN (
            SELECT tc1.task_id, tc1.user_prompt
            FROM task_conversations tc1
            INNER JOIN (
                SELECT task_id, MIN(round_number) as min_round
                FROM task_conversations
                GROUP BY task_id
            ) tc2 ON tc1.task_id = tc2.task_id AND tc1.round_number = tc2.min_round
        ) tc_first ON t.id = tc_first.task_id
    """

    # 构建 WHERE 条件
    conditions = []
    params = []

    if project_id is not None:
        if project_id == -1:
            # -1 表示无项目任务
            conditions.append("t.project_id IS NULL")
        else:
            conditions.append("t.project_id=?")
            params.append(project_id)

    if filter_group == 'todo-agent':
        # Include pending (挂起) tasks that are waiting for dependency completion
        conditions.append("t.status IN ('queued', 'running', 'pending')")
    elif filter_group == 'todo-human':
        # All tasks in 'reviewing' status (both plan and execute mode)
        conditions.append("t.status='reviewing'")
    elif filter_group == 'done':
        conditions.append("t.status IN ('completed', 'failed', 'cancelled')")
    elif status:
        conditions.append("t.status=?")
        params.append(status)

    # 拼接 WHERE 子句
    if conditions:
        sql = base_sql + " WHERE " + " AND ".join(conditions)
    else:
        sql = base_sql

    tasks = await fetch_all(sql, tuple(params) if params else None)

    for t in tasks:
        # 使用 initial_prompt（第一条指令）作为 prompt_short 的来源
        # 如果没有对话历史，回退到 tasks.prompt
        initial = t.get("initial_prompt") or t["prompt"]
        t["prompt_short"] = initial[:100] if initial else ""
        # Convert is_isolated from INTEGER to boolean
        t["is_isolated"] = bool(t.get("is_isolated", 0))

    return tasks


@router.get("/tasks/{task_id}")
async def get_task(task_id: int):
    """Get a single task with its conversation history, logs, and plan questions.

    使用 LEFT JOIN 替代子查询获取 initial_prompt，提升查询性能。
    """
    task = await fetch_one("""
        SELECT t.*,
            tc_first.user_prompt as initial_prompt,
            p.name as project_name, p.path as project_path
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN (
            SELECT tc1.task_id, tc1.user_prompt
            FROM task_conversations tc1
            INNER JOIN (
                SELECT task_id, MIN(round_number) as min_round
                FROM task_conversations
                GROUP BY task_id
            ) tc2 ON tc1.task_id = tc2.task_id AND tc1.round_number = tc2.min_round
        ) tc_first ON t.id = tc_first.task_id
        WHERE t.id=?
    """, (task_id,))
    if not task:
        raise HTTPException(404, "Task not found")

    # 获取对话历史
    conversations = await fetch_all("""
        SELECT * FROM task_conversations
        WHERE task_id=?
        ORDER BY round_number ASC
    """, (task_id,))

    # 获取决策问题（Plan mode）
    questions = await fetch_all(
        "SELECT * FROM plan_questions WHERE task_id=? ORDER BY id",
        (task_id,),
    )

    for q in questions:
        q["options"] = json.loads(q["options"]) if q["options"] else []
        if q["user_answer"]:
            q["user_answer"] = json.loads(q["user_answer"])

    # 获取原始日志（用于调试，可选）
    # 只返回 result、assistant、error 类型的日志，按时间正序返回
    logs = await fetch_all(
        "SELECT * FROM task_logs WHERE task_id=? AND event_type IN ('result', 'assistant', 'error') ORDER BY id ASC",
        (task_id,),
    )

    return {
        **dict(task),
        "conversations": [dict(c) for c in conversations],
        "logs": [dict(log) for log in logs],
        "questions": questions,
    }


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: int):
    """Cancel a task if it's queued or running."""
    import app
    from services.task_service import TaskService

    task = await fetch_one("SELECT * FROM tasks WHERE id=?", (task_id,))
    if not task:
        raise HTTPException(404, "Task not found")

    if task["status"] not in ("queued", "running"):
        raise HTTPException(400, f"Task cannot be cancelled in current state: status={task['status']}")

    task_service = TaskService(get_connection())
    result = await task_service.cancel_task(task_id)

    if result == "cancelled":
        # Broadcast cancellation event
        await app.manager.broadcast_global("task_cancelled", {"id": task_id, "status": "cancelled"})
        return {"status": "cancelled", "id": task_id}
    else:
        raise HTTPException(500, f"Failed to cancel task: result={result}")


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: int):
    """Delete a task and all related records."""
    import app

    task = await fetch_one("SELECT * FROM tasks WHERE id=?", (task_id,))
    if not task:
        raise HTTPException(404, "Task not found")

    # 如果任务正在运行，先终止 Claude CLI 子进程
    if task["status"] == "running":
        logger.info(f"Task {task_id}: Terminating Claude CLI subprocess before deletion")
        from utils.process_registry import ProcessRegistry
        registry = ProcessRegistry()
        await registry.terminate(task_id)

    # 如果是隔离任务且有工作树，先清理 worktree
    if task.get("is_isolated") and task.get("project_id") and task.get("cwd"):
        logger.info(f"Task {task_id}: Cleaning up isolated worktree before deletion")
        from services.worktree_service import WorktreeService
        worktree_service = WorktreeService(get_connection())
        branch_name = f"task-{task_id}"
        await worktree_service.cleanup_worktree(
            project_id=task["project_id"],
            task_id=task_id,
            branch_name=branch_name,
            worktree_path=task["cwd"],
        )

    # 独立隔离任务清理：删除 standalone 目录
    if task.get("is_isolated") and not task.get("project_id") and task.get("cwd") and "standalone-" in task.get("cwd", ""):
        logger.info(f"Task {task_id}: Cleaning up standalone directory before deletion")
        if os.path.exists(task["cwd"]):
            shutil.rmtree(task["cwd"])

    # 获取依赖当前任务的后置任务（在删除依赖关系之前）
    dependent_task_ids = await fetch_all(
        "SELECT task_id FROM task_dependencies WHERE depends_on_task_id=?",
        (task_id,)
    )

    # Delete related records in reverse dependency order
    await execute("DELETE FROM plan_questions WHERE task_id=?", (task_id,))
    await execute("DELETE FROM task_logs WHERE task_id=?", (task_id,))
    await execute("DELETE FROM task_conversations WHERE task_id=?", (task_id,))
    await execute("DELETE FROM task_dependencies WHERE task_id=?", (task_id,))
    await execute("DELETE FROM task_dependencies WHERE depends_on_task_id=?", (task_id,))

    # 更新后置任务状态：检查依赖当前任务的后置任务是否可以开始
    terminal_statuses = {'completed', 'failed', 'cancelled'}
    for dep_task in dependent_task_ids:
        dep_task_id = dep_task["task_id"]
        # 检查是否还有其他未满足的依赖
        remaining_deps = await fetch_all(
            """SELECT t.status FROM task_dependencies td
               JOIN tasks t ON t.id = td.depends_on_task_id
               WHERE td.task_id = ?""",
            (dep_task_id,)
        )
        # 如果没有剩余依赖，或者所有剩余依赖都是终端状态
        if not remaining_deps or all(r["status"] in terminal_statuses for r in remaining_deps):
            task_row = await fetch_one("SELECT status FROM tasks WHERE id=?", (dep_task_id,))
            if task_row and task_row["status"] == "pending":
                await execute("UPDATE tasks SET status='queued' WHERE id=?", (dep_task_id,))
                logger.info(f"Dependency satisfied (task {task_id} deleted): task {dep_task_id} → queued")
                if app.scheduler:
                    app.scheduler.notify()

    # Clear self-references in tasks table
    await execute("UPDATE tasks SET parent_task_id=NULL WHERE parent_task_id=?", (task_id,))
    await execute("UPDATE tasks SET fork_from_task_id=NULL WHERE fork_from_task_id=?", (task_id,))
    # Clear references in inbox table
    await execute("UPDATE inbox SET related_task_id=NULL WHERE related_task_id=?", (task_id,))
    await execute("UPDATE inbox SET fork_from_task_id=NULL WHERE fork_from_task_id=?", (task_id,))
    # Finally delete the task
    await execute("DELETE FROM tasks WHERE id=?", (task_id,))

    await app.manager.broadcast_global("task_deleted", {"id": task_id, "deleted": True})
    return {"deleted": True, "id": task_id}


@router.post("/tasks/voice")
async def voice_task(body: TaskCreate):
    return await create_task(body)


@router.post("/tasks/{task_id}/answer")
async def answer_questions(task_id: int, body: AnswerQuestions):
    """用户提交决策问题的答案，使用 --resume 继续原任务"""
    import app

    task = await fetch_one("SELECT * FROM tasks WHERE id=?", (task_id,))
    if not task:
        raise HTTPException(404, "Task not found")

    # 获取完整的问题和答案（在删除之前）
    questions_with_answers = await fetch_all(
        "SELECT id, question, header, options, user_answer FROM plan_questions WHERE id IN ({})".format(
            ",".join(str(k) for k in body.answers.keys())
        ),
    )

    # 验证：至少有一个问题被回答
    if not questions_with_answers:
        raise HTTPException(400, "No valid questions found for the provided answers")

    # 更新答案状态
    for qid, answer in body.answers.items():
        await execute(
            "UPDATE plan_questions SET user_answer=?, status='answered' WHERE id=?",
            (json.dumps(answer), qid)
        )

    # 构建格式化的文本（用于直接显示）
    qa_lines = ["=== 问题确认 ===\n"]
    for q in questions_with_answers:
        options = json.loads(q["options"]) if q["options"] else []
        qa_lines.append(f"❓ {q['header']}: {q['question']}")
        qa_lines.append(f"✅ 您的选择：{', '.join(json.loads(answer))}")
        qa_lines.append("---")
    formatted_qa_text = "\n".join(qa_lines)

    # 构建发给 Claude 的 prompt
    # 注意：/answer 端点仅用于回答选择题的场景
    # 用户直接输入调整指令应该调用 /continue 端点
    answer_lines = ["我的选择是：\n"]
    for q in questions_with_answers:
        answer_lines.append(f"- {q['header']}: {', '.join(json.loads(body.answers[q['id']]))}")
    answer_lines.append("\n请基于我的选择继续完善计划。")
    answer_prompt = "\n".join(answer_lines)

    new_round = (task.get("round_number") or 1) + 1

    # 保存用户的选择到 task_conversations
    # result_text 留空，由 run_claude_task 在执行完成后更新
    await execute("""
            INSERT INTO task_conversations
            (task_id, round_number, user_prompt, session_id, created_at,
             started_at, finished_at, cost_usd, result_text)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            task_id,
            new_round,
            formatted_qa_text,  # 格式化的文本（用于直接显示）
            task.get("session_id"),
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),  # created_at 使用本地时间
            task.get("started_at"),
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            task.get("cost_usd", 0),
            "",  # result_text 为空，由 run_claude_task 执行完成后填充
        ))

    # 更新任务状态
    await execute(
        """UPDATE tasks SET
           prompt=?, status='queued', plan_status='generating',
           round_number=?, session_id=?
           WHERE id=?""",
        (answer_prompt, new_round, task.get("session_id"), task_id)
    )

    # 删除 plan_questions
    await execute("DELETE FROM plan_questions WHERE task_id=?", (task_id,))

    if app.scheduler:
        app.scheduler.notify()

    return {
        "task_id": task_id,
        "round": new_round,
        "status": "queued",
        "submitted_answers": [
            {
                "id": q["id"],
                "header": q["header"],
                "question": q["question"],
                "answer": json.loads(body.answers[q["id"]])
            }
            for q in questions_with_answers
        ]
    }


@router.post("/tasks/{task_id}/approve")
async def approve(task_id: int, body: Optional[ApprovePlan] = None):
    """统一批准端点"""
    import app

    task = await fetch_one("SELECT * FROM tasks WHERE id=?", (task_id,))
    if not task:
        raise HTTPException(404, "Task not found")

    # Plan 模式任务批准：转为 execute 模式，复用 worktree（如果有），使用 --resume 继续执行
    if task.get("mode") == "plan" and task.get("plan_status") in ("reviewing", "approved"):
        # 非隔离任务不需要 cwd 检查
        if not task.get("session_id"):
            raise HTTPException(500, "Plan task has no session_id to resume")

        # 增加 round_number，确保执行结果保存到新的一轮对话
        current_round = task.get("round_number", 1) or 1
        new_round = current_round + 1

        exec_prompt = "计划已批准，请开始执行。"

        await execute(
            """UPDATE tasks SET
               mode='execute', status='queued', plan_status='executing',
               prompt=?, round_number=?, session_id=?, cwd=?
               WHERE id=?""",
            (exec_prompt, new_round, task.get("session_id"), task.get("cwd"), task_id)
        )

        if app.scheduler:
            app.scheduler.notify()

        return {"status": "approved", "task_id": task_id, "type": "plan"}

    if task.get("status") == "reviewing":
        from services.task_service import TaskService
        task_service = TaskService(get_connection())

        success = await task_service.approve_task(task_id)
        if not success:
            raise HTTPException(500, "Task approval already in progress or invalid state")

        # 立即返回，后处理在后台执行
        return {"status": "approval_accepted", "task_id": task_id, "type": "execute"}

    # 如果状态是 post_processing，说明已有请求在处理中
    if task.get("status") == "post_processing":
        raise HTTPException(400, "Task is already being processed (code merging in progress)")

    raise HTTPException(400, f"Task cannot be approved in current state: status={task.get('status')}")


@router.post("/tasks/{task_id}/continue")
async def continue_task_endpoint(task_id: int, body: ContinueTask):
    """用户输入新命令继续执行"""
    import app

    prompt = body.prompt

    if not prompt:
        raise HTTPException(400, "Prompt is required")

    task = await fetch_one("SELECT * FROM tasks WHERE id=?", (task_id,))
    if not task:
        raise HTTPException(404, "Task not found")
    if task["status"] != "reviewing":
        raise HTTPException(400, "Task is not in reviewing status")

    from services.task_service import TaskService
    task_service = TaskService(get_connection())

    def notify_scheduler():
        if app.scheduler:
            app.scheduler.notify()

    await task_service.continue_task(task_id, prompt, notify_scheduler)

    return {"status": "continued", "task_id": task_id}


@router.get("/tasks/{task_id}/dependencies")
async def get_task_dependencies(task_id: int):
    """获取任务的依赖关系"""
    task = await fetch_one("SELECT * FROM tasks WHERE id=?", (task_id,))
    if not task:
        raise HTTPException(404, "Task not found")

    from services.dependency_service import DependencyService
    dep_service = DependencyService(get_connection())

    dependencies = await dep_service.get_dependencies(task_id)
    dependents = await dep_service.get_dependent_tasks(task_id)

    return {
        "task_id": task_id,
        "depends_on": dependencies,
        "dependent_tasks": dependents,
    }


@router.post("/tasks/{task_id}/retry")
async def retry_task(task_id: int):
    """重试失败的任务 - 将状态重置为 queued 重新执行"""
    import app

    task = await fetch_one("SELECT * FROM tasks WHERE id=?", (task_id,))
    if not task:
        raise HTTPException(404, "Task not found")

    if task["status"] != "failed":
        raise HTTPException(400, f"Task cannot be retried in current state: status={task['status']}")

    # 重置任务状态为 queued，保留 session_id 以便 resume 之前的对话
    await execute(
        """UPDATE tasks SET
           status='queued', started_at=NULL, finished_at=NULL, session_id=?
           WHERE id=?""",
        (task.get("session_id"), task_id)
    )

    # 通知调度器
    if app.scheduler:
        app.scheduler.notify()

    return {"status": "retried", "task_id": task_id}


@router.post("/tasks/{task_id}/cleanup")
async def cleanup_task_worktree(task_id: int):
    """手动清理任务的工作树（用于失败任务或用户主动触发）"""
    from services.worktree_service import WorktreeService

    task = await fetch_one("SELECT * FROM tasks WHERE id=?", (task_id,))
    if not task:
        raise HTTPException(404, "Task not found")

    if not task.get("project_id") or not task.get("cwd"):
        return {"status": "skipped", "reason": "no worktree"}

    worktree_service = WorktreeService(get_connection())
    branch_name = f"task-{task_id}"

    try:
        success = await worktree_service.cleanup_worktree(
            project_id=task["project_id"],
            task_id=task_id,
            branch_name=branch_name,
            worktree_path=task["cwd"]
        )

        if success:
            await execute("UPDATE tasks SET cwd=NULL WHERE id=?", (task_id,))
            return {"status": "cleaned"}
        else:
            raise HTTPException(500, "Cleanup failed")
    except Exception as e:
        logger.error(f"Task {task_id}: cleanup failed - {e}")
        raise HTTPException(500, f"Cleanup failed: {str(e)}")
