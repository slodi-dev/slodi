"""A hidden item's comment thread and likes go with it — see sc-487.

`hidden_at` used to be consulted by the content read paths and nowhere else, so
after a moderator hid something any member could still read its thread, add to
it, and like it. Hiding is the safeguarding lever and comments are the bank's
only public free-text surface, which makes that combination the case hiding
exists for.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.core.auth import get_current_user, require_not_suspended
from app.core.db import get_session
from app.main import create_app
from app.repositories.content import ContentAccess
from app.schemas.workspace import WorkspaceRole
from app.utils import get_current_datetime

ACCESS = "app.repositories.content.ContentRepository.get_access"
ROLE = "app.core.auth._get_workspace_role"


def _a_comment():
    from app.schemas.comment import CommentOut

    return CommentOut(
        id=uuid4(),
        body="Halló",
        author_name="Jana",
        user_id=uuid4(),
        content_id=uuid4(),
        created_at=get_current_datetime(),
    )


def _a_like():
    from app.schemas.like import LikeOut

    return LikeOut(content_id=uuid4(), user_id=uuid4())


def _client(user):
    app = create_app()

    async def _user():
        return user

    async def _not_suspended():
        return user

    app.dependency_overrides[get_session] = lambda: None
    app.dependency_overrides[get_current_user] = _user
    # Skammarkrókur is tested in test_skammarkrokur.py; here it would just need
    # a live session to answer a question these tests are not asking.
    app.dependency_overrides[require_not_suspended] = _not_suspended
    return TestClient(app)


def _call(user, method, path, *, hidden_author_id, **kw):
    """Issue one request against an item that is hidden, owned by `hidden_author_id`.

    Everything past the access check is stubbed: these tests are about who gets
    through it, not about what comments or likes do afterwards.
    """
    with (
        patch(ACCESS, new_callable=AsyncMock) as access,
        patch(ROLE, new_callable=AsyncMock) as role,
        patch(
            "app.services.comments.CommentService.list_for_content",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch(
            "app.services.comments.CommentService.count_content_comments",
            new_callable=AsyncMock,
            return_value=0,
        ),
        patch(
            "app.services.comments.CommentService.create_under_content",
            new_callable=AsyncMock,
            return_value=_a_comment(),
        ),
        patch(
            "app.services.likes.LikeService.list_for_content",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch(
            "app.services.likes.LikeService.count_content_likes",
            new_callable=AsyncMock,
            return_value=0,
        ),
        patch(
            "app.services.likes.LikeService.like_content",
            new_callable=AsyncMock,
            return_value=_a_like(),
        ),
    ):
        access.return_value = ContentAccess(
            workspace_id=uuid4(),
            author_id=hidden_author_id,
            hidden_at=get_current_datetime(),
        )
        role.return_value = WorkspaceRole.viewer
        return getattr(_client(user), method)(path, **kw)


@pytest.mark.parametrize(
    ("method", "path_for"),
    [
        ("get", lambda cid: f"/content/{cid}/comments"),
        ("get", lambda cid: f"/content/{cid}/likes"),
    ],
)
def test_a_stranger_cannot_read_a_hidden_items_thread(viewer_user, method, path_for):
    content_id = uuid4()
    res = _call(viewer_user, method, path_for(content_id), hidden_author_id=uuid4())
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_a_stranger_cannot_comment_on_a_hidden_item(viewer_user):
    content_id = uuid4()
    res = _call(
        viewer_user,
        "post",
        f"/content/{content_id}/comments",
        hidden_author_id=uuid4(),
        json={"body": "Enn að tala um þetta"},
    )
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_a_stranger_cannot_like_a_hidden_item(viewer_user):
    content_id = uuid4()
    res = _call(viewer_user, "post", f"/content/{content_id}/likes", hidden_author_id=uuid4())
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_the_author_can_still_read_the_thread_under_their_hidden_item(viewer_user):
    """They can open the item itself (sc-482); it should not 404 underneath them."""
    content_id = uuid4()
    res = _call(
        viewer_user, "get", f"/content/{content_id}/comments", hidden_author_id=viewer_user.id
    )
    assert res.status_code == status.HTTP_200_OK


def test_a_moderator_can_still_read_the_thread(moderator_user):
    """The team has to read what they are judging."""
    content_id = uuid4()
    res = _call(moderator_user, "get", f"/content/{content_id}/comments", hidden_author_id=uuid4())
    assert res.status_code == status.HTTP_200_OK
