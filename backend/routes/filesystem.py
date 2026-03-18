"""Filesystem browser API routes - for folder selection."""

import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

router = APIRouter(tags=["filesystem"])


class FileSystemEntry(BaseModel):
    name: str
    path: str
    type: str  # "folder" or "file"
    size: Optional[int] = None
    modified: Optional[str] = None


class FileSystemListResponse(BaseModel):
    current_path: str
    parent_path: Optional[str] = None
    entries: List[FileSystemEntry]


@router.get("/filesystem/browse")
async def browse_directory(
    path: Optional[str] = Query(default=None, description="Directory path to browse"),
    show_files: bool = Query(default=False, description="Whether to show files (default: folders only)"),
):
    """Browse local filesystem for folder selection.

    Args:
        path: Directory path to browse. If None, starts at common locations.
        show_files: Whether to include files in the listing (default: folders only)

    Returns:
        List of directory entries with name, path, and type.
    """
    # Default starting paths
    if path is None:
        # On Windows, start at common locations
        if os.name == "nt":
            # Return list of drives and common folders
            drives = []

            # Use psutil to get disk partitions if available
            if HAS_PSUTIL:
                partitions = psutil.disk_partitions(all=False)
                for partition in partitions:
                    # Only include physical drives and mapped network drives
                    if partition.fstype:  # Skip empty partitions
                        drives.append(FileSystemEntry(
                            name=f"{partition.device} ({partition.fstype})",
                            path=partition.mountpoint,
                            type="folder",
                        ))
            else:
                # Fallback to manual drive letter check
                for letter in "CDEFGHIJKLMNOPQRSTUVWXYZ":
                    drive = f"{letter}:\\"
                    if os.path.exists(drive):
                        drives.append(FileSystemEntry(
                            name=f"Drive {letter}:",
                            path=drive,
                            type="folder",
                        ))

            # Also add common user folders
            user_profile = os.environ.get("USERPROFILE", "")
            if user_profile and os.path.exists(user_profile):
                for folder in ["Desktop", "Documents", "Downloads", "Projects"]:
                    folder_path = os.path.join(user_profile, folder)
                    if os.path.exists(folder_path):
                        drives.append(FileSystemEntry(
                            name=folder,
                            path=folder_path,
                            type="folder",
                        ))
            return {
                "current_path": "Computer",
                "parent_path": None,
                "entries": drives,
            }
        else:
            # Unix-like systems - start at home directory
            path = os.path.expanduser("~")

    # Validate path
    abs_path = os.path.abspath(os.path.normpath(path))

    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail=f"Path does not exist: {path}")

    if not os.path.isdir(abs_path):
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {path}")

    # Security: prevent browsing outside allowed areas (optional)
    # You could add a check here to restrict to specific root directories

    try:
        entries = []
        for entry_name in os.listdir(abs_path):
            entry_path = os.path.join(abs_path, entry_name)
            try:
                stat_info = os.stat(entry_path)
                is_dir = os.path.isdir(entry_path)

                # Skip hidden files/folders (starting with .)
                if entry_name.startswith("."):
                    continue

                # Skip system folders on Windows
                if os.name == "nt":
                    if entry_name.lower() in ["windows", "program files", "program files (x86)", "perflogs"]:
                        continue

                if is_dir:
                    entries.append(FileSystemEntry(
                        name=entry_name,
                        path=entry_path,
                        type="folder",
                    ))
                elif show_files:
                    entries.append(FileSystemEntry(
                        name=entry_name,
                        path=entry_path,
                        type="file",
                        size=stat_info.st_size,
                    ))
            except (PermissionError, OSError):
                # Skip entries we can't access
                continue

        # Sort: folders first, then files, alphabetically
        entries.sort(key=lambda e: (e.type != "folder", e.name.lower()))

        # Parent directory
        parent_path = os.path.dirname(abs_path) if abs_path != os.path.dirname(abs_path) else None

        return FileSystemListResponse(
            current_path=abs_path,
            parent_path=parent_path,
            entries=entries,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=f"Permission denied: {str(e)}")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Error accessing directory: {str(e)}")


@router.get("/filesystem/validate")
async def validate_path(
    path: str = Query(..., description="Path to validate"),
    require_git: bool = Query(default=False, description="Whether to require a git repository"),
):
    """Validate that a path exists and optionally is a git repository.

    Args:
        path: Path to validate
        require_git: If True, requires the path to be a git repository

    Returns:
        Validation result with path details.
    """
    abs_path = os.path.abspath(os.path.normpath(path))

    if not os.path.exists(abs_path):
        return {
            "valid": False,
            "path": abs_path,
            "error": "Path does not exist",
        }

    if not os.path.isdir(abs_path):
        return {
            "valid": False,
            "path": abs_path,
            "error": "Path is not a directory",
        }

    is_git = False
    if require_git:
        # Check for .git folder or git repo
        git_dir = os.path.join(abs_path, ".git")
        is_git = os.path.exists(git_dir)
        if not is_git:
            return {
                "valid": False,
                "path": abs_path,
                "error": "Not a git repository",
                "is_git": False,
            }

    return {
        "valid": True,
        "path": abs_path,
        "is_git": is_git,
        "exists": True,
        "is_directory": True,
    }
