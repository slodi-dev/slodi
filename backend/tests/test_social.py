"""Tests for social interactions: likes and comments on content."""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException, status

from app.schemas.comment import CommentOut
from app.schemas.like import LikeOut

# ── Helpers ───────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _content_is_reachable():
    """Likes and comments address content by id and never name a workspace, so
    every one of these routes now resolves the workspace first (sc-428). These
    tests are about likes and comments, not about that check — give them a
    workspace and let the real check run against it.
    """
    with patch(
        "app.services.content.ContentService.get_workspace_id", new_callable=AsyncMock
    ) as ws:
        ws.return_value = uuid4()
        yield


def _make_like(content_id=None, user_id=None):
    return LikeOut(
        content_id=content_id or uuid4(),
        user_id=user_id or uuid4(),
    )


def _make_comment(content_id=None, user_id=None):
    return CommentOut(
        id=uuid4(),
        body="Great content!",
        user_id=user_id or uuid4(),
        content_id=content_id or uuid4(),
        created_at=datetime.now(),
        author_name="Test User",
    )


# ── Likes ─────────────────────────────────────────────────────────────────────


def test_list_content_likes(client):
    content_id = uuid4()
    sample_likes = [_make_like(content_id=content_id), _make_like(content_id=content_id)]

    with (
        patch(
            "app.services.likes.LikeService.list_for_content", new_callable=AsyncMock
        ) as mock_list,
        patch(
            "app.services.likes.LikeService.count_content_likes", new_callable=AsyncMock
        ) as mock_count,
    ):
        mock_list.return_value = sample_likes
        mock_count.return_value = 2

        response = client.get(f"/content/{content_id}/likes")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) == 2


def test_like_content(client):
    content_id = uuid4()
    user_id = uuid4()
    sample_like = _make_like(content_id=content_id, user_id=user_id)

    with patch("app.services.likes.LikeService.like_content", new_callable=AsyncMock) as mock_like:
        mock_like.return_value = sample_like

        response = client.post(f"/content/{content_id}/likes", params={"user_id": str(user_id)})
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["content_id"] == str(content_id)
        assert data["user_id"] == str(user_id)


# ── Comments ──────────────────────────────────────────────────────────────────


def test_list_content_comments(client):
    content_id = uuid4()
    sample_comments = [_make_comment(content_id=content_id), _make_comment(content_id=content_id)]

    with (
        patch(
            "app.services.comments.CommentService.list_for_content", new_callable=AsyncMock
        ) as mock_list,
        patch(
            "app.services.comments.CommentService.count_content_comments", new_callable=AsyncMock
        ) as mock_count,
    ):
        mock_list.return_value = sample_comments
        mock_count.return_value = 2

        response = client.get(f"/content/{content_id}/comments")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        assert data[0]["body"] == "Great content!"


def test_create_comment(client):
    content_id = uuid4()
    user_id = uuid4()
    comment_data = {"body": "Great content!", "user_id": str(user_id)}
    sample_comment = _make_comment(content_id=content_id, user_id=user_id)

    with patch(
        "app.services.comments.CommentService.create_under_content", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = sample_comment

        response = client.post(f"/content/{content_id}/comments", json=comment_data)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["body"] == comment_data["body"]


def test_unlike_content_returns_204(client):
    content_id = uuid4()

    with patch("app.services.likes.LikeService.delete", new_callable=AsyncMock) as mock_del:
        mock_del.return_value = None

        response = client.delete(f"/content/{content_id}/likes")
        assert response.status_code == status.HTTP_204_NO_CONTENT


def _comment_row(user_id, workspace_id=None, content_author_id=None):
    """A stand-in for the ORM row the delete route authorises against.

    It needs three facts: who wrote the comment, who wrote the item it hangs
    under, and which workspace that item belongs to.
    """
    return SimpleNamespace(
        id=uuid4(),
        user_id=user_id,
        content=SimpleNamespace(
            workspace_id=workspace_id or uuid4(),
            author_id=content_author_id or uuid4(),
        ),
    )


def test_delete_comment_returns_204(client, admin_user):
    comment_id = uuid4()

    with (
        patch("app.services.comments.CommentService.get_model", new_callable=AsyncMock) as mock_get,
        patch("app.services.comments.CommentService.delete", new_callable=AsyncMock) as mock_del,
    ):
        mock_get.return_value = _comment_row(user_id=admin_user.id)
        mock_del.return_value = None

        response = client.delete(f"/comments/{comment_id}")
        assert response.status_code == status.HTTP_204_NO_CONTENT


def test_moderator_can_delete_someone_elses_comment(client, admin_user):
    """The bank's only public text surface needs a moderation path.

    Before this the rule was the comment's own author alone, which left
    Dagskrárstjórnarteymið — who hold `moderator`, not platform `admin` — unable
    to remove anything anyone else had written.
    """
    with (
        patch("app.services.comments.CommentService.get_model", new_callable=AsyncMock) as mock_get,
        patch("app.services.comments.CommentService.delete", new_callable=AsyncMock) as mock_del,
    ):
        # written by somebody else entirely
        mock_get.return_value = _comment_row(user_id=uuid4())
        mock_del.return_value = None

        response = client.delete(f"/comments/{uuid4()}")

        assert response.status_code == status.HTTP_204_NO_CONTENT
        mock_del.assert_awaited_once()


def test_the_item_author_can_clear_a_comment_on_their_own_item(client, admin_user):
    """A leader is responsible for what accumulates under their own idea.

    They should be able to remove a comment on it without waiting for
    Dagskrárstjórnarteymið.
    """
    with (
        patch("app.services.comments.CommentService.get_model", new_callable=AsyncMock) as mock_get,
        patch("app.services.comments.CommentService.delete", new_callable=AsyncMock) as mock_del,
    ):
        # somebody else's comment, on an item this user wrote
        mock_get.return_value = _comment_row(user_id=uuid4(), content_author_id=admin_user.id)
        mock_del.return_value = None

        response = client.delete(f"/comments/{uuid4()}")

        assert response.status_code == status.HTTP_204_NO_CONTENT
        mock_del.assert_awaited_once()


def test_delete_comment_not_found(client):
    with patch(
        "app.services.comments.CommentService.get_model", new_callable=AsyncMock
    ) as mock_get:
        mock_get.side_effect = HTTPException(status_code=404, detail="Comment not found")

        response = client.delete(f"/comments/{uuid4()}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


def test_list_content_likes_empty(client):
    content_id = uuid4()

    with (
        patch(
            "app.services.likes.LikeService.list_for_content", new_callable=AsyncMock
        ) as mock_list,
        patch(
            "app.services.likes.LikeService.count_content_likes", new_callable=AsyncMock
        ) as mock_count,
    ):
        mock_list.return_value = []
        mock_count.return_value = 0

        response = client.get(f"/content/{content_id}/likes")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []
