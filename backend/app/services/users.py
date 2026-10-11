from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import Permissions
from app.models.user import User
from app.repositories.users import UserRepository
from app.schemas.user import UserCreate, UserOut, UserOutLimited, UserUpdateAdmin, UserUpdateSelf


# Platform admin comes only from ADMIN_EMAILS (scripts/seed.py), never through
# the API, so one admin cannot mint another or demote a peer.
def _admin_not_grantable() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Platform admin is granted through ADMIN_EMAILS, not through the API",
    )


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = UserRepository(session)

    async def get_full(self, user_id: UUID) -> UserOut:
        """Return the full user record including auth0_id. Use for admin operations."""
        row = await self.repo.get(user_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return UserOut.model_validate(row)

    async def get(self, user_id: UUID) -> UserOutLimited:
        row = await self.repo.get(user_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return UserOutLimited.model_validate(row)

    async def get_by_auth0_id(self, auth0_id: str) -> UserOut | None:
        """
        Get user by Auth0 ID.

        Args:
            auth0_id: The Auth0 ID (sub claim from JWT token)

        Returns:
            User model instance if found, None otherwise
        """
        user = await self.repo.get_by_auth0_id(auth0_id)
        if user:
            return UserOut.model_validate(user)
        return None

    async def count(self, *, q: str | None) -> int:
        return await self.repo.count(q=q)

    async def list(
        self, *, q: str | None, limit: int = 50, offset: int = 0
    ) -> list[UserOutLimited]:
        rows = await self.repo.list(q=q, limit=limit, offset=offset)
        return [UserOutLimited.model_validate(r) for r in rows]

    async def list_full(
        self, *, q: str | None, limit: int = 50, offset: int = 0
    ) -> Sequence[UserOut]:
        rows = await self.repo.list(q=q, limit=limit, offset=offset)
        return [UserOut.model_validate(r) for r in rows]

    async def create(self, data: UserCreate) -> UserOut:
        if data.permissions == Permissions.admin:
            raise _admin_not_grantable()
        user = User(**data.model_dump())
        try:
            await self.repo.create(user)
            await self.session.commit()
        except IntegrityError as e:
            await self.session.rollback()
            # Email or auth0_id unique violation
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email or auth0_id already exists",
            ) from e
        await self.session.refresh(user)
        return UserOut.model_validate(user)

    async def update(self, user_id: UUID, data: UserUpdateSelf | UserUpdateAdmin) -> UserOut:
        row = await self.repo.get(user_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        patch = data.model_dump(exclude_unset=True)
        new_permissions = patch.get("permissions")
        if (
            new_permissions is not None
            and new_permissions != row.permissions
            and Permissions.admin in (new_permissions, row.permissions)
        ):
            raise _admin_not_grantable()
        for k, v in patch.items():
            setattr(row, k, v)

        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email or auth0_id already exists",
            ) from None
        await self.session.refresh(row)
        return UserOut.model_validate(row)

    async def delete(self, user_id: UUID) -> None:
        row = await self.repo.get(user_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        await self.repo.delete(user_id)
        await self.session.commit()
