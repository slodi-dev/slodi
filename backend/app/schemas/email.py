from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


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
