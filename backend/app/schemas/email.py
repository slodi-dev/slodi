from __future__ import annotations

import datetime as dt
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class EmailSendRequest(BaseModel):
    recipients: list[EmailStr] = Field(..., min_length=1)
    subject: str = Field(..., min_length=1, max_length=200)
    html: str = Field(..., min_length=1)


class WorkspaceInviteRequest(BaseModel):
    email: EmailStr
    message: str | None = Field(None, max_length=1000)


class BroadcastRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=200)
    html: str = Field(..., min_length=1)


class BroadcastOut(BaseModel):
    recipients_count: int


class TemplateInfo(BaseModel):
    name: str
    description: str
    variables: list[str]


class RenderRequest(BaseModel):
    template: str
    context: dict[str, Any]


# ---------------------------------------------------------------------------
# Draft CRUD schemas
# ---------------------------------------------------------------------------


class DraftCreate(BaseModel):
    subject: str = Field(..., min_length=1, max_length=200)
    preheader: str | None = Field(None, max_length=200)
    template: str = Field(..., min_length=1, max_length=100)
    # Newsletter stores blocks as list[dict]; other templates store context as dict[str, Any]
    blocks: list[dict[str, Any]] | dict[str, Any] | None = None
    recipient_list_id: UUID | None = None
    manual_recipients: list[EmailStr] | None = None
    scheduled_at: dt.datetime | None = None


class DraftUpdate(BaseModel):
    subject: str | None = Field(None, min_length=1, max_length=200)
    preheader: str | None = Field(None, max_length=200)
    template: str | None = Field(None, min_length=1, max_length=100)
    blocks: list[dict[str, Any]] | dict[str, Any] | None = None
    recipient_list_id: UUID | None = None
    manual_recipients: list[EmailStr] | None = None
    scheduled_at: dt.datetime | None = None


class DraftOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    subject: str
    preheader: str | None
    template: str
    blocks: list[dict[str, Any]] | dict[str, Any] | None
    recipient_list_id: UUID | None
    manual_recipients: list[str] | None
    status: str
    scheduled_at: dt.datetime | None
    sent_at: dt.datetime | None
    created_by: UUID
    created_at: dt.datetime
    updated_at: dt.datetime | None
