"""Yfirferð — the review board for Dagskrárstjórnarteymið.

The bank publishes on submit and reviews afterwards, so the thing these tests
guard hardest is that **review state and visibility stay separate**. Fusing them
would make approval the only route to being visible, which turns a three-person
queue into a bottleneck on every submission.
"""

import datetime as dt
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import select

from app import models as m
from app.core.auth import _PERMISSION_RANK, get_current_user
from app.core.db import get_session
from app.domain.enums import Permissions, ReportStatus, ReviewState
from app.main import create_app
from app.schemas.moderation import HideDecision, ReviewDecision, ReviewFilters
from app.schemas.user import UserOut
from app.services.moderation import ModerationService
from app.utils import get_current_datetime

UNREVIEWED = ReviewFilters(review_state=ReviewState.unreviewed)


def _user(permissions):
    return UserOut(
        id=uuid4(),
        auth0_id=f"auth0|{permissions}",
        email=f"{permissions}@test.is",
        name=permissions.value.title(),
        permissions=permissions,
    )


def _client(mock_db_session, user):
    app = create_app()

    async def override_get_session():
        yield mock_db_session

    async def override_get_current_user():
        return user

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)


# ── The permission rank ──────────────────────────────────────────────────────


def test_moderator_sits_between_member_and_admin():
    """The rank is what lets an admin pass every moderator gate without a second
    check, and stops a member reaching the board."""
    assert (
        _PERMISSION_RANK[Permissions.member]
        < _PERMISSION_RANK[Permissions.moderator]
        < _PERMISSION_RANK[Permissions.admin]
    )


@pytest.mark.parametrize(
    "permissions,expected",
    [
        (Permissions.viewer, status.HTTP_403_FORBIDDEN),
        (Permissions.member, status.HTTP_403_FORBIDDEN),
        (Permissions.moderator, status.HTTP_200_OK),
        (Permissions.admin, status.HTTP_200_OK),
    ],
)
def test_who_can_open_the_board(mock_db_session, permissions, expected):
    client = _client(mock_db_session, _user(permissions))
    with (
        patch("app.services.moderation.ModerationService.queue", new_callable=AsyncMock) as q,
        patch("app.services.moderation.ModerationService.count", new_callable=AsyncMock) as n,
        patch(
            "app.services.moderation.ModerationService.count_unreviewed", new_callable=AsyncMock
        ) as c,
    ):
        q.return_value = []
        n.return_value = 0
        c.return_value = 0
        assert client.get("/moderation/queue").status_code == expected


# ── Decisions ────────────────────────────────────────────────────────────────


def test_a_rejection_must_say_why():
    """An author cannot fix what they are not told about; they either give up or
    resubmit the same thing."""
    with pytest.raises(ValueError, match="af hverju"):
        ReviewDecision(review_state=ReviewState.rejected)


def test_a_rejection_with_a_reason_is_fine():
    assert ReviewDecision(review_state=ReviewState.rejected, note="Of hættulegt").note


def test_approving_needs_no_note():
    assert ReviewDecision(review_state=ReviewState.approved).note is None


def test_a_decision_can_be_put_back_to_unreviewed():
    """That is how undo works. A keyboard sweep at one key per item will mis-key
    sooner or later, and without a way back the only remedy is remembering what
    the previous state was."""
    assert ReviewDecision(review_state=ReviewState.unreviewed).review_state == (
        ReviewState.unreviewed
    )


# ── The database behaviour ───────────────────────────────────────────────────


async def _bank(db, author=None):
    author = author or m.User(name="Foringi", auth0_id=f"auth0|{uuid4()}", email=f"{uuid4()}@t.is")
    ws = m.Workspace(
        name="Bankinn",
        default_meeting_weekday=m.Weekday.monday,
        default_start_time=dt.time(17, 0),
        default_end_time=dt.time(18, 30),
        default_interval=m.EventInterval.weekly,
        season_start=dt.date(2026, 9, 1),
    )
    db.add_all([author, ws])
    await db.flush()
    task = m.Task(
        name="Kveikjuleikur",
        created_at=get_current_datetime(),
        author_id=author.id,
        workspace_id=ws.id,
    )
    db.add(task)
    await db.flush()
    return author, ws, task


