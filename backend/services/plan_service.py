"""Plan service - simplified for read-only plan mode.

This service handles:
- Parsing plan steps from Markdown documents (for display only)
- No more plan_groups or subtasks

The plan mode workflow is now:
1. Create task with mode='plan'
2. Claude Code runs with --permission-mode plan
3. Markdown document is stored in task_logs
4. User views the Markdown in the frontend
5. No approval or execution steps
"""

from typing import Optional, List, Dict, Any
import re
import logging

import aiosqlite

from db import fetch_one, fetch_all

logger = logging.getLogger(__name__)


class PlanService:
    """Service for plan mode operations - simplified version."""

    def __init__(self, db: aiosqlite.Connection):
        self.db = db

    def _parse_plan_steps_from_markdown(self, markdown: str) -> List[Dict[str, str]]:
        """Extract potential execution steps from Markdown plan.

        Looks for:
        - Headings that contain action words
        - Numbered lists
        - Checkbox items

        This is for DISPLAY ONLY - no execution logic.
        """
        steps = []

        # Try to find numbered steps or headings
        patterns = [
            r'^#+\s*(\d+[\.:]?\s*.+)$',  # Headings with numbers
            r'^\d+[\.:]\s*(.+)$',  # Numbered list items
            r'^-\s*\[?\]?\s*(.+)$',  # Checkbox items
            r'^•\s*(.+)$',  # Bullet points
        ]

        for line in markdown.split('\n'):
            line = line.strip()
            if not line:
                continue

            for pattern in patterns:
                match = re.match(pattern, line, re.MULTILINE | re.IGNORECASE)
                if match:
                    step_text = match.group(1).strip()
                    # Filter out non-action items
                    if len(step_text) > 10 and not step_text.lower().startswith(('table of', 'contents', 'abstract')):
                        steps.append({
                            "title": step_text[:100],
                            "description": step_text[:200],
                            "prompt": step_text,
                        })
                    break

        # If no steps found, use the entire markdown as a single step
        if not steps:
            steps.append({
                "title": "Plan Overview",
                "description": markdown[:200],
                "prompt": markdown,
            })

        return steps[:10]  # Limit to 10 steps

    async def get_plan_steps_from_task(self, task_id: int) -> List[Dict[str, str]]:
        """Get plan steps parsed from a task's result_text.

        Since task logs are no longer stored, this reads the plan file
        directly from the .claude/plans/ directory based on task_id.
        """
        # Try to get markdown from task result_text first
        task = await fetch_one("SELECT result_text FROM tasks WHERE id=?", (task_id,))
        if task and task.get("result_text"):
            return self._parse_plan_steps_from_markdown(task["result_text"])

        return []

    async def list_plans(self) -> List[Dict[str, Any]]:
        """List all plan tasks (tasks with mode='plan')."""
        return await fetch_all(
            """SELECT id, prompt as goal, status, mode, created_at, finished_at, cost_usd
               FROM tasks
               WHERE mode='plan'
               ORDER BY id DESC"""
        )
