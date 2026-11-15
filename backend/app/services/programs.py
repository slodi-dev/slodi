from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.program import Program
from app.repositories.programs import ProgramRepository
from app.repositories.tags import TagRepository
from app.schemas.content import ContentListOut
from app.schemas.program import ProgramCreate, ProgramFilters, ProgramOut, ProgramUpdate
from app.services.content import requeue_if_author_fixed
from app.services.uploads import AttachmentVerifier


class ProgramService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ProgramRepository(session)

    async def facets_for_workspace(self, workspace_id: UUID) -> dict[str, list[str]]:
        return await self.repo.facets_for_workspace(workspace_id)

    async def count_content_for_workspace(
        self, workspace_id: UUID, filters: ProgramFilters | None = None
    ) -> int:
        return await self.repo.count_content_for_workspace(workspace_id, filters=filters)

    async def list_content_for_workspace(
        self,
        workspace_id: UUID,
        current_user_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
        filters: ProgramFilters | None = None,
    ) -> list[ContentListOut]:
        rows = await self.repo.list_content_by_workspace(
            workspace_id, current_user_id, limit=limit, offset=offset, filters=filters
        )
        return [ContentListOut.from_row(item, stats) for item, stats in rows]

    async def create_under_workspace(self, workspace_id: UUID, data: ProgramCreate) -> ProgramOut:
        await AttachmentVerifier().check_content(data.image, data.media)
        program = Program(workspace_id=workspace_id, **data.model_dump(exclude={"tag_names"}))
        await self.repo.create(program)
        await self.session.flush()
        if data.tag_names:
            await self._set_tags(program.id, data.tag_names)
        await self.session.commit()
        return await self.get(program.id)

    async def get(
        self,
        program_id: UUID,
        current_user_id: UUID | None = None,
        *,
        include_hidden: bool = False,
        include_hidden_children: bool = False,
    ) -> ProgramOut:
        row = await self.repo.get(
            program_id,
            current_user_id,
            include_hidden=include_hidden,
            include_hidden_children=include_hidden_children,
        )
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
        return ProgramOut.from_row(*row)

    async def update(
        self, program_id: UUID, data: ProgramUpdate, current_user_id: UUID | None = None
    ) -> ProgramOut:
        await AttachmentVerifier().check_content(data.image, data.media)
        row = await self.repo.get(program_id, include_hidden=True)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
        prog, _ = row
        for k, v in data.model_dump(exclude_unset=True, exclude={"tag_names"}).items():
            setattr(prog, k, v)
        requeue_if_author_fixed(prog, current_user_id)
        if "tag_names" in data.model_fields_set:
            await self._set_tags(program_id, data.tag_names or [])
        await self.session.commit()
        return await self.get(program_id, current_user_id, include_hidden=True)

    async def delete(self, program_id: UUID) -> None:
        if not await self.repo.get(program_id, include_hidden=True):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
        await self.repo.delete(program_id)
        await self.session.commit()

    async def _set_tags(self, program_id: UUID, tag_names: list[str]) -> None:
        not_found = await TagRepository(self.session).set_content_tags_by_names(
            program_id, tag_names
        )
        if not_found:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown tags: {not_found}",
            )
