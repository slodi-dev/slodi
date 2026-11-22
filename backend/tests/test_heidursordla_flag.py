"""Heiðursorðla is hidden behind HEIDURSORDLA_ENABLED (user decision 2026-10-11).

Off by default: the router is not registered, so its endpoints are 404 for
everyone. On: the endpoints exist again and still require a signed-in user.
"""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import settings

PATHS = [
    "/leikir/heidursordla/today",
    "/leikir/heidursordla/leaderboard",
    f"/leikir/heidursordla/{uuid4()}",
]


def test_flag_defaults_to_off():
    assert type(settings).model_fields["heidursordla_enabled"].default is False


@pytest.mark.parametrize("path", PATHS)
def test_disabled_router_is_not_registered(monkeypatch, path):
    monkeypatch.setattr(settings, "heidursordla_enabled", False)
    client = TestClient(create_app())
    assert client.get(path).status_code == 404
    assert client.post(f"/leikir/heidursordla/{uuid4()}/guess", json={}).status_code == 404


@pytest.mark.parametrize("path", PATHS)
def test_enabled_router_requires_auth(monkeypatch, path):
    monkeypatch.setattr(settings, "heidursordla_enabled", True)
    client = TestClient(create_app())
    assert client.get(path).status_code == 401
