"""Worker state management."""

from dataclasses import dataclass
from typing import Optional


@dataclass
class Worker:
    """Represents a single worker slot."""

    id: int
    status: str = "idle"  # idle / busy
    task_id: Optional[int] = None
    task_prompt: str = ""
    worktree_name: str = ""
    worktree_id: Optional[int] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "status": self.status,
            "task_id": self.task_id,
            "task_prompt": (
                self.task_prompt[:80] + "..."
            ) if len(self.task_prompt) > 80 else self.task_prompt,
            "worktree": self.worktree_name,
        }

    def reset(self) -> None:
        """Reset worker to idle state."""
        self.status = "idle"
        self.task_id = None
        self.task_prompt = ""
        self.worktree_name = ""
        self.worktree_id = None
