"""Worktree service - Git worktree dynamic creation and cleanup.

This service provides:
- Dynamic worktree creation per task (not pool-based)
- Worktree cleanup after task completion
- Merge worktree changes back to main branch
- Code review before commit
"""

from typing import Optional, List, Dict, Any, Tuple
from pathlib import Path

import asyncio
import logging
import os
import shutil
import subprocess

import aiosqlite

from db import execute, fetch_all, fetch_one
from utils.platform import normalize_path, paths_are_equal

logger = logging.getLogger(__name__)


class WorktreeService:
    """Service for Git worktree operations."""

    def __init__(self, db: aiosqlite.Connection):
        self.db = db

    def _run_git_sync(self, args: List[str], cwd: Optional[str] = None) -> Tuple[int, str, str]:
        """Synchronous git call."""
        try:
            r = subprocess.run(
                ["git"] + args,
                capture_output=True, text=True, encoding='utf-8', cwd=cwd, timeout=60,
            )
            return r.returncode, r.stdout.strip() if r.stdout else "", r.stderr.strip() if r.stderr else ""
        except FileNotFoundError:
            return 1, "", "git not found"
        except subprocess.TimeoutExpired:
            return 1, "", "git timeout"
        except UnicodeDecodeError as e:
            logger.warning(f"Unicode decode error in git output: {e}")
            return 1, "", "git output encoding error"

    async def _run_git(self, args: List[str], cwd: Optional[str] = None) -> Tuple[int, str, str]:
        """Async wrapper for git commands."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._run_git_sync, args, cwd)

    async def get_project(self, project_id: int) -> Optional[Dict[str, Any]]:
        """Get project by ID."""
        return await fetch_one("SELECT * FROM projects WHERE id = ?", (project_id,))

    async def create_worktree(
        self,
        project_id: int,
        task_id: int,
        branch_name: Optional[str] = None,
    ) -> Optional[Dict[str, str]]:
        """Create a new worktree for a task.

        Args:
            project_id: Project ID to create worktree from
            task_id: Task ID (used in branch name)
            branch_name: Optional custom branch name (default: task-{task_id})

        Returns:
            Dict with 'path' and 'branch' keys, or None if failed
        """
        project = await self.get_project(project_id)
        if not project:
            logger.error(f"Project {project_id} not found")
            return None

        project_path = project["path"]

        # 获取项目当前分支（而不是使用固定的 main_branch）
        code, current_branch, _ = await self._run_git(
            ["rev-parse", "--abbrev-ref", "HEAD"], cwd=project_path
        )
        if code == 0 and current_branch:
            source_branch = current_branch.strip()
            logger.info(f"Task {task_id}: Using current branch '{source_branch}' for worktree creation")
        else:
            # Fallback 到存储的 main_branch
            source_branch = project.get("main_branch", "main")
            logger.warning(f"Task {task_id}: Could not determine current branch, using {source_branch}")

        # Default branch name
        if not branch_name:
            branch_name = f"task-{task_id}"

        # Worktree path: ${project_path}/worktrees/${project_name}-${task_id}
        # 所有项目的 worktree 统一放到项目内部的 worktrees 目录下
        worktree_path = os.path.join(project_path, f"worktrees", f"{project['name']}-{task_id}")

        # Ensure worktrees directory exists
        os.makedirs(os.path.dirname(worktree_path), exist_ok=True)

        # Clean up any existing worktree at this path
        if os.path.exists(worktree_path):
            logger.info(f"Removing existing worktree at {worktree_path}")
            await self._run_git(["worktree", "remove", worktree_path, "--force"], cwd=project_path)

        # Delete existing branch if it exists
        code, _, _ = await self._run_git(["rev-parse", "--verify", branch_name], cwd=project_path)
        if code == 0:
            logger.info(f"Deleting existing branch {branch_name}")
            await self._run_git(["branch", "-D", branch_name], cwd=project_path)

        # Create worktree with new branch from source_branch
        logger.info(f"Creating worktree at {worktree_path} with branch {branch_name} from {source_branch}")
        code, out, err = await self._run_git(
            ["worktree", "add", "-b", branch_name, worktree_path, source_branch],
            cwd=project_path,
        )

        if code != 0 and "already exists" not in err.lower():
            logger.warning(f"Failed to create worktree from {source_branch}: {err}")
            # Fallback: try with --no-track
            logger.info(f"Falling back to creating worktree with --no-track")
            code, out, err = await self._run_git(
                ["worktree", "add", "--no-track", "-b", branch_name, worktree_path, source_branch],
                cwd=project_path,
            )

        if code != 0 and "already exists" not in err.lower():
            logger.error(f"Failed to create worktree at {worktree_path}: {err} (project_path={project_path}, project_id={project_id})")
            return None

        # 兜底：确保 worktree 的 HEAD 指向新分支（而不是 detached 状态）
        # 在 worktree 目录内执行 git checkout 到 branch_name
        code, out, err = await self._run_git(
            ["checkout", branch_name],
            cwd=worktree_path,
        )
        if code != 0:
            logger.warning(f"Task {task_id}: Failed to checkout {branch_name} in worktree: {err}")
        else:
            logger.info(f"Task {task_id}: Successfully checked out {branch_name} in worktree")

        # Ensure path exists
        if not os.path.isdir(worktree_path):
            os.makedirs(worktree_path, exist_ok=True)

        # 等待文件系统同步（Windows 上 git worktree add 返回后可能需要短暂等待）
        retries = 5
        while retries > 0 and not os.path.isdir(worktree_path):
            logger.warning(f"Task {task_id}: Waiting for worktree path to be accessible... ({retries} retries left)")
            await asyncio.sleep(0.2)
            retries -= 1

        # 最终验证：如果路径仍不可访问，记录错误但返回（让调用方处理）
        if not os.path.isdir(worktree_path):
            logger.error(f"Task {task_id}: Worktree path still not accessible after retries: {worktree_path}")

        logger.info(f"Worktree created at {worktree_path}")
        return {"path": worktree_path, "branch": branch_name, "project_id": project_id}

    async def merge_and_cleanup(
        self,
        project_id: int,
        task_id: int,
        branch_name: str,
        worktree_path: str,
        commit_msg: str,
    ) -> Tuple[bool, str]:
        """Commit changes, merge to source branch, and cleanup worktree.

        Args:
            project_id: Project ID
            task_id: Task ID
            branch_name: Worktree branch name
            worktree_path: Worktree path
            commit_msg: Commit message

        Returns:
            Tuple of (success, message)
        """
        project = await self.get_project(project_id)
        if not project:
            return False, f"Project {project_id} not found"

        # Check if worktree_path is a git repository/worktree
        code, _, _ = await self._run_git(["rev-parse", "--git-dir"], cwd=worktree_path)
        if code != 0:
            # Non-git project - no merge needed, changes are preserved in place
            logger.info(f"Task {task_id}: Non-git project, changes preserved at {worktree_path}")
            return True, "Non-git project, no merge needed"

        project_path = project["path"]

        # 安全检查：确保 worktree 路径与主项目路径不同
        if paths_are_equal(worktree_path, project_path):
            logger.error(
                f"Task {task_id}: SECURITY VIOLATION - worktree_path equals project_path! "
                f"worktree_path={worktree_path}, project_path={project_path}"
            )
            return False, "Security violation: worktree_path equals project_path"

        # Get the current branch of the source project (dynamic, not main_branch)
        code, source_branch, _ = await self._run_git(
            ["rev-parse", "--abbrev-ref", "HEAD"], cwd=project_path
        )
        if code != 0:
            # Fallback to main_branch if current branch cannot be determined
            source_branch = project.get("main_branch", "main")
            logger.warning(f"Could not determine current branch, using {source_branch}")
        else:
            source_branch = source_branch.strip()
            logger.info(f"Task {task_id}: Merging to source branch {source_branch}")

        # Step 1: Stage all changes in worktree
        logger.info(f"Staging changes in worktree {worktree_path}")
        code, out, err = await self._run_git(["add", "-A"], cwd=worktree_path)
        if code != 0:
            return False, f"Failed to stage changes: {err}"

        # Step 2: Check if there are any changes to commit
        code, out, _ = await self._run_git(["diff-index", "--quiet", "HEAD"], cwd=worktree_path)
        has_changes = (code != 0)

        if has_changes:
            logger.info(f"Changes detected in worktree {worktree_path}, committing...")
            code, out, err = await self._run_git(["commit", "-m", commit_msg], cwd=worktree_path)
            if code != 0:
                return False, f"Failed to commit: {err}"

            # Step 3: Merge to source branch (dynamic)
            logger.info(f"Merging branch {branch_name} into {source_branch}")

            # Checkout source branch
            code, out, err = await self._run_git(["checkout", source_branch], cwd=project_path)
            if code != 0:
                return False, f"Failed to checkout {source_branch}: {err}"

            # Merge with --no-ff to preserve merge commit
            code, out, err = await self._run_git(
                ["merge", "--no-ff", "-m", commit_msg, branch_name],
                cwd=project_path,
            )

            if code != 0:
                # Merge conflict - preserve worktree for user inspection
                logger.error(f"Merge conflict: {err}")
                # Do NOT abort merge - keep worktree and branch for user to resolve
                return False, f"Merge conflict (worktree preserved): {err}"

            logger.info(f"Successfully merged branch {branch_name} into {source_branch}")
        else:
            logger.info(f"No changes in worktree {worktree_path}, skipping commit and merge")
            # No changes - just checkout source branch to release the worktree
            code, out, err = await self._run_git(["checkout", source_branch], cwd=project_path)
            if code != 0:
                logger.warning(f"Failed to checkout {source_branch}: {err}")

        # Step 4: Remove worktree and delete branch (worktree first, then branch)
        logger.info(f"Cleaning up worktree and branch {branch_name}")

        # Remove worktree first (required before deleting the branch)
        code, out, err = await self._run_git(["worktree", "remove", worktree_path, "--force"], cwd=project_path)
        if code != 0:
            logger.warning(f"Failed to remove worktree: {err}")

        # Delete branch after worktree is removed
        code, out, err = await self._run_git(["branch", "-D", branch_name], cwd=project_path)
        if code != 0:
            logger.warning(f"Failed to delete branch: {err}")

        logger.info(f"Worktree cleanup completed for task {task_id}")
        return True, "Success"

    async def cleanup_worktree(
        self,
        project_id: int,
        task_id: int,
        branch_name: str,
        worktree_path: str,
    ) -> bool:
        """Cleanup worktree without merging (for failed/cancelled tasks).

        Args:
            project_id: Project ID
            task_id: Task ID
            branch_name: Worktree branch name
            worktree_path: Worktree path

        Returns:
            True if successful, False otherwise
        """
        project = await self.get_project(project_id)
        if not project:
            return False

        project_path = project["path"]

        # 安全检查：确保 worktree 路径与主项目路径不同
        if paths_are_equal(worktree_path, project_path):
            logger.error(
                f"Task {task_id}: SECURITY VIOLATION - worktree_path equals project_path! "
                f"worktree_path={worktree_path}, project_path={project_path}"
            )
            return False

        # Remove worktree first (required before deleting the branch)
        await self._run_git(["worktree", "remove", worktree_path, "--force"], cwd=project_path)

        # Delete branch after worktree is removed
        await self._run_git(["branch", "-D", branch_name], cwd=project_path)

        logger.info(f"Worktree cleanup completed for task {task_id}")
        return True


# Module-level functions for backward compatibility
def get_service() -> WorktreeService:
    """Get WorktreeService instance."""
    from db import get_connection
    return WorktreeService(get_connection())


async def create_worktree(
    project_id: int,
    task_id: int,
    branch_name: Optional[str] = None,
) -> Optional[Dict[str, str]]:
    """Create a new worktree for a task."""
    return await get_service().create_worktree(project_id, task_id, branch_name)


async def merge_and_cleanup(
    project_id: int,
    task_id: int,
    branch_name: str,
    worktree_path: str,
    commit_msg: str,
) -> Tuple[bool, str]:
    """Commit changes, merge to main, and cleanup worktree."""
    return await get_service().merge_and_cleanup(
        project_id, task_id, branch_name, worktree_path, commit_msg
    )


async def cleanup_worktree(
    project_id: int,
    task_id: int,
    branch_name: str,
    worktree_path: str,
) -> bool:
    """Cleanup worktree without merging."""
    return await get_service().cleanup_worktree(project_id, task_id, branch_name, worktree_path)