@pytest.mark.integration
@pytest.mark.asyncio
async def test_new_content_is_unreviewed_and_visible(db):
    """Publish now, review after. An unreviewed item is live."""
    _, _, task = await _bank(db)
    assert task.review_state is ReviewState.unreviewed
    assert task.hidden_at is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_rejecting_does_not_hide(db):
    """Rejecting says "we looked and this is not right". Hiding says "and it
    should not be in the bank" — a stronger claim, and not always the right one."""
    _, _, task = await _bank(db)
    reviewer = m.User(name="Yfirferð", auth0_id="auth0|mod", email="mod@t.is")
    db.add(reviewer)
    await db.flush()

    result = await ModerationService(db).review(
        task.id, reviewer.id, ReviewDecision(review_state=ReviewState.rejected, note="Of hættulegt")
    )

    assert result.review_state == ReviewState.rejected
    assert result.hidden_at is None
    assert result.review_note == "Of hættulegt"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_hiding_also_counts_as_having_looked(db):
    """Otherwise it stays in the queue for someone else to look at and hide again."""
    _, _, task = await _bank(db)
    reviewer = m.User(name="Yfirferð", auth0_id="auth0|mod2", email="mod2@t.is")
    db.add(reviewer)
    await db.flush()

    result = await ModerationService(db).set_hidden(
        task.id, reviewer.id, HideDecision(hidden=True, note="Ekki við hæfi")
    )

    assert result.hidden_at is not None
    assert result.review_state == ReviewState.rejected


@pytest.mark.integration
@pytest.mark.asyncio
async def test_the_queue_is_oldest_first(db):
    """A backlog, not a feed. Newest-first lets old submissions sink forever
    under a trickle of new ones."""
    author, ws, first = await _bank(db)
    older = m.Task(
        name="Eldra",
        created_at=get_current_datetime() - dt.timedelta(days=10),
        author_id=author.id,
        workspace_id=ws.id,
    )
    db.add(older)
    await db.flush()

    queue = await ModerationService(db).queue(UNREVIEWED, limit=10, offset=0)
    names = [i.name for i in queue]
    assert names.index("Eldra") < names.index("Kveikjuleikur")


@pytest.mark.integration
@pytest.mark.asyncio
async def test_the_queue_shows_how_many_people_flagged_an_item(db):
    author, _, task = await _bank(db)
    other = m.User(name="Annar", auth0_id="auth0|rep", email="rep@t.is")
    db.add(other)
    await db.flush()
    for reporter in (author, other):
        db.add(
            m.ContentReport(
                content_id=task.id,
                reporter_id=reporter.id,
                reason=m.ContentReport.__table__.c.reason.type.enum_class.spam,
                status=ReportStatus.open,
                created_at=get_current_datetime(),
            )
        )
    await db.flush()

    item = next(i for i in await ModerationService(db).queue(UNREVIEWED, 10, 0) if i.id == task.id)
    assert item.open_report_count == 2


@pytest.mark.integration
@pytest.mark.asyncio
async def test_un_hiding_takes_the_strike_with_it(db):
    """Strikes are derived, never a stored counter. A moderator who changes their
    mind must see the number change too — an integer column would drift."""
    author, _, task = await _bank(db)
    reviewer = m.User(name="Yfirferð", auth0_id="auth0|mod3", email="mod3@t.is")
    db.add(reviewer)
    await db.flush()
    svc = ModerationService(db)

    assert await svc.strikes_for_author(author.id) == 0

    await svc.set_hidden(task.id, reviewer.id, HideDecision(hidden=True))
    assert await svc.strikes_for_author(author.id) == 1

    await svc.set_hidden(task.id, reviewer.id, HideDecision(hidden=False))
    # The rejection from hiding still stands, so the strike stands with it —
    # un-hiding is not the same as un-rejecting.
    reloaded = await db.scalar(select(m.Content).where(m.Content.id == task.id))
    assert reloaded.hidden_at is None
    assert reloaded.review_state is ReviewState.rejected


