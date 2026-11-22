"""Users and personal workspaces against a real Postgres (testcontainers)."""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.core.db import get_session
from app.main import create_app
from app.schemas.user import UserCreate, UserOut
from app.services.users import UserService


def _client_as(db, user: UserOut) -> TestClient:
    app = create_app()

    async def override_get_session():
        yield db

    async def override_get_current_user():
        return user

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)


async def _user(db, suffix: str) -> UserOut:
    return await UserService(db).create(
        UserCreate(auth0_id=f"auth0|{suffix}", email=f"{suffix}@example.com", name=suffix)
    )


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("field", ["auth0_id", "email"])
async def test_a_second_user_with_the_same_auth0_id_or_email_is_a_409(db, field):
    first = await _user(db, "first")
    other = {"auth0_id": "auth0|second", "email": "second@example.com", "name": "second"}
    other[field] = getattr(first, field)

    with pytest.raises(HTTPException) as exc:
        await UserService(db).create(UserCreate(**other))
    assert exc.value.status_code == 409


@pytest.mark.integration
@pytest.mark.asyncio
async def test_my_new_workspaces_are_listed_for_me_only(db):
    me, someone_else = await _user(db, "me"), await _user(db, "else")
    mine = _client_as(db, me)

    for name in ("Alfa", "Beta"):
        assert mine.post("/users/me/workspaces", json={"name": name}).status_code == 201

    assert {w["name"] for w in mine.get("/users/me/workspaces").json()} >= {"Alfa", "Beta"}
    theirs = {w["name"] for w in _client_as(db, someone_else).get("/users/me/workspaces").json()}
    assert not theirs & {"Alfa", "Beta"}
