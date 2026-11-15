from __future__ import annotations

import datetime as dt
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.email_templates.renderer import TemplateName
from app.domain.enums import DraftStatus


class WorkspaceInviteRequest(BaseModel):
    email: EmailStr
    message: str | None = Field(None, max_length=1000)


class TemplateInfo(BaseModel):
    name: str
    description: str
    variables: list[str]


class DraftCreate(BaseModel):
    subject: str = Field(..., min_length=1, max_length=200)
    preheader: str | None = Field(None, max_length=200)
    template: TemplateName
    # Newsletter stores blocks as list[dict]; other templates store context as dict[str, Any]
    blocks: list[dict[str, Any]] | dict[str, Any] | None = None
    manual_recipients: list[EmailStr] | None = None
    scheduled_at: dt.datetime | None = None


class DraftUpdate(BaseModel):
    subject: str | None = Field(None, min_length=1, max_length=200)
    preheader: str | None = Field(None, max_length=200)
    template: TemplateName | None = None
    blocks: list[dict[str, Any]] | dict[str, Any] | None = None
    manual_recipients: list[EmailStr] | None = None
    scheduled_at: dt.datetime | None = None


class DraftOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: UUID
    subject: str
    preheader: str | None
    template: str
    blocks: list[dict[str, Any]] | dict[str, Any] | None
    manual_recipients: list[str] | None
    status: DraftStatus
    scheduled_at: dt.datetime | None
    sent_at: dt.datetime | None
    created_by: UUID
    created_at: dt.datetime
    updated_at: dt.datetime | None
