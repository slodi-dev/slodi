from __future__ import annotations

import datetime as dt
from collections.abc import Sequence
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import Content
from app.models.placement import Placement
from app.repositories.placements import PlacementRepository
from app.schemas.copy import AlreadyHave, CopyCreate, CopyOut, CopyPreview
from app.schemas.placement import PlacementCreate, PlacementOut
from app.services.content import ContentService, copy_content
from app.services.placements import PlacementService


def _week_shift(old: dt.datetime, new: dt.datetime) -> dt.timedelta:
    """From old's week to new's week, so every weekday and time of day stays."""
    monday_old = old.date() - dt.timedelta(days=old.weekday())
    monday_new = new.date() - dt.timedelta(days=new.weekday())
    return monday_new - monday_old


def _without_hidden(rows: Sequence[Placement]) -> list[Placement]:
    """Drops pieces a moderator has hidden, with what they hold."""
    kept: list[Placement] = []
    dropped: set[UUID] = set()
    for p in rows:
        if p is not rows[0] and (p.content.hidden_at is not None or p.parent_id in dropped):
            dropped.add(p.id)
        else:
            kept.append(p)
    return kept


class CopyService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = PlacementRepository(session)
        self.placements = PlacementService(session)

    async def preview(self, workspace_id: UUID, source_id: UUID) -> CopyPreview:
        source, rows = await self._structure(source_id)
        pieces = self._pieces(source, rows)
        newest: dict[UUID, Content] = {}
        for copy in await self.repo.copies_in_workspace(list(pieces), workspace_id):
            if copy.copied_from_id is not None:
                newest.setdefault(copy.copied_from_id, copy)
        return CopyPreview(
            already_have=[
                AlreadyHave(source_id=source_id, existing_id=copy.id, name=copy.name)
                for source_id, copy in newest.items()
            ]
        )

    async def copy(self, workspace_id: UUID, data: CopyCreate, author_id: UUID) -> CopyOut:
        source, rows = await self._structure(data.source_id)
        content_ids: dict[UUID, UUID] = {}
        for piece_id, piece in self._pieces(source, rows).items():
            content_ids[piece_id] = await self._reuse_or_copy(
                piece, data.reuse.get(piece_id), workspace_id, author_id
            )

        placements: list[PlacementOut] = []
        if rows:
            top = rows[0]
            new_top = await self.placements.clone(
                rows,
                workspace_id=workspace_id,
                delta=_week_shift(top.starts_at, data.starts_at)
                if data.starts_at
                else dt.timedelta(),
                parent_id=data.parent_id,
                content_ids=content_ids,
                keep_units=top.workspace_id == workspace_id,
            )
            await self.session.commit()
            placements = await self.placements.open(new_top)
        elif data.starts_at is not None:
            placements = [
                await self.placements.create(
                    workspace_id,
                    PlacementCreate(
                        content_id=content_ids[source.id],
                        parent_id=data.parent_id,
                        starts_at=data.starts_at,
                    ),
                )
            ]
        else:
            await self.session.commit()

        content = await ContentService(self.session).get(
            content_ids[source.id], author_id, include_hidden=True
        )
        return CopyOut(content=content, placements=placements)

    async def _structure(self, source_id: UUID) -> tuple[Content, list[Placement]]:
        source = await self.repo.get_content(source_id)
        if source is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
        top = await self.repo.top_of(source_id)
        rows = _without_hidden(await self.repo.subtree_rows(top.id)) if top else []
        return source, rows

    @staticmethod
    def _pieces(source: Content, rows: Sequence[Placement]) -> dict[UUID, Content]:
        return {source.id: source} | {p.content_id: p.content for p in rows}

    async def _reuse_or_copy(
        self, piece: Content, existing_id: UUID | None, workspace_id: UUID, author_id: UUID
    ) -> UUID:
        if existing_id is None:
            return (await copy_content(self.session, piece, workspace_id, author_id)).id
        existing = await self.repo.get_content(existing_id)
        if (
            existing is None
            or existing.workspace_id != workspace_id
            or existing.level != piece.level
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="reuse must name content of the same level in this workspace",
            )
        return existing.id
