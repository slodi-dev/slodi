import datetime as dt
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app import models as m
from app import schemas as s
from app.domain import comment_constraints as cmc
from app.domain import content_constraints as cc
from app.domain import tag_constraints as tc
from app.domain import workspace_constraints as wc
from app.utils import get_current_datetime


def test_user_email_normalized_and_len():
    u = s.UserCreate(
        name="Jane",
        auth0_id="auth0|abc",
        email="FooBar@Example.COM",
        preferences=None,
        pronouns=None,
    )
    assert u.email == "foobar@example.com"

    # 321 chars local-part + "@a" should fail if >320
    long_email = ("a" * 321) + "@a"
    with pytest.raises(ValidationError):
        s.UserCreate(name="x", auth0_id="y", email=long_email, preferences=None, pronouns=None)


def test_workspace_defaults_in_schema():
    w = s.WorkspaceCreate(name="Pack 1", group_id=None, settings=None)
    assert w.default_interval is not None
    assert w.default_meeting_weekday is not None
    assert isinstance(w.default_start_time, dt.time)
    assert isinstance(w.season_start, dt.date)


def test_event_time_is_tz_aware():
    # naive -> invalid
    with pytest.raises(ValidationError):
        s.EventCreate(
            name="Camp",
            description=None,
            created_at=get_current_datetime(),
            author_id=uuid4(),
            content_type=m.ContentType.event,
            start_dt=dt.datetime(2025, 1, 1, 10, 0),  # naive
        )


# ── Content field constraints ─────────────────────────────────────────────────


def test_content_name_too_short():
    """Empty name is rejected."""
    with pytest.raises(ValidationError):
        s.ProgramCreate(name="", content_type=m.ContentType.program)


def test_content_name_too_long():
    """Name exceeding NAME_MAX is rejected."""
    with pytest.raises(ValidationError):
        s.ProgramCreate(name="x" * (cc.NAME_MAX + 1), content_type=m.ContentType.program)


def test_content_name_at_max_is_valid():
    p = s.ProgramCreate(name="x" * cc.NAME_MAX, content_type=m.ContentType.program)
    assert len(p.name) == cc.NAME_MAX


def test_content_description_too_long():
    """Description exceeding DESC_MAX is rejected."""
    with pytest.raises(ValidationError):
        s.ProgramCreate(
            name="Valid",
            description="x" * (cc.DESC_MAX + 1),
            content_type=m.ContentType.program,
        )


def test_content_negative_duration_rejected():
    """Negative duration_min is rejected."""
    with pytest.raises(ValidationError):
        s.ProgramCreate(name="Valid", content_type=m.ContentType.program, duration_min=-1)


def test_content_negative_price_rejected():
    with pytest.raises(ValidationError):
        s.ProgramCreate(name="Valid", content_type=m.ContentType.program, price=-1)


# ── Tag constraints ───────────────────────────────────────────────────────────


def test_tag_name_too_long():
    """Tag name exceeding NAME_MAX is rejected."""
    with pytest.raises(ValidationError):
        s.TagCreate(name="x" * (tc.NAME_MAX + 1))


def test_tag_name_empty_rejected():
    with pytest.raises(ValidationError):
        s.TagCreate(name="")


def test_tag_name_at_max_is_valid():
    tag = s.TagCreate(name="x" * tc.NAME_MAX)
    assert len(tag.name) == tc.NAME_MAX


# ── Comment constraints ───────────────────────────────────────────────────────


def test_comment_body_empty_rejected():
    """Empty comment body is rejected."""
    with pytest.raises(ValidationError):
        s.CommentCreate(body="", user_id=uuid4())


def test_comment_body_too_long():
    """Comment body exceeding BODY_MAX is rejected."""
    with pytest.raises(ValidationError):
        s.CommentCreate(body="x" * (cmc.BODY_MAX + 1), user_id=uuid4())


# ── Workspace constraints ─────────────────────────────────────────────────────


def test_workspace_name_too_long():
    """Workspace name exceeding NAME_MAX is rejected."""
    with pytest.raises(ValidationError):
        s.WorkspaceCreate(name="x" * (wc.NAME_MAX + 1), group_id=None, settings=None)


def test_workspace_name_empty_rejected():
    with pytest.raises(ValidationError):
        s.WorkspaceCreate(name="", group_id=None, settings=None)
