"""Tests for social interactions: likes and comments on content."""

from datetime import datetime
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import HTTPException, status

from app.schemas.comment import CommentOut
from app.schemas.like import LikeOut

# ── Helpers ───────────────────────────────────────────────────────────────────


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
    user_id = uuid4()

    with patch("app.services.likes.LikeService.delete", new_callable=AsyncMock) as mock_del:
        mock_del.return_value = None

        response = client.delete(f"/content/{content_id}/likes/{user_id}")
        assert response.status_code == status.HTTP_204_NO_CONTENT


def test_delete_comment_returns_204(client, admin_user):
    comment_id = uuid4()
    sample_comment = _make_comment(user_id=admin_user.id)

    with (
        patch("app.services.comments.CommentService.get", new_callable=AsyncMock) as mock_get,
        patch("app.services.comments.CommentService.delete", new_callable=AsyncMock) as mock_del,
    ):
        mock_get.return_value = sample_comment
        mock_del.return_value = None

        response = client.delete(f"/comments/{comment_id}")
        assert response.status_code == status.HTTP_204_NO_CONTENT


def test_delete_comment_not_found(client):
    with patch("app.services.comments.CommentService.get", new_callable=AsyncMock) as mock_get:
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
