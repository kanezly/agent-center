"""Pytest configuration and fixtures."""

import asyncio
import sys
from pathlib import Path
from typing import AsyncGenerator

import pytest
import pytest_asyncio

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


@pytest_asyncio.fixture(scope="function")
async def test_db():
    """Create an in-memory database for testing."""
    import aiosqlite

    from db import SCHEMA

    # Create in-memory database
    db = await aiosqlite.connect(":memory:")
    db.row_factory = aiosqlite.Row
    await db.executescript(SCHEMA)
    await db.commit()

    # Temporarily replace global connection
    import db as db_module
    old_connection = db_module._connection
    db_module._connection = db

    yield db

    # Restore original connection
    db_module._connection = old_connection
    await db.close()


@pytest_asyncio.fixture
async def client(test_db):
    """Create a test client for the API."""
    from httpx import AsyncClient, ASGITransport

    # Import app after test_db is set up
    from app import app

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac
