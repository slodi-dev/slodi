from __future__ import annotations

import datetime as dt
from typing import Annotated, Any
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationInfo,
    field_validator,
)
from typing_extensions import Self

from app.domain.content_constraints import (
    DESC_MAX,
    IMG_MAX,
    INSTRUCTIONS_MAX,
    LOCATION_MAX,
    NAME_MAX,
    NAME_MIN,
)
from app.domain.enums import AgeGroup, ContentType, ReviewState
from app.repositories.content import ContentStats
from app.schemas.comment import CommentOut
from app.schemas.tag import TagOut
from app.schemas.user import UserOutLimited
from app.utils import get_current_datetime

from .workspace import WorkspaceNested

NameStr = Annotated[
    str,
    StringConstraints(min_length=NAME_MIN, max_length=NAME_MAX, strip_whitespace=True),
]
DescStr = Annotated[
    str, StringConstraints(min_length=0, max_length=DESC_MAX, strip_whitespace=True)
]
InstructionsStr = Annotated[
    str,
    StringConstraints(min_length=0, max_length=INSTRUCTIONS_MAX, strip_whitespace=True),
]
LocationStr = Annotated[
    str, StringConstraints(min_length=0, max_length=LOCATION_MAX, strip_whitespace=True)
]
ImageStr = Annotated[
    str, StringConstraints(min_length=0, max_length=IMG_MAX, strip_whitespace=True)
]


class ContentBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    description: DescStr | None = None
    equipment: list[str] | None = None
    instructions: InstructionsStr | None = None
    duration_min: int | None = None
    duration_max: int | None = None
    age: list[AgeGroup] | None = None
    location: LocationStr | None = None
    count_min: int | None = None
    count_max: int | None = None
    price: int | None = None
    prep_time_min: int | None = None
    prep_time_max: int | None = None
    image: ImageStr | None = None
    media: dict[str, Any] | None = None
    tag_names: list[str] | None = None

    @field_validator(
        "count_min",
        "count_max",
        "duration_min",
        "duration_max",
        "prep_time_min",
        "prep_time_max",
        "price",
    )
    @classmethod
    def validate_non_negative_ints(cls, v: int | None, info: ValidationInfo) -> int | None:
        if v is not None and v < 0:
            raise ValueError(f"{info.field_name} must be >= 0")
        return v


class ContentCreate(ContentBase):
    """Fields accepted when creating content.

    `author_id` and `created_at` are **server-owned**: every create route
    overwrites whatever the body carried. The default_factory below is for
    internal callers (seeding, copies), not a promise that a client may set it.

    `created_at` matters now that anyone with an account can submit to the bank.
    The review queue is ordered oldest-first, so a backdated item would jump
    ahead of everything a moderator has not yet looked at.
    """

    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    name: NameStr
    author_id: UUID | None = None
    created_at: dt.datetime = Field(default_factory=get_current_datetime)


class ContentUpdate(ContentBase):
    """Fields a PATCH may change.

    Deliberately carries **no `author_id`**. `ContentUpdate` used to inherit it
    from `ContentBase`, and the update services apply the patch with `setattr`
    over `model_dump(exclude_unset=True)` — so a body could hand an item's
    authorship to any other user. That was reachable only by an editor while the
    bank was closed; now that anyone with an account can create and edit their
    own submissions, it would let someone launder a submission, and its strikes,
    onto another leader.
    """

    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    name: NameStr | None = None


class ContentListOut(BaseModel):
    """Content details for list views, without author info or comments."""

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: UUID
    name: NameStr
    # Which kind it is. The bank lists all three now, so a card cannot tell a
    # Verkefni from a Viðburður without being told.
    content_type: ContentType
    author_id: UUID
    author_name: str
    created_at: dt.datetime
    workspace_id: UUID
    workspace: WorkspaceNested
    description: DescStr | None = None
    duration_min: int | None = None
    duration_max: int | None = None
    age: list[AgeGroup] | None = None
    location: LocationStr | None = None
    count_min: int | None = None
    count_max: int | None = None
    price: int | None = None
    prep_time_min: int | None = None
    prep_time_max: int | None = None
    image: ImageStr | None = None
    equipment: list[str] | None = None
    tags: list[TagOut] = []
    comment_count: int = 0
    like_count: int = 0
    liked_by_me: bool = False

    @classmethod
    def from_row(cls, obj: Any, stats: ContentStats) -> Self:
        return cls.model_validate(obj).model_copy(update=vars(stats))


class ContentOut(ContentListOut):
    """Full content details, including author info and comments."""

    author: UserOutLimited
    #: Only ever filled in for the item's own author and for moderators. A
    #: leader needs to know whether their submission was looked at; nobody else
    #: needs to know how the team judged somebody else's idea. The route strips
    #: these rather than the schema, because the schema cannot see who is asking.
    review_state: ReviewState | None = None
    review_note: str | None = None
    #: Set when a moderator has unlisted the item. Carried on the same terms as
    #: the review fields: the author is told their item was hidden, so the item
    #: has to be able to say so, and a stranger is not shown the timestamp of a
    #: decision about somebody else.
    hidden_at: dt.datetime | None = None
    equipment: list[str] | None = None
    instructions: InstructionsStr | None = None
    media: dict[str, Any] | None = None
    comments: list[CommentOut] = []


UserOutLimited.model_rebuild()
TagOut.model_rebuild()
