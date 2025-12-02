import pytest
from httpx import AsyncClient
from api.main import app

# place pytest_plugins AFTER imports to satisfy ruff/flake rules
pytest_plugins = ["pytest_asyncio"]


@pytest.fixture
async def async_client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
