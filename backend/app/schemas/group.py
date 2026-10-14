from __future__ import annotations

from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator

from app.domain.enums import GroupRole
from app.domain.group_constraints import IMG_MAX, NAME_MAX, NAME_MIN
from app.domain.private_network import check_public_url

NameStr = Annotated[
    str,
    StringConstraints(min_length=NAME_MIN, max_length=NAME_MAX, strip_whitespace=True),
]
ImageStr = Annotated[str, StringConstraints(max_length=IMG_MAX, strip_whitespace=True)]


# -------- Group --------


class GroupBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: NameStr
    image: ImageStr | None = None


class _PublicImage(BaseModel):
    """Input-only: no localhost/private-address image (app/domain/private_network.py).

    Not on `GroupBase`, which `GroupOut` shares: a group saved before this
    check must still be readable.
    """

    @field_validator("image", check_fields=False)
    @classmethod
    def validate_public_image(cls, v: str | None) -> str | None:
        return check_public_url(v)


class GroupCreate(GroupBase, _PublicImage):
    pass


class GroupUpdate(_PublicImage):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: NameStr | None = None
    image: ImageStr | None = None


class GroupOut(GroupBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


# -------- GroupMembership --------


class GroupMembershipBase(BaseModel):
    role: GroupRole = GroupRole.viewer


class GroupMembershipCreate(GroupMembershipBase):
    user_id: UUID


class GroupMembershipUpdate(BaseModel):
    role: GroupRole | None = None


class GroupMembershipOut(GroupMembershipBase):
    model_config = ConfigDict(from_attributes=True)
    user_id: UUID
    group_id: UUID


class GroupMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: UUID
    name: str
    role: GroupRole