@pytest.mark.integration
@pytest.mark.asyncio
async def test_the_queue_says_why_something_was_flagged(db):
    """A count alone sends the reviewer to another tab for every flagged row,
    which is where a fifty-item sweep loses its afternoon."""
    from app.domain.enums import ReportReason

    author, _, task = await _bank(db)
    other = m.User(name="Annar", auth0_id="auth0|why", email="why@t.is")
    db.add(other)
    await db.flush()
    db.add_all(
        [
            m.ContentReport(
                content_id=task.id,
                reporter_id=author.id,
                reason=ReportReason.unsafe,
                status=ReportStatus.open,
                created_at=get_current_datetime(),
            ),
            m.ContentReport(
                content_id=task.id,
                reporter_id=other.id,
                reason=ReportReason.spam,
                status=ReportStatus.open,
                created_at=get_current_datetime(),
            ),
        ]
    )
    await db.flush()

    item = next(i for i in await ModerationService(db).queue(UNREVIEWED, 10, 0) if i.id == task.id)
    assert set(item.open_report_reasons) == {ReportReason.unsafe, ReportReason.spam}


@pytest.mark.integration
@pytest.mark.asyncio
async def test_the_queue_shows_an_authors_history_in_place(db):
    """A first-time contributor and a repeat one should not look identical."""
    author, ws, task = await _bank(db)
    already_hidden = m.Task(
        name="Falið áður",
        created_at=get_current_datetime(),
        author_id=author.id,
        workspace_id=ws.id,
        hidden_at=get_current_datetime(),
    )
    db.add(already_hidden)
    await db.flush()

    item = next(i for i in await ModerationService(db).queue(UNREVIEWED, 10, 0) if i.id == task.id)
    assert item.author_strikes == 1


# ── Filtering and the record of what was done ────────────────────────────────


@pytest.mark.integration
@pytest.mark.asyncio
async def test_the_board_records_who_decided_and_when(db):
    """Without a name a decision has no author, and "who approved this?" is a
    question only the database can answer."""
    _, _, task = await _bank(db)
    reviewer = m.User(name="Signý", auth0_id="auth0|sig", email="sig@t.is")
    db.add(reviewer)
    await db.flush()
    svc = ModerationService(db)

    await svc.review(task.id, reviewer.id, ReviewDecision(review_state=ReviewState.approved))

    approved = await svc.queue(ReviewFilters(review_state=ReviewState.approved), limit=10, offset=0)
    row = next(i for i in approved if i.id == task.id)
    assert row.reviewed_by_name == "Signý"
    assert row.reviewed_at is not None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_filtering_by_state_separates_the_queue_from_the_record(db):
    author, ws, unreviewed = await _bank(db)
    reviewer = m.User(name="Yfirferð", auth0_id="auth0|f", email="f@t.is")
    approved_item = m.Task(
        name="Samþykkt",
        created_at=get_current_datetime(),
        author_id=author.id,
        workspace_id=ws.id,
    )
    db.add_all([reviewer, approved_item])
    await db.flush()
    svc = ModerationService(db)
    await svc.review(
        approved_item.id, reviewer.id, ReviewDecision(review_state=ReviewState.approved)
    )

    queue = await svc.queue(UNREVIEWED, 10, 0)
    record = await svc.queue(ReviewFilters(review_state=ReviewState.approved), 10, 0)

    assert unreviewed.id in [i.id for i in queue]
    assert approved_item.id not in [i.id for i in queue]
    assert approved_item.id in [i.id for i in record]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_searching_by_name(db):
    author, ws, _ = await _bank(db)
    db.add(
        m.Task(
            name="Ratleikur",
            created_at=get_current_datetime(),
            author_id=author.id,
            workspace_id=ws.id,
        )
    )
    await db.flush()

    found = await ModerationService(db).queue(
        ReviewFilters(review_state=ReviewState.unreviewed, search="ratl"), 10, 0
    )
    assert [i.name for i in found] == ["Ratleikur"]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_filtering_to_only_what_someone_objected_to(db):
    author, ws, flagged = await _bank(db)
    quiet = m.Task(
        name="Enginn kvartaði",
        created_at=get_current_datetime(),
        author_id=author.id,
        workspace_id=ws.id,
    )
    db.add(quiet)
    await db.flush()
    db.add(
        m.ContentReport(
            content_id=flagged.id,
            reporter_id=author.id,
            reason=m.ContentReport.__table__.c.reason.type.enum_class.spam,
            status=ReportStatus.open,
            created_at=get_current_datetime(),
        )
    )
    await db.flush()

    only_reported = await ModerationService(db).queue(
        ReviewFilters(review_state=ReviewState.unreviewed, reported=True), 10, 0
    )
    assert [i.id for i in only_reported] == [flagged.id]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_the_detail_pane_carries_the_objections_themselves(db):
    """Otherwise judging a flagged item means holding two screens open at once."""
    author, _, task = await _bank(db)
    db.add(
        m.ContentReport(
            content_id=task.id,
            reporter_id=author.id,
            reason=m.ContentReport.__table__.c.reason.type.enum_class.unsafe,
            note="Of hættulegt fyrir dreka",
            status=ReportStatus.open,
            created_at=get_current_datetime(),
        )
    )
    await db.flush()

    detail = await ModerationService(db).detail(task.id)
    assert [r.note for r in detail.reports] == ["Of hættulegt fyrir dreka"]
    assert detail.open_report_count == 1


