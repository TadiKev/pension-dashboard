pytest_plugins = ["pytest_asyncio"]

import pytest
from httpx import AsyncClient
from api.main import app

@pytest.fixture
async def client():
    """
    Async client fixture bound to the FastAPI app (no network).
    """
    async with AsyncClient(app=app, base_url="http://testserver") as ac:
        yield ac
