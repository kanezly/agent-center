"""Tests for plan API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_plan(client: AsyncClient):
    """Test creating a new plan."""
    response = await client.post(
        "/api/plan",
        json={"goal": "Test plan goal"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "group_id" in data


@pytest.mark.asyncio
async def test_list_plans(client: AsyncClient):
    """Test listing plans."""
    response = await client.get("/api/plans")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_plan_not_found(client: AsyncClient):
    """Test getting a non-existent plan."""
    response = await client.get("/api/plan/99999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_plan_exists(client: AsyncClient):
    """Test getting an existing plan."""
    # Create a plan first
    create_response = await client.post(
        "/api/plan",
        json={"goal": "Plan to get"}
    )
    group_id = create_response.json()["group_id"]

    # Get the plan
    response = await client.get(f"/api/plan/{group_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == group_id
    assert data["goal"] == "Plan to get"