@pytest.mark.parametrize(
    "value,expected",
    [
        ("unreviewed", status.HTTP_200_OK),
        ("approved", status.HTTP_200_OK),
        ("all", status.HTTP_200_OK),
        ("", status.HTTP_422_UNPROCESSABLE_CONTENT),
        ("banana", status.HTTP_422_UNPROCESSABLE_CONTENT),
    ],
)
def test_the_audit_view_is_asked_for_by_name(mock_db_session, value, expected):
    """`review_state=all`, not an empty value.

    An empty `review_state=` in a URL is ambiguous between "every state" and
    "the caller forgot", and FastAPI cannot coerce it into the enum anyway — it
    answered 422, which is how the Allt filter shipped broken.
    """
    client = _client(mock_db_session, _user(Permissions.moderator))
    with (
        patch("app.services.moderation.ModerationService.queue", new_callable=AsyncMock) as q,
        patch("app.services.moderation.ModerationService.count", new_callable=AsyncMock) as n,
        patch(
            "app.services.moderation.ModerationService.count_unreviewed", new_callable=AsyncMock
        ) as c,
    ):
        q.return_value = []
        n.return_value = 0
        c.return_value = 0
        response = client.get(f"/moderation/queue?review_state={value}")

    assert response.status_code == expected


def test_all_means_no_state_filter_at_all(mock_db_session):
    client = _client(mock_db_session, _user(Permissions.moderator))
    with (
        patch("app.services.moderation.ModerationService.queue", new_callable=AsyncMock) as q,
        patch("app.services.moderation.ModerationService.count", new_callable=AsyncMock) as n,
        patch(
            "app.services.moderation.ModerationService.count_unreviewed", new_callable=AsyncMock
        ) as c,
    ):
        q.return_value = []
        n.return_value = 0
        c.return_value = 0
        client.get("/moderation/queue?review_state=all")

    assert q.await_args.args[0].review_state is None


def test_pagination_headers_are_readable_by_a_browser(mock_db_session):
    """They are not on the CORS safelist, so a cross-origin caller cannot read
    them unless they are named in `expose_headers`. The board's "load more"
    depends on the total, and without this it silently sees nothing."""
    from app.main import create_app as _create

    app = _create()
    cors = next(m for m in app.user_middleware if "CORS" in str(m))
    exposed = cors.kwargs.get("expose_headers", [])
    assert "X-Total-Count" in exposed
