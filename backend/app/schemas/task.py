from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import ConfigDict, field_validator, model_validator

from app.models.content import ContentType

from .content import ContentCreate, ContentOut, ContentUpdate
from .tag import TagOut  # Import for model rebuild
from .user import UserNested  # Import for model rebuild

# Rebuild model to resolve forward references
ContentOut.model_rebuild()


class TaskCreate(ContentCreate):
    content_type: Literal[ContentType.task] = ContentType.task

    equipment: dict[str, Any] | None = None
    media: dict[str, Any] | None = None
    estimated_duration: int | None = None
    participant_min: int | None = None
    participant_max: int | None = None

    @field_validator("estimated_duration")
    @classmethod
    def _non_negative_duration(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("estimated_duration must be >= 0")
        return v

    @field_validator("participant_min")
    @classmethod
    def _non_negative_min(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("participant_min must be >= 0")
        return v

    @field_validator("participant_max")
    @classmethod
    def _positive_max(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("participant_max must be > 0")
        return v

    @model_validator(mode="after")
    def _cross_validate_participants(self) -> TaskCreate:
        min_v = self.participant_min
        max_v = self.participant_max
        if max_v is not None and min_v is not None and max_v < min_v:
            raise ValueError("participant_max must be >= participant_min")
        return self


class TaskUpdate(ContentUpdate):
    event_id: UUID | None = None
    equipment: dict[str, Any] | None = None
    media: dict[str, Any] | None = None
    estimated_duration: int | None = None
    participant_min: int | None = None
    participant_max: int | None = None

    @field_validator("estimated_duration")
    @classmethod
    def _non_negative_duration(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("estimated_duration must be >= 0")
        return v

    @field_validator("participant_min")
    @classmethod
    def _validate_participant_min(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("participant_min must be >= 0")
        return v

    @field_validator("participant_max")
    @classmethod
    def _non_negative_max(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("participant_max must be >= 0")
        return v

    @model_validator(mode="after")
    def _cross_validate_participants(self) -> TaskUpdate:
        min_v = self.participant_min
        max_v = self.participant_max
        if max_v is not None and min_v is not None:
            if max_v < min_v:
                raise ValueError("participant_max must be >= participant_min")
            if max_v == 0 and min_v == 0:
                raise ValueError("participant_max must be > 0 if participant_min is 0")
        return self


class TaskOut(ContentOut):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_id: UUID
    equipment: dict[str, Any] | None = None
    media: dict[str, Any] | None = None
    estimated_duration: int | None = None
    participant_min: int | None = None
    participant_max: int | None = None
