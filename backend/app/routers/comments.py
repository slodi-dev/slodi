# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    check_content_edit_access,
    check_content_workspace_access,
    get_current_user,
    require_not_suspended,
    require_permission,
)
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.schemas.comment import CommentCreate, CommentOut, CommentUpdate
from app.schemas.user import Permissions, UserOut
from app.services.comments import CommentService

router = APIRouter(tags=["comments"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]

# ----- collection: by content -----


@router.get("/content/{content_id}/comments", response_model=list[CommentOut])
async def list_content_comments(
    session: SessionDep,
    request: Request,
    response: Response,
    content_id: UUID,
    current_user: UserOut = Depends(get_current_user),
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[CommentOut]:
    await check_content_workspace_access(content_id, current_user, session)
    svc = CommentService(session)
    total = await svc.count_content_comments(content_id)
    items = await svc.list_for_content(content_id, limit=limit, offset=offset)
    add_pagination_headers(
        response=response,
        request=request,
        total=total,
        limit=limit,
        offset=offset,
    )
    return items


# create under content (user_id is taken from the authenticated user)
@router.post(
    "/content/{content_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment_under_content(
    session: SessionDep,
    content_id: UUID,
    body: CommentUpdate,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
    _suspension: UserOut = Depends(require_not_suspended),
) -> CommentOut:
    await check_content_workspace_access(content_id, current_user, session)
    svc = CommentService(session)
    comment_data = CommentCreate(body=body.body, user_id=current_user.id)
    comment = await svc.create_under_content(content_id, comment_data)
    response.headers["Location"] = f"/comments/{comment.id}"
    return comment


# ----- item endpoints -----


@router.get("/comments/{comment_id}", response_model=CommentOut)
async def get_comment(
    session: SessionDep,
    comment_id: UUID,
    current_user: UserOut = Depends(get_current_user),
) -> CommentOut:
    svc = CommentService(session)
    return await svc.get(comment_id)


@router.patch("/comments/{comment_id}", response_model=CommentOut)
async def update_comment(
    session: SessionDep,
    comment_id: UUID,
    body: CommentUpdate,
    current_user: UserOut = Depends(get_current_user),
    _suspension: UserOut = Depends(require_not_suspended),
) -> CommentOut:
    svc = CommentService(session)
    comment = await svc.get(comment_id)
    if comment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the comment author can edit this comment.",
        )
    return await svc.update(comment_id, body)


@router.patch("/admin/comments/{comment_id}", response_model=CommentOut)
async def update_comment_admin(
    session: SessionDep,
    comment_id: UUID,
    body: CommentUpdate,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> CommentOut:
    svc = CommentService(session)
    return await svc.update(comment_id, body)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    session: SessionDep,
    comment_id: UUID,
    current_user: UserOut = Depends(get_current_user),
) -> None:
    """Remove a comment.

    Four people can: whoever wrote it, whoever wrote the item it hangs under, a
    workspace admin, and a content moderator.

    Expressed as "your own comment, or you can already act on the item itself",
    which is why this defers to `check_content_edit_access` with the *content's*
    author rather than restating a fourth rule about who may act on what. A
    leader who puts an idea in the bank is responsible for what accumulates
    under it, so they can clear a comment on their own item without waiting for
    Dagskrárstjórnarteymið.

    It used to be the comment's author alone. That left the bank's only public
    text surface with no moderation path at all: the team holds `moderator`, and
    the one other route that could remove a comment required platform `admin`.

    Editing someone else's comment stays impossible for everyone but its author
    — removing words is moderation, rewriting them puts words in their mouth.
    """
    svc = CommentService(session)
    comment = await svc.get_model(comment_id)

    if comment.user_id != current_user.id:
        await check_content_edit_access(
            comment.content.workspace_id,
            comment.content.author_id,
            current_user,
            session,
            hide_from_non_members=True,
        )

    await svc.delete(comment_id)
    return None


@router.delete("/admin/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment_admin(
    session: SessionDep,
    comment_id: UUID,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> None:
    svc = CommentService(session)
    await svc.delete(comment_id)
    return None
