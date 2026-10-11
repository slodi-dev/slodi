"""Item pages are signed-in only (user decision 2026-10-11).

Nothing about a bank item — the item itself, its comments, likes or tags — is
served to an anonymous caller. `GET /content/{id}` and `GET /programs/{id}` are
cached for a minute, so they must also say `private`: a `public` response to an
authenticated request could be handed to the next caller by a shared cache.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.main import create_app
from tests.test_workspace_content import _make_program

ITEM = uuid4()

ITEM_PATHS = [
    f"/content/{ITEM}",
    f"/programs/{ITEM}",
    f"/events/{ITEM}",
    f"/tasks/{ITEM}",
    f"/content/{ITEM}/comments",
    f"/content/{ITEM}/likes",
    f"/content/{ITEM}/tags",
    f"/workspaces/{ITEM}/content",
    f"/workspaces/{ITEM}/programs",
    f"/tags/{ITEM}/content",
]

# GET endpoints that answer without a signed-in user, and why. None serves item
# content. A new public GET has to be added here on purpose.
PUBLIC_GETS = {
    "/healthz": "liveness probe",
    "/tags": "the tag vocabulary, no items",
    "/emails/templates": "static template names and descriptions",
    "/emaillist/unsubscribe/{token}": "the token is the credential",
    "/games/{game_slug}/scores": "public game leaderboards",
}


@pytest.fixture
def anon_client():
    return TestClient(create_app())


@pytest.mark.parametrize("path", ITEM_PATHS)
def test_signed_out_get_of_item_is_401(anon_client, path):
    response = anon_client.get(path)
    assert response.status_code == 401
    assert "public" not in response.headers.get("cache-control", "")


def _dependency_calls(dependant):
    for dep in dependant.dependencies:
        yield dep.call
        yield from _dependency_calls(dep)


def test_every_get_requires_a_user_unless_listed():
    unauthenticated = {
        route.path
        for route in create_app().routes
        if isinstance(route, APIRoute)
        and "GET" in route.methods
        and get_current_user not in set(_dependency_calls(route.dependant))
    }
    assert unauthenticated == set(PUBLIC_GETS)


def test_item_responses_are_cached_privately(client, sample_workspace):
    program = _make_program(sample_workspace.id)
    with (
        patch(
            "app.repositories.programs.ProgramRepository.get_content_type",
            new_callable=AsyncMock,
            return_value="program",
        ),
        patch(
            "app.services.programs.ProgramService.get",
            new_callable=AsyncMock,
            return_value=program,
        ),
    ):
        for path in (f"/content/{program.id}", f"/programs/{program.id}"):
            response = client.get(path)
            assert response.status_code == 200, path
            assert response.headers["cache-control"] == "private, max-age=60", path
