"""Reporting content that does not belong.

Once anyone with an account can submit to the bank, anyone with an account needs
to be able to flag. These pin the two things that make the number a reviewer
reads mean something — one report per person per item — and the one report that
does not wait for the next sweep.
"""

import datetime as dt
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app import models as m
from app.core.auth import get_current_user
from app.core.db import get_session
from app.domain.enums import ReportReason, ReportStatus
from app.main import create_app
from app.schemas.content_report import ContentReportOut
from app.schemas.workspace import WorkspaceRole
from app.utils import get_current_datetime

ROLE_LOOKUP = "app.core.auth._get_workspace_role"
WS_LOOKUP = "app.services.content.ContentService.get_workspace_id"
NAME_LOOKUP = "app.services.content.ContentService.get_name"


def _client(user):
    app = create_app()

    async def override_get_current_user():
        return user

    app.dependency_overrides[get_session] = lambda: None
    app.dependency_overrides[get_current_user] = override_get_current_user
    return app


@pytest.fixture
def member_client(mock_db_session, viewer_user):
    app = _client(viewer_user)

    async def override_get_session():
        yield mock_db_session

    app.dependency_overrides[get_session] = override_get_session
    return TestClient(app)


@pytest.fixture
def admin_client(mock_db_session, admin_user):
    app = _client(admin_user)

    async def override_get_session():
        yield mock_db_session

    app.dependency_overrides[get_session] = override_get_session
    return TestClient(app)


def _report(content_id, reporter_id, reason=ReportReason.inappropriate, **kw):
    return ContentReportOut(
        id=uuid4(),
        content_id=content_id,
        reporter_id=reporter_id,
        reason=reason,
        status=ReportStatus.open,
        created_at=get_current_datetime(),
        **kw,
    )


# ── Filing one ───────────────────────────────────────────────────────────────


def test_any_member_can_report(member_client, viewer_user):
    content_id = uuid4()
    with (
        patch(WS_LOOKUP, new_callable=AsyncMock) as ws,
        patch(ROLE_LOOKUP, new_callable=AsyncMock) as role,
        patch(NAME_LOOKUP, new_callable=AsyncMock) as name,
        patch(
            "app.services.content_reports.ContentReportService.report", new_callable=AsyncMock
        ) as report,
    ):
        ws.return_value = uuid4()
        role.return_value = WorkspaceRole.viewer
        name.return_value = "Kveikjuleikur"
        report.return_value = _report(content_id, viewer_user.id)
        response = member_client.post(
            f"/content/{content_id}/reports", json={"reason": "inappropriate"}
        )

    assert response.status_code == status.HTTP_201_CREATED


def test_reporting_content_you_cannot_reach_is_hidden(member_client):
    """The workspace check runs before anything else, so a report cannot be used
    to probe for content in a workspace the reporter is not in."""
    with (
        patch(WS_LOOKUP, new_callable=AsyncMock) as ws,
        patch(ROLE_LOOKUP, new_callable=AsyncMock) as role,
    ):
        ws.return_value = uuid4()
        role.return_value = None
        response = member_client.post(f"/content/{uuid4()}/reports", json={"reason": "spam"})

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_the_note_is_optional():
    """Requiring a reason *and* a paragraph is how a report does not get filed at
    all — and an unfiled report tells the team nothing."""
    from app.schemas.content_report import ContentReportCreate

    assert ContentReportCreate(reason=ReportReason.spam).note is None


# ── Closing one ──────────────────────────────────────────────────────────────


def test_only_a_moderator_sees_the_queue(member_client):
    response = member_client.get("/moderation/reports")
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_only_a_moderator_can_close_a_report(member_client):
    response = member_client.patch(f"/moderation/reports/{uuid4()}", json={"status": "dismissed"})
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_a_report_cannot_be_closed_as_open(admin_client):
    """ "Closing" a report by setting it back to open would leave `resolved_at`
    null against a non-open status, which the table forbids anyway."""
    with patch(
        "app.repositories.content_reports.ContentReportRepository.get", new_callable=AsyncMock
    ) as get:
        response = admin_client.patch(f"/moderation/reports/{uuid4()}", json={"status": "open"})

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    # Rejected before the lookup — a nonsensical request does not deserve a
    # database round trip.
    get.assert_not_awaited()


# ── The database guarantees ──────────────────────────────────────────────────


async def _content(db):
    user = m.User(name="Foringi", auth0_id="auth0|r", email="r@test.is")
    ws = m.Workspace(
        name="Bankinn",
        default_meeting_weekday=m.Weekday.monday,
        default_start_time=dt.time(17, 0),
        default_end_time=dt.time(18, 30),
        default_interval=m.EventInterval.weekly,
        season_start=dt.date(2026, 9, 1),
    )
    db.add_all([user, ws])
    await db.flush()
    task = m.Task(
        name="Kveikjuleikur",
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=ws.id,
    )
    db.add(task)
    await db.flush()
    return user, task


