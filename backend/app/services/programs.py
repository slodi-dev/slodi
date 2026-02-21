from __future__ import annotations

import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.program import Program
from app.repositories.programs import ProgramRepository
from app.schemas.program import ProgramCreate, ProgramOut, ProgramUpdate

logger = logging.getLogger(__name__)


class ProgramService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ProgramRepository(session)

    async def count_programs_for_workspace(self, workspace_id: UUID) -> int:
        return await self.repo.count_programs_for_workspace(workspace_id)

    async def list_for_workspace(
        self,
        workspace_id: UUID,
        current_user_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[ProgramOut]:
        rows = await self.repo.list_by_workspace(
            workspace_id, current_user_id, limit=limit, offset=offset
        )
        return [ProgramOut.from_row(prog, stats) for prog, stats in rows]

    async def get_in_workspace(
        self, program_id: UUID, workspace_id: UUID, current_user_id: UUID | None = None
    ) -> ProgramOut:
        row = await self.repo.get_in_workspace(program_id, workspace_id, current_user_id)
        if not row:
            logger.error(f"Program {program_id} not found in workspace {workspace_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
        prog, stats = row
        return ProgramOut.from_row(prog, stats)

    async def create_under_workspace(self, workspace_id: UUID, data: ProgramCreate) -> ProgramOut:
        try:
            program = Program(workspace_id=workspace_id, **data.model_dump())
            await self.repo.create(program)
            await self.session.commit()

            fetched = await self.repo.get(program.id)
            if not fetched:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to retrieve created program",
                )
            prog, stats = fetched
            return ProgramOut.from_row(prog, stats)
        except SQLAlchemyError as e:
            logger.error(f"SQLAlchemy error creating program: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create program",
            ) from e
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error creating program: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create program",
            ) from e

    async def get(self, program_id: UUID, current_user_id: UUID | None = None) -> ProgramOut:
        row = await self.repo.get(program_id, current_user_id)
        if not row:
            logger.error(f"Program {program_id} not found")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
        prog, stats = row
        return ProgramOut.from_row(prog, stats)

    async def update(
        self, program_id: UUID, data: ProgramUpdate, current_user_id: UUID | None = None
    ) -> ProgramOut:
        row = await self.repo.get(program_id)
        if not row:
            logger.error(f"Program {program_id} not found")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
        prog, _ = row
        patch = data.model_dump(exclude_unset=True)
        for k, v in patch.items():
            setattr(prog, k, v)
        await self.session.commit()
        updated = await self.repo.get(program_id, current_user_id)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve updated program",
            )
        prog, stats = updated
        return ProgramOut.from_row(prog, stats)

    async def delete(self, program_id: UUID) -> None:
        row = await self.repo.get(program_id)
        if not row:
            logger.error(f"Program {program_id} not found")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
        await self.repo.delete(program_id)
        await self.session.commit()
