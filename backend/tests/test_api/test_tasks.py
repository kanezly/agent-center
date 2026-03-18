"""Tests for task API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_task(client: AsyncClient, test_db):
    """Test creating a new task."""
    # Mock scheduler to avoid None error
    import app
    app.scheduler = type('MockScheduler', (), {'notify': lambda self: None})()

    response = await client.post(
        "/api/tasks",
        json={
            "prompt": "Test task prompt",
            "priority": 0,
            "mode": "execute",
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["status"] == "queued"


@pytest.mark.asyncio
async def test_list_tasks_empty(client: AsyncClient, test_db):
    """Test listing tasks when empty."""
    response = await client.get("/api/tasks")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_list_tasks_with_data(client: AsyncClient, test_db):
    """Test listing tasks after creating one."""
    # Mock scheduler
    import app
    app.scheduler = type('MockScheduler', (), {'notify': lambda self: None})()

    # Create a task first
    await client.post(
        "/api/tasks",
        json={
            "prompt": "Task to list",
            "priority": 1,
            "mode": "execute",
        }
    )

    # List tasks
    response = await client.get("/api/tasks")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(t["prompt"] == "Task to list" for t in data)


@pytest.mark.asyncio
async def test_get_task_not_found(client: AsyncClient, test_db):
    """Test getting a non-existent task."""
    response = await client.get("/api/tasks/99999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_task_exists(client: AsyncClient, test_db):
    """Test getting an existing task."""
    # Mock scheduler
    import app
    app.scheduler = type('MockScheduler', (), {'notify': lambda self: None})()

    # Create a task first
    create_response = await client.post(
        "/api/tasks",
        json={
            "prompt": "Task to get",
            "priority": 0,
            "mode": "execute",
        }
    )
    task_id = create_response.json()["id"]

    # Get the task
    response = await client.get(f"/api/tasks/{task_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == task_id
    assert data["prompt"] == "Task to get"
    assert "logs" in data


@pytest.mark.asyncio
async def test_cancel_task(client: AsyncClient, test_db):
    """Test cancelling a queued task."""
    # Mock scheduler
    import app
    app.scheduler = type('MockScheduler', (), {'notify': lambda self: None})()

    # Create a task first
    create_response = await client.post(
        "/api/tasks",
        json={
            "prompt": "Task to cancel",
            "priority": 0,
            "mode": "execute",
        }
    )
    task_id = create_response.json()["id"]

    # Cancel the task
    response = await client.delete(f"/api/tasks/{task_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "cancelled"


@pytest.mark.asyncio
async def test_filter_tasks_by_status(client: AsyncClient, test_db):
    """Test filtering tasks by status."""
    # Mock scheduler
    import app
    app.scheduler = type('MockScheduler', (), {'notify': lambda self: None})()

    # Create a task
    await client.post(
        "/api/tasks",
        json={
            "prompt": "Queued task",
            "priority": 0,
            "mode": "execute",
        }
    )

    # Filter by queued status
    response = await client.get("/api/tasks?status=queued")
    assert response.status_code == 200
    data = response.json()
    assert all(t["status"] == "queued" for t in data)
