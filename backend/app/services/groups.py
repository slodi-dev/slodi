from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import Group
from app.repositories.groups import GroupRepository
from app.schemas.group import (
    GroupCreate,
    GroupMemberOut,
    GroupMembershipCreate,
    GroupMembershipOut,
    GroupMembershipUpdate,
    GroupOut,
    GroupUpdate,
)


class GroupService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = GroupRepository(session)

    # ----- groups -----

    async def count(self, *, q: str | None = None) -> int:
        return await self.repo.count(q=q)

    async def list(self, *, q: str | None, limit: int = 50, offset: int = 0) -> list[GroupOut]:
        rows = await self.repo.list(q=q, limit=limit, offset=offset)
        return [GroupOut.model_validate(r) for r in rows]

    async def get(self, group_id: UUID) -> GroupOut:
        row = await self.repo.get(group_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
        return GroupOut.model_validate(row)

    async def create(self, data: GroupCreate) -> GroupOut:
        g = Group(**data.model_dump())
        try:
            await self.repo.create(g)
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            # If you add a unique name constraint later, this becomes relevant
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Group already exists"
            ) from None
        await self.session.refresh(g)
        return GroupOut.model_validate(g)

    async def update(self, group_id: UUID, data: GroupUpdate) -> GroupOut:
        g = await self.repo.get(group_id)
        if not g:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

        patch = data.model_dump(exclude_unset=True)
        for k, v in patch.items():
            setattr(g, k, v)

        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Group update violates constraints",
            ) from None
        await self.session.refresh(g)
        return GroupOut.model_validate(g)

    async def delete(self, group_id: UUID) -> None:
        g = await self.repo.get(group_id)
        if not g:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
        await self.repo.delete(group_id)
        await self.session.commit()

    # ----- memberships -----

    async def count_group_members(self, group_id: UUID) -> int:
        return await self.repo.count_group_members(group_id)

    async def list_group_members(
        self, group_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[GroupMemberOut]:
        # ensure group exists for better UX
        if not await self.repo.get(group_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
        rows = await self.repo.list_group_members(group_id, limit=limit, offset=offset)
        return [GroupMemberOut.model_validate(r) for r in rows]

    async def count_user_groups(self, user_id: UUID) -> int:
        return await self.repo.count_groups_for_user(user_id)

    async def list_user_groups(
        self, user_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[GroupOut]:
        rows = await self.repo.list_groups_for_user(user_id, limit=limit, offset=offset)
        return [GroupOut.model_validate(r) for r in rows]

    async def add_membership(
        self, group_id: UUID, data: GroupMembershipCreate
    ) -> tuple[bool, GroupMembershipOut]:
        try:
            created, gs = await self.repo.add_membership(group_id, data.user_id, data.role)
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            # duplicate composite PK (user already member) or missing FK
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Membership already exists or violates constraints",
            ) from None
        return created, GroupMembershipOut.model_validate(gs)

    async def get_user_membership(self, group_id: UUID, user_id: UUID) -> GroupMembershipOut | None:
        gm = await self.repo.get_membership(group_id, user_id)
        if not gm:
            return None
        return GroupMembershipOut.model_validate(gm)

    async def update_membership(
        self, group_id: UUID, user_id: UUID, data: GroupMembershipUpdate
    ) -> GroupMembershipOut:
        gm = await self.repo.get_membership(group_id, user_id)
        if not gm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found"
            )

        patch = data.model_dump(exclude_unset=True)
        for k, v in patch.items():
            setattr(gm, k, v)

        await self.session.commit()
        await self.session.refresh(gm)
        return GroupMembershipOut.model_validate(gm)

    async def remove_membership(self, group_id: UUID, user_id: UUID) -> None:
        deleted = await self.repo.remove_member(group_id, user_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found"
            )
        await self.session.commit()
