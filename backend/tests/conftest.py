"""Test configuration and fixtures."""

from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from testcontainers.postgres import PostgresContainer

from app.core.auth import get_current_user
from app.core.db import get_session
from app.main import create_app
from app.models.base import Base
from app.models.user import Permissions
from app.schemas.user import UserOut
from app.schemas.workspace import WorkspaceOut

# ── Unit test fixtures (mocked DB) ────────────────────────────────────────────


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = AsyncMock()
    return session


@pytest.fixture
def admin_user():
    """A platform admin user — bypasses all workspace/group access checks."""
    return UserOut(
        id=uuid4(),
        auth0_id="auth0|admin_test",
        email="admin@test.com",
        name="Admin User",
        pronouns=None,
        permissions=Permissions.admin,
        preferences=None,
    )


@pytest.fixture
def viewer_user():
    """A regular viewer user — useful for testing permission denials."""
    return UserOut(
        id=uuid4(),
        auth0_id="auth0|viewer_test",
        email="viewer@test.com",
        name="Viewer User",
        pronouns=None,
        permissions=Permissions.viewer,
        preferences=None,
    )


@pytest.fixture
def client(mock_db_session, admin_user):
    """Test client with mocked DB and an authenticated admin user."""
    app = create_app()

    async def override_get_session():
        yield mock_db_session

    async def override_get_current_user():
        return UserOut(
            id=uuid4(),
            auth0_id="auth0|test",
            email="test@example.com",
            name="Test User",
            pronouns=None,
            permissions=Permissions.admin,
            preferences=None,
        )

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)


@pytest.fixture
def sample_user_data():
    return {
        "auth0_id": "auth0|123456",
        "email": "test@example.com",
        "name": "Test User",
    }


@pytest.fixture
def sample_user(sample_user_data):
    return UserOut(
        id=uuid4(),
        auth0_id=sample_user_data["auth0_id"],
        email=sample_user_data["email"],
        name=sample_user_data["name"],
        pronouns=None,
        permissions=Permissions.viewer,
        preferences=None,
    )


@pytest.fixture
def sample_workspace_data():
    return {
        "name": "Test Workspace",
        "description": "A test workspace",
    }


@pytest.fixture
def sample_workspace(sample_workspace_data):
    return WorkspaceOut(
        id=uuid4(),
        name=sample_workspace_data["name"],
    )


# ── Integration test fixtures (real Postgres via Docker) ──────────────────────


@pytest.fixture(scope="session")
def postgres_container():
    """Start a real Postgres container for the test session."""
    with PostgresContainer("postgres:16") as pg:
        yield pg


@pytest.fixture(scope="session")
async def integration_engine(postgres_container):
    """Create async engine and build the schema once per session."""
    url = postgres_container.get_connection_url().replace("psycopg2", "psycopg")
    engine = create_async_engine(url, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db(integration_engine) -> AsyncGenerator[AsyncSession, None]:
    """
    Per-test database session backed by a real Postgres instance.

    Uses a savepoint so that each test is fully isolated — even though
    services call session.commit(), everything is rolled back at the end.
    """
    async with integration_engine.connect() as conn:
        await conn.begin()
        session_factory = async_sessionmaker(
            bind=conn,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        async with session_factory() as session:
            yield session
        await conn.rollback()
