"""Routes package - API endpoint modules."""

from .tasks import router as tasks_router
from .plans import router as plans_router
from .status import router as status_router
from .projects import router as projects_router
from .filesystem import router as filesystem_router
from .inbox import router as inbox_router
from .auth import auth_router

__all__ = [
    "tasks_router",
    "plans_router",
    "status_router",
    "projects_router",
    "filesystem_router",
    "inbox_router",
    "auth_router",
]