@pytest.mark.integration
@pytest.mark.asyncio
async def test_one_report_per_person_per_item(db):
    """Without this a single account can stack a queue against an item it
    dislikes, and "how many people flagged this" quietly becomes "how determined
    was one person"."""
    user, task = await _content(db)
    for _ in range(2):
        db.add(
            m.ContentReport(
                content_id=task.id,
                reporter_id=user.id,
                reason=ReportReason.spam,
                status=ReportStatus.open,
                created_at=get_current_datetime(),
            )
        )
    with pytest.raises(IntegrityError, match="uq_content_reports_content_reporter"):
        await db.flush()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_closed_report_must_say_when_it_was_closed(db):
    user, task = await _content(db)
    db.add(
        m.ContentReport(
            content_id=task.id,
            reporter_id=user.id,
            reason=ReportReason.spam,
            status=ReportStatus.resolved,
            created_at=get_current_datetime(),
        )
    )
    with pytest.raises(IntegrityError, match="ck_content_reports_closed_has_timestamp"):
        await db.flush()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_unsafe_is_pinned_above_everything_else(db):
    """`unsafe` is pinned in the query rather than in the board, so the ordering
    survives paging — an escalation on page two is an escalation nobody sees."""
    from app.repositories.content_reports import ContentReportRepository

    user, task = await _content(db)
    other = m.User(name="Annar", auth0_id="auth0|r2", email="r2@test.is")
    db.add(other)
    await db.flush()

    older_unsafe = m.ContentReport(
        content_id=task.id,
        reporter_id=user.id,
        reason=ReportReason.unsafe,
        status=ReportStatus.open,
        created_at=get_current_datetime() - dt.timedelta(days=3),
    )
    newer_spam = m.ContentReport(
        content_id=task.id,
        reporter_id=other.id,
        reason=ReportReason.spam,
        status=ReportStatus.open,
        created_at=get_current_datetime(),
    )
    db.add_all([older_unsafe, newer_spam])
    await db.flush()

    queue = await ContentReportRepository(db).list_open(limit=10, offset=0)
    # Newer by three days, but unsafe still comes first.
    assert [r.reason for r in queue] == [ReportReason.unsafe, ReportReason.spam]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_reporting_twice_returns_the_first_report_rather_than_failing(db):
    """Idempotent, not an error. The person has already said this; a 409 would
    read as "your report failed" and invite them to try again."""
    from fastapi import BackgroundTasks

    from app.schemas.content_report import ContentReportCreate
    from app.services.content_reports import ContentReportService

    user, task = await _content(db)
    svc = ContentReportService(db)
    payload = ContentReportCreate(reason=ReportReason.spam, note="Þetta er auglýsing")

    first = await svc.report(task.id, user.id, payload, BackgroundTasks(), "Kveikjuleikur")
    second = await svc.report(
        task.id,
        user.id,
        ContentReportCreate(reason=ReportReason.other),
        BackgroundTasks(),
        "Kveikjuleikur",
    )

    assert second.id == first.id
    # The first reason stands — a second filing does not silently rewrite it.
    assert second.reason == ReportReason.spam


@pytest.mark.integration
@pytest.mark.asyncio
async def test_an_unsafe_report_is_emailed_not_just_queued(db):
    """Everything else waits for the next sweep of the board. This one does not:
    it is the safeguarding case, and a weekly queue is not a response time."""
    from fastapi import BackgroundTasks

    user, task = await _content(db)
    tasks = BackgroundTasks()

    # A pydantic property cannot be patched in place, so swap the object.
    with patch("app.services.content_reports.settings") as cfg:
        cfg.moderation_email_list = ["dagskra@slodi.is"]
        await svc_report(db, task, user, ReportReason.unsafe, tasks)
    assert len(tasks.tasks) == 1, "an unsafe report should queue an escalation email"

    # A quality judgement does not page anyone.
    other = m.User(name="Annar", auth0_id="auth0|r3", email="r3@test.is")
    db.add(other)
    await db.flush()
    quiet = BackgroundTasks()
    await svc_report(db, task, other, ReportReason.inappropriate, quiet)
    assert quiet.tasks == []


async def svc_report(db, task, user, reason, tasks):
    from app.schemas.content_report import ContentReportCreate
    from app.services.content_reports import ContentReportService

    return await ContentReportService(db).report(
        task.id, user.id, ContentReportCreate(reason=reason), tasks, "Kveikjuleikur"
    )


@pytest.mark.integration
@pytest.mark.asyncio
async def test_the_board_says_what_a_report_is_about(db):
    """A complaint with no subject makes a reviewer open every single row to
    find out what it refers to — the exact cost the board exists to remove."""
    from app.services.content_reports import ContentReportService

    user, task = await _content(db)
    db.add(
        m.ContentReport(
            content_id=task.id,
            reporter_id=user.id,
            reason=ReportReason.unsafe,
            status=ReportStatus.open,
            created_at=get_current_datetime(),
        )
    )
    await db.flush()

    queue = await ContentReportService(db).list_open(limit=10, offset=0)
    assert queue[0].content_name == "Kveikjuleikur"
    assert queue[0].content_author_name == "Foringi"
