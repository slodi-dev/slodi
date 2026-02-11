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

    # workspace-scoped reads
    async def count_programs_for_workspace(self, workspace_id: UUID) -> int:
        return await self.repo.count_programs_for_workspace(workspace_id)

    async def list_for_workspace(
        self, workspace_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[ProgramOut]:
        rows = await self.repo.list_by_workspace(workspace_id, limit=limit, offset=offset)
        return [ProgramOut.model_validate(r) for r in rows]

    async def get_in_workspace(self, program_id: UUID, workspace_id: UUID) -> ProgramOut:
        row = await self.repo.get_in_workspace(program_id, workspace_id)
        if not row:
            logger.error(f"Program {program_id} not found in workspace {workspace_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
        return ProgramOut.model_validate(row)

    # create under a workspace
    async def create_under_workspace(self, workspace_id: UUID, data: ProgramCreate) -> ProgramOut:
        try:
            # Create a new Program instance with the provided workspace_id and data
            program = Program(workspace_id=workspace_id, **data.model_dump())

            # Save the new program to the database using the repository
            await self.repo.create(program)

            # Commit the transaction to persist the changes
            await self.session.commit()

            # Retrieve the newly created program using the repository's get() method
            # This ensures proper eager loading of related data
            program = await self.repo.get(program.id)

            if not program:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to retrieve created program",
                )

            # Return the created program as a ProgramOut schema
            return ProgramOut.model_validate(program)
        except SQLAlchemyError as e:
            logger.error(f"SQLAlchemy error creating program: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create program",
            )
        except Exception as e:
            logger.error(f"Unexpected error creating program: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create program",
            )

    # item-level operations (not scoped)
    async def get(self, program_id: UUID) -> ProgramOut:
        row = await self.repo.get(program_id)
        if not row:
            logger.error(f"Program {program_id} not found")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
        return ProgramOut.model_validate(row)

    async def update(self, program_id: UUID, data: ProgramUpdate) -> ProgramOut:
        row = await self.repo.get(program_id)
        if not row:
            logger.error(f"Program {program_id} not found")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
        patch = data.model_dump(exclude_unset=True)
        for k, v in patch.items():
            setattr(row, k, v)
        await self.session.commit()
        await self.session.refresh(row)
        return ProgramOut.model_validate(row)

    async def delete(self, program_id: UUID) -> None:
        row = await self.repo.get(program_id)
        if not row:
            logger.error(f"Program {program_id} not found")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
        await self.repo.delete(program_id)
        await self.session.commit()
