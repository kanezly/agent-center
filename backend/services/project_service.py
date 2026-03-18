"""Project service - Git repository project management."""

from typing import Optional, List, Dict, Any, Tuple
from pathlib import Path

import asyncio
import logging
import os
import subprocess

import aiosqlite

from db import execute, fetch_all, fetch_one

logger = logging.getLogger(__name__)


class ProjectService:
    """Service for managing git repository projects."""

    def __init__(self, db: aiosqlite.Connection):
        self.db = db

    def _run_git_sync(self, args: List[str], cwd: Optional[str] = None) -> Tuple[int, str, str]:
        """Synchronous git call."""
        try:
            r = subprocess.run(
                ["git"] + args,
                capture_output=True, text=True, cwd=cwd, timeout=30,
            )
            return r.returncode, r.stdout.strip(), r.stderr.strip()
        except FileNotFoundError:
            return 1, "", "git not found"
        except subprocess.TimeoutExpired:
            return 1, "", "git timeout"

    async def _run_git(self, args: List[str], cwd: Optional[str] = None) -> Tuple[int, str, str]:
        """Async wrapper for git commands."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._run_git_sync, args, cwd)

    def _is_git_repo_sync(self, path: str) -> bool:
        """Check if path is a git repository (sync)."""
        code, _, _ = self._run_git_sync(["rev-parse", "--git-dir"], cwd=path)
        return code == 0

    async def is_git_repo(self, path: str) -> bool:
        """Check if path is a git repository."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._is_git_repo_sync, path)

    def _init_git_sync(self, path: str) -> Tuple[bool, str]:
        """Initialize git repository (sync). Returns (success, message)."""
        # Create directory if not exists
        os.makedirs(path, exist_ok=True)

        code, out, err = self._run_git_sync(["init"], cwd=path)
        if code != 0:
            return False, f"Failed to init git: {err}"

        # Set default branch to main
        self._run_git_sync(["checkout", "-b", "main"], cwd=path)

        return True, "Git initialized successfully"

    async def init_git(self, path: str) -> Tuple[bool, str]:
        """Initialize git repository."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._init_git_sync, path)

    def _detect_main_branch_sync(self, path: str) -> str:
        """Detect main branch name (sync)."""
        # Try to get remote HEAD
        code, out, _ = self._run_git_sync(
            ["symbolic-ref", "refs/remotes/origin/HEAD"], cwd=path
        )
        if code == 0 and out:
            # refs/remotes/origin/main -> main
            return out.split("/")[-1]

        # Check local branches
        code, out, _ = self._run_git_sync(["branch"], cwd=path)
        if code == 0:
            branches = [b.strip().lstrip("* ") for b in out.split("\n") if b.strip()]
            if "main" in branches:
                return "main"
            if "master" in branches:
                return "master"

        # Default to main
        return "main"

    async def detect_main_branch(self, path: str) -> str:
        """Detect main branch name."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._detect_main_branch_sync, path)

    async def create_project(
        self,
        name: str,
        path: str,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
        main_branch: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Create a new project.

        Args:
            name: Project name (unique, used for directory naming)
            path: Local absolute path
            display_name: Display name (optional)
            description: Project description (optional)
            main_branch: Main branch name (auto-detected if not provided)

        Returns:
            Project dict if successful, None otherwise
        """
        # Normalize path
        path = os.path.normpath(os.path.abspath(path))

        # Check if path exists
        if not os.path.exists(path):
            logger.warning(f"Path does not exist: {path}, attempting to create")
            os.makedirs(path, exist_ok=True)

        # Check if git repo, init if not
        is_git = await self.is_git_repo(path)
        if not is_git:
            logger.info(f"Initializing git repository at {path}")
            success, msg = await self.init_git(path)
            if not success:
                logger.error(f"Failed to init git repo: {msg}")
                return None

        # Auto-detect main branch if not provided
        if not main_branch:
            main_branch = await self.detect_main_branch(path)

        # Insert into database
        try:
            project_id = await execute(
                """INSERT INTO projects (name, display_name, description, path, main_branch)
                   VALUES (?, ?, ?, ?, ?)""",
                (name, display_name, description, path, main_branch),
            )

            return await self.get_project(project_id)
        except Exception as e:
            logger.error(f"Failed to create project: {e}")
            return None

    async def get_project(self, project_id: int) -> Optional[Dict[str, Any]]:
        """Get project by ID."""
        return await fetch_one("SELECT * FROM projects WHERE id = ?", (project_id,))

    async def get_project_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Get project by name."""
        return await fetch_one("SELECT * FROM projects WHERE name = ?", (name,))

    async def list_projects(self) -> List[Dict[str, Any]]:
        """List all projects."""
        return await fetch_all("SELECT * FROM projects ORDER BY created_at DESC")

    async def update_project(
        self,
        project_id: int,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
        main_branch: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Update project metadata."""
        updates = []
        params = []

        if display_name is not None:
            updates.append("display_name = ?")
            params.append(display_name)
        if description is not None:
            updates.append("description = ?")
            params.append(description)
        if main_branch is not None:
            updates.append("main_branch = ?")
            params.append(main_branch)

        if not updates:
            return await self.get_project(project_id)

        params.append(project_id)
        await execute(
            f"UPDATE projects SET {', '.join(updates)} WHERE id = ?",
            params,
        )

        return await self.get_project(project_id)

    async def delete_project(self, project_id: int) -> bool:
        """Delete a project and all associated resources."""
        logger.info(f"Deleting project {project_id}")

        # 获取项目信息（用于清理 worktree）
        project = await fetch_one("SELECT name, path FROM projects WHERE id = ?", (project_id,))

        if not project:
            logger.warning(f"Project {project_id} not found")
            return False

        try:
            from db import get_connection

            db = get_connection()

            # 1. 删除关联的 inbox 记录
            await db.execute("DELETE FROM inbox WHERE project_id = ?", (project_id,))

            # 2. 删除关联的任务相关数据
            await db.execute("DELETE FROM plan_questions WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)", (project_id,))
            await db.execute("DELETE FROM task_logs WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)", (project_id,))
            await db.execute("DELETE FROM task_dependencies WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)", (project_id,))
            await db.execute("DELETE FROM task_dependencies WHERE depends_on_task_id IN (SELECT id FROM tasks WHERE project_id = ?)", (project_id,))
            await db.execute("DELETE FROM task_conversations WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)", (project_id,))

            # 3. 删除 tasks
            await db.execute("DELETE FROM tasks WHERE project_id = ?", (project_id,))

            # 4. 删除关联的 worktrees
            await db.execute("DELETE FROM worktrees WHERE name LIKE ?", (f"project-{project_id}-%",))

            # 5. 删除项目本身
            await db.execute("DELETE FROM projects WHERE id = ?", (project_id,))

            # 提交事务
            await db.commit()

            logger.info(f"Project {project_id} deleted successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to delete project {project_id}: {e}")
            try:
                await db.rollback()
            except Exception as rollback_error:
                logger.error(f"Rollback failed: {rollback_error}")
            raise

    async def refresh_branch(self, project_id: int) -> Optional[Dict[str, Any]]:
        """Refresh main branch detection for a project."""
        project = await self.get_project(project_id)
        if not project:
            return None

        main_branch = await self.detect_main_branch(project["path"])
        await execute(
            "UPDATE projects SET main_branch = ? WHERE id = ?",
            (main_branch, project_id),
        )

        return await self.get_project(project_id)


# Module-level functions for backward compatibility
def get_service() -> ProjectService:
    """Get ProjectService instance."""
    from db import get_connection
    return ProjectService(get_connection())


async def create_project(
    name: str,
    path: str,
    display_name: Optional[str] = None,
    description: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Create a new project."""
    return await get_service().create_project(name, path, display_name, description)


async def get_project(project_id: int) -> Optional[Dict[str, Any]]:
    """Get project by ID."""
    return await get_service().get_project(project_id)


async def list_projects() -> List[Dict[str, Any]]:
    """List all projects."""
    return await get_service().list_projects()


async def update_project(
    project_id: int,
    display_name: Optional[str] = None,
    description: Optional[str] = None,
    main_branch: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Update project metadata."""
    return await get_service().update_project(project_id, display_name, description, main_branch)


async def delete_project(project_id: int) -> bool:
    """Delete a project."""
    return await get_service().delete_project(project_id)
