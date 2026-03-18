"""Projects API routes."""

from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.project_service import (
    ProjectService,
    get_service,
    create_project,
    get_project,
    list_projects,
    update_project,
    delete_project,
)

router = APIRouter(tags=["projects"])


class ProjectCreateRequest(BaseModel):
    """Request model for creating a project."""
    name: str
    path: str
    display_name: Optional[str] = None
    description: Optional[str] = None


class ProjectUpdateRequest(BaseModel):
    """Request model for updating a project."""
    display_name: Optional[str] = None
    description: Optional[str] = None
    main_branch: Optional[str] = None


@router.post("/projects")
async def create_project_endpoint(request: ProjectCreateRequest):
    """Create a new project.

    If the path is not a git repository, it will be initialized automatically.
    The main branch will be auto-detected.
    """
    service = get_service()
    project = await service.create_project(
        name=request.name,
        path=request.path,
        display_name=request.display_name,
        description=request.description,
    )

    if not project:
        raise HTTPException(status_code=400, detail="Failed to create project")

    return project


@router.get("/projects")
async def list_projects_endpoint():
    """List all projects."""
    service = get_service()
    projects = await service.list_projects()

    # 动态添加 is_git 字段
    result = []
    for p in projects:
        project_dict = dict(p)
        project_dict["is_git"] = await service.is_git_repo(p["path"])
        result.append(project_dict)

    return result


@router.get("/projects/{project_id}")
async def get_project_endpoint(project_id: int):
    """Get project by ID."""
    service = get_service()
    project = await service.get_project(project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 动态添加 is_git 字段
    project_dict = dict(project)
    project_dict["is_git"] = await service.is_git_repo(project["path"])

    return project_dict


@router.put("/projects/{project_id}")
async def update_project_endpoint(project_id: int, request: ProjectUpdateRequest):
    """Update project metadata."""
    project = await update_project(
        project_id=project_id,
        display_name=request.display_name,
        description=request.description,
        main_branch=request.main_branch,
    )

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return project


@router.delete("/projects/{project_id}")
async def delete_project_endpoint(project_id: int):
    """Delete a project."""
    await delete_project(project_id)
    return {"status": "deleted"}


@router.post("/projects/{project_id}/refresh")
async def refresh_project_branch(project_id: int):
    """Refresh main branch detection for a project."""
    service = get_service()
    project = await service.refresh_branch(project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return project
