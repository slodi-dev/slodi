import datetime as dt
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app import models as m
from app import schemas as s
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


def test_task_participants_rules():
    # max < min -> invalid
    with pytest.raises(ValidationError):
        s.TaskCreate(
            content_type=m.ContentType.task,
            name="Knot tying",
            description=None,
            created_at=get_current_datetime(),
            author_id=uuid4(),
            participant_min=5,
            participant_max=4,
        )

    # both zero -> invalid
    with pytest.raises(ValidationError):
        s.TaskCreate(
            content_type=m.ContentType.task,
            name="Game",
            description=None,
            created_at=get_current_datetime(),
            author_id=uuid4(),
            participant_min=0,
            participant_max=0,
        )
