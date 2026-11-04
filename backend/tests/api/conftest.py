"""API test setup: a real PostgreSQL database, migrated with Alembic.

Needs DATABASE_URL pointing at an empty test database, for example the
PostgreSQL service in GitHub Actions. All tables are emptied before the run.
"""
import os
import subprocess
from pathlib import Path

import pytest

os.environ.setdefault("AUTH_COOKIE_SECURE", "false")
os.environ.setdefault("DB_NULL_POOL", "true")
os.environ.setdefault("AUTH_ALLOWED_ORIGINS", "http://testserver")
os.environ.setdefault("GEMINI_API_KEY", "")  # use the fixed fallback text, never call Gemini in tests

if not os.getenv("DATABASE_URL"):
    pytest.skip("API tests need DATABASE_URL", allow_module_level=True)

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from tests.seed_data import PASSWORD, reset_and_seed  # noqa: E402

BACKEND = Path(__file__).resolve().parents[2]
ORIGIN = {"Origin": "http://testserver"}


@pytest.fixture(scope="session")
def app_client():
    subprocess.run(["alembic", "upgrade", "head"], cwd=BACKEND, check=True)
    with TestClient(app, headers=ORIGIN) as client:
        yield client


@pytest.fixture()
def data(app_client):
    """Fresh users and listings for every test."""
    users, products = app_client.portal.call(reset_and_seed)
    app_client.cookies.clear()
    return {"users": users, "products": products}


@pytest.fixture()
def login(app_client):
    """Return a new client signed in as the given test user."""
    clients = []

    def _login(key, password=PASSWORD):
        client = TestClient(app, headers=ORIGIN)
        client.__enter__()
        clients.append(client)
        response = client.post("/auth/login", json={"email": f"{key}@test.local", "password": password})
        assert response.status_code == 200, response.text
        return client

    yield _login
    for client in clients:
        client.__exit__(None, None, None)
