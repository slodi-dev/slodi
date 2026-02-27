"""
Integration tests — require a running Docker daemon.

Run with:
    make test-integration
or:
    PYTHONPATH=. uv run pytest -q -m integration

These tests spin up a real Postgres container via testcontainers, apply the
full SQLAlchemy schema, and exercise the FastAPI app end-to-end.
Each test rolls back to a savepoint so tests are fully isolated.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.core.db import get_session
from app.main import create_app
from app.models.user import Permissions
from app.schemas.user import UserOut

# ── Helpers ───────────────────────────────────────────────────────────────────

_ADMIN_USER = UserOut(
    id=uuid4(),
    auth0_id="auth0|integration_admin",
    email="admin@integration.example.com",
    name="Integration Admin",
    pronouns=None,
    permissions=Permissions.admin,
    preferences=None,
)


def _make_client(db_session) -> TestClient:
    """Build a TestClient that injects *db_session* as the DB dependency."""
    app = create_app()

    async def override_get_session():
        yield db_session

    async def override_get_current_user():
        return _ADMIN_USER

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def http(db):
    """HTTP test client wired to the per-test real DB session."""
    return _make_client(db)


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.integration
class TestUserPersistence:
    """Users are written to and retrieved from real Postgres rows."""

    def test_create_user_returns_201(self, http):
        resp = http.post(
            "/users",
            json={"auth0_id": "auth0|int_001", "email": "int001@example.com", "name": "Int User"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["auth0_id"] == "auth0|int_001"
        assert body["email"] == "int001@example.com"
        assert "id" in body

    def test_created_user_is_retrievable(self, http):
        create = http.post(
            "/users",
            json={
                "auth0_id": "auth0|int_002",
                "email": "int002@example.com",
                "name": "Retrieve Me",
            },
        )
        user_id = create.json()["id"]

        resp = http.get(f"/users/{user_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == user_id

    def test_duplicate_auth0_id_returns_409(self, http):
        payload = {"auth0_id": "auth0|dup", "email": "dup1@example.com", "name": "Dup"}
        http.post("/users", json=payload)

        payload2 = dict(payload, email="dup2@example.com")  # same auth0_id, different email
        resp = http.post("/users", json=payload2)
        assert resp.status_code == 409

    def test_duplicate_email_returns_409(self, http):
        payload = {"auth0_id": "auth0|dup_email_1", "email": "shared@example.com", "name": "First"}
        http.post("/users", json=payload)

        payload2 = dict(payload, auth0_id="auth0|dup_email_2")  # different auth0_id, same email
        resp = http.post("/users", json=payload2)
        assert resp.status_code == 409

    def test_get_nonexistent_user_returns_404(self, http):
        from uuid import uuid4

        resp = http.get(f"/users/{uuid4()}")
        assert resp.status_code == 404

    def test_list_users_returns_created_user(self, http):
        http.post(
            "/users",
            json={"auth0_id": "auth0|list_001", "email": "list001@example.com", "name": "Listed"},
        )
        resp = http.get("/users")
        assert resp.status_code == 200
        names = [u["name"] for u in resp.json()]
        assert "Listed" in names


@pytest.mark.integration
class TestWorkspacePersistence:
    """Workspaces are stored in the DB and linked to their owner."""

    def _create_user(self, http, suffix: str) -> str:
        resp = http.post(
            "/users",
            json={
                "auth0_id": f"auth0|ws_{suffix}",
                "email": f"ws_{suffix}@example.com",
                "name": f"WS User {suffix}",
            },
        )
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_create_workspace_returns_201(self, http):
        user_id = self._create_user(http, "create")
        resp = http.post(
            f"/users/{user_id}/workspaces",
            json={"name": "My Workspace"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "My Workspace"
        assert "id" in body

    def test_workspace_appears_in_user_list(self, http):
        user_id = self._create_user(http, "list")
        http.post(f"/users/{user_id}/workspaces", json={"name": "Listed WS"})

        resp = http.get(f"/users/{user_id}/workspaces")
        assert resp.status_code == 200
        names = [w["name"] for w in resp.json()]
        assert "Listed WS" in names

    def test_workspace_is_retrievable_by_id(self, http):
        user_id = self._create_user(http, "get")
        create_resp = http.post(f"/users/{user_id}/workspaces", json={"name": "Fetchable WS"})
        ws_id = create_resp.json()["id"]

        resp = http.get(f"/workspaces/{ws_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == ws_id

    def test_get_nonexistent_workspace_returns_404(self, http):
        from uuid import uuid4

        resp = http.get(f"/workspaces/{uuid4()}")
        assert resp.status_code == 404

    def test_multiple_workspaces_per_user(self, http):
        user_id = self._create_user(http, "multi")
        http.post(f"/users/{user_id}/workspaces", json={"name": "WS Alpha"})
        http.post(f"/users/{user_id}/workspaces", json={"name": "WS Beta"})

        resp = http.get(f"/users/{user_id}/workspaces")
        assert resp.status_code == 200
        names = {w["name"] for w in resp.json()}
        assert {"WS Alpha", "WS Beta"}.issubset(names)

    def test_workspaces_are_isolated_between_users(self, http):
        user_a = self._create_user(http, "iso_a")
        user_b = self._create_user(http, "iso_b")
        http.post(f"/users/{user_a}/workspaces", json={"name": "User A Only"})

        resp = http.get(f"/users/{user_b}/workspaces")
        assert resp.status_code == 200
        names = [w["name"] for w in resp.json()]
        assert "User A Only" not in names
