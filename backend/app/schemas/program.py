from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.domain.program_constraints import IMG_MAX
from app.models.content import ContentType

from .content import ContentCreate, ContentOut, ContentUpdate, DescStr, NameStr
from .tag import TagOut  # Import for model rebuild
from .user import UserNested  # Import for model rebuild
from .workspace import WorkspaceNested  # Import for nested workspace

# Rebuild model to resolve forward references
ContentOut.model_rebuild()

ImageStr = Annotated[
    str, StringConstraints(min_length=0, max_length=IMG_MAX, strip_whitespace=True)
]


class ProgramCreateRequest(BaseModel):
    """API request schema for creating a program - excludes author_id (injected by backend)"""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: NameStr
    description: DescStr | None = None
    content_type: Literal[ContentType.program] = ContentType.program
    image: ImageStr | None = None


class ProgramCreate(ContentCreate):
    """Internal schema for creating a program - includes author_id"""

    content_type: Literal[ContentType.program] = ContentType.program
    image: ImageStr | None = None


class ProgramUpdate(ContentUpdate):
    workspace_id: UUID | None = None
    image: ImageStr | None = None


class ProgramOut(ContentOut):
    model_config = ConfigDict(from_attributes=True)

    image: ImageStr | None = None
    workspace_id: UUID
    workspace: WorkspaceNested
