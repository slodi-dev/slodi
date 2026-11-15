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
from fastapi import BackgroundTasks, status
from fastapi.testclient import TestClient

from app import models as m
from app.core.auth import _PERMISSION_RANK, get_current_user
from app.core.db import get_session
from app.domain.enums import Permissions, ReportStatus, ReviewState
from app.main import create_app
from app.schemas.moderation import ReviewDecision, ReviewFilters
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


def test_sending_back_must_say_why():
    with pytest.raises(ValueError, match="af hverju"):
        ReviewDecision(review_state=ReviewState.needs_changes)


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
async def test_rejecting_hides(db):
    _, _, task = await _bank(db)
    reviewer = m.User(name="Yfirferð", auth0_id="auth0|mod", email="mod@t.is")
    db.add(reviewer)
    await db.flush()

    result = await ModerationService(db).review(
        task.id,
        reviewer.id,
        ReviewDecision(review_state=ReviewState.rejected, note="Of hættulegt"),
        BackgroundTasks(),
    )

    assert result.review_state == ReviewState.rejected
    assert result.hidden_at is not None
    assert result.review_note == "Of hættulegt"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_sending_back_hides_and_approving_restores(db):
    _, _, task = await _bank(db)
    reviewer = m.User(name="Yfirferð", auth0_id="auth0|mod2", email="mod2@t.is")
    db.add(reviewer)
    await db.flush()
    svc = ModerationService(db)

    sent_back = await svc.review(
        task.id,
        reviewer.id,
        ReviewDecision(review_state=ReviewState.needs_changes, note="Vantar leiðbeiningar"),
        BackgroundTasks(),
    )
    assert sent_back.hidden_at is not None

    approved = await svc.review(
        task.id, reviewer.id, ReviewDecision(review_state="approved"), BackgroundTasks()
    )
    assert approved.hidden_at is None
    assert approved.review_state == ReviewState.approved


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
async def test_only_a_rejection_is_a_strike(db):
    author, _, task = await _bank(db)
    reviewer = m.User(name="Yfirferð", auth0_id="auth0|mod3", email="mod3@t.is")
    db.add(reviewer)
    await db.flush()
    svc = ModerationService(db)

    assert await svc.strikes_for_author(author.id) == 0

    await svc.review(
        task.id,
        reviewer.id,
        ReviewDecision(review_state=ReviewState.needs_changes, note="Laga"),
        BackgroundTasks(),
    )
    assert await svc.strikes_for_author(author.id) == 0

    await svc.review(
        task.id,
        reviewer.id,
        ReviewDecision(review_state=ReviewState.rejected, note="Nei"),
        BackgroundTasks(),
    )
    assert await svc.strikes_for_author(author.id) == 1

    await svc.review(
        task.id, reviewer.id, ReviewDecision(review_state=ReviewState.unreviewed), BackgroundTasks()
    )
    assert await svc.strikes_for_author(author.id) == 0


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
    already_rejected = m.Task(
        name="Hafnað áður",
        created_at=get_current_datetime(),
        author_id=author.id,
        workspace_id=ws.id,
        review_state=ReviewState.rejected,
        hidden_at=get_current_datetime(),
    )
    db.add(already_rejected)
    await db.flush()

    item = next(i for i in await ModerationService(db).queue(UNREVIEWED, 10, 0) if i.id == task.id)
    assert item.author_strikes == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_reports_against_an_author_follow_who_wrote_the_reported_thing(db):
    author, ws, task = await _bank(db)
    commenter = m.User(name="Annar", auth0_id=f"auth0|{uuid4()}", email=f"{uuid4()}@t.is")
    db.add(commenter)
    await db.flush()
    their_item = m.Task(
        name="Annað verkefni",
        created_at=get_current_datetime(),
        author_id=commenter.id,
        workspace_id=ws.id,
    )
    db.add(their_item)
    await db.flush()
    on_author_item = m.Comment(
        body="Ljótt", user_id=commenter.id, content_id=task.id, created_at=get_current_datetime()
    )
    by_author = m.Comment(
        body="Líka ljótt",
        user_id=author.id,
        content_id=their_item.id,
        created_at=get_current_datetime(),
    )
    db.add_all([on_author_item, by_author])
    await db.flush()
    spam = m.ContentReport.__table__.c.reason.type.enum_class.spam
    for content_id, comment_id in [
        (task.id, None),
        (task.id, on_author_item.id),
        (their_item.id, by_author.id),
    ]:
        db.add(
            m.ContentReport(
                content_id=content_id,
                comment_id=comment_id,
                reporter_id=commenter.id if comment_id is None else author.id,
                reason=spam,
                status=ReportStatus.open,
                created_at=get_current_datetime(),
            )
        )
    await db.flush()
    svc = ModerationService(db)

    # Their item and their own comment, not someone else's comment under their item.
    assert await svc.reports_against_author(author.id) == 2
    assert await svc.reports_against_author(commenter.id) == 1


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

    await svc.review(
        task.id, reviewer.id, ReviewDecision(review_state=ReviewState.approved), BackgroundTasks()
    )

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
        approved_item.id,
        reviewer.id,
        ReviewDecision(review_state=ReviewState.approved),
        BackgroundTasks(),
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


# ── Reviewer notes ───────────────────────────────────────────────────────────


@pytest.mark.integration
@pytest.mark.asyncio
async def test_an_internal_note_is_not_emailed_to_the_author(db):
    """The whole point of the two kinds. An internal note reaching the author is
    worse than no note at all."""
    from fastapi import BackgroundTasks

    from app.domain.enums import ReviewCommentVisibility
    from app.schemas.moderation import ReviewCommentCreate

    author, _, task = await _bank(db)
    reviewer = m.User(name="Yfirferð", auth0_id="auth0|n1", email="n1@t.is")
    db.add(reviewer)
    await db.flush()

    tasks = BackgroundTasks()
    await ModerationService(db).add_comment(
        task.id,
        reviewer.id,
        ReviewCommentCreate(
            body="Sami höfundur og sá sem við földum í síðustu viku.",
            visibility=ReviewCommentVisibility.internal,
        ),
        tasks,
    )

    assert tasks.tasks == [], "an internal note must not page the author"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_suggestion_is_sent_to_the_author(db):
    """A suggestion nobody is told about is not a suggestion."""
    from fastapi import BackgroundTasks

    from app.domain.enums import ReviewCommentVisibility
    from app.schemas.moderation import ReviewCommentCreate

    author, _, task = await _bank(db)
    reviewer = m.User(name="Yfirferð", auth0_id="auth0|n2", email="n2@t.is")
    db.add(reviewer)
    await db.flush()

    tasks = BackgroundTasks()
    comment = await ModerationService(db).add_comment(
        task.id,
        reviewer.id,
        ReviewCommentCreate(
            body="Bættu við hversu marga þarf.",
            visibility=ReviewCommentVisibility.to_author,
        ),
        tasks,
    )

    assert len(tasks.tasks) == 1
    assert comment.author_name == "Yfirferð"
    assert comment.visibility == ReviewCommentVisibility.to_author


@pytest.mark.integration
@pytest.mark.asyncio
async def test_notes_come_back_with_the_item_in_order(db):
    """A thread reads forwards."""
    from fastapi import BackgroundTasks

    from app.domain.enums import ReviewCommentVisibility
    from app.schemas.moderation import ReviewCommentCreate

    _, _, task = await _bank(db)
    reviewer = m.User(name="Yfirferð", auth0_id="auth0|n3", email="n3@t.is")
    db.add(reviewer)
    await db.flush()
    svc = ModerationService(db)

    for body in ("Fyrsta", "Önnur"):
        await svc.add_comment(
            task.id,
            reviewer.id,
            ReviewCommentCreate(body=body, visibility=ReviewCommentVisibility.internal),
            BackgroundTasks(),
        )

    detail = await svc.detail(task.id)
    assert [c.body for c in detail.review_comments] == ["Fyrsta", "Önnur"]


def test_a_note_must_say_which_audience_it_is_for():
    """No default: whether a note reaches the author is the one thing a reviewer
    has to decide deliberately every time."""
    from app.schemas.moderation import ReviewCommentCreate

    with pytest.raises(ValueError):
        ReviewCommentCreate(body="Eitthvað")


def test_an_empty_note_is_not_a_note():
    from app.domain.enums import ReviewCommentVisibility
    from app.schemas.moderation import ReviewCommentCreate

    with pytest.raises(ValueError):
        ReviewCommentCreate(body="   ", visibility=ReviewCommentVisibility.internal)


# ── Pictures and documents ───────────────────────────────────────────────────


def test_attachments_are_read_defensively_from_free_form_json():
    """`media` has no schema and nothing writes it yet. A malformed entry should
    cost the pane one file, not the whole item a reviewer is judging."""
    from app.services.moderation import _documents_from

    docs = _documents_from(
        {
            "documents": [
                {
                    "name": "Leiðbeiningar.pdf",
                    "url": "https://x/1.pdf",
                    "content_type": "application/pdf",
                },
                {"name": "Vantar slóð"},
                "ekki hlutur",
                {"name": "Kort.png", "url": "https://x/2.png"},
            ]
        }
    )

    assert [d.name for d in docs] == ["Leiðbeiningar.pdf", "Kort.png"]


@pytest.mark.parametrize("media", [None, {}, {"documents": "nei"}, {"annad": [1]}])
def test_no_attachments_is_not_an_error(media):
    from app.services.moderation import _documents_from

    assert _documents_from(media) == []


# ── Telling the author ────────────────────────────────────────────────────────


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_rejection_reaches_the_author(db):
    """Moderation nobody is told about is indistinguishable from their work
    quietly disappearing."""
    from fastapi import BackgroundTasks

    _, _, task = await _bank(db)
    reviewer = m.User(name="Yfirferð", auth0_id="auth0|mod-notify", email="mod-n@t.is")
    db.add(reviewer)
    await db.flush()

    tasks = BackgroundTasks()
    await ModerationService(db).review(
        task.id,
        reviewer.id,
        ReviewDecision(review_state=ReviewState.rejected, note="Of hættulegt"),
        tasks,
    )

    assert len(tasks.tasks) == 1, "the rejection should queue exactly one mail"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_approval_says_nothing(db):
    """Silence is the right answer to "nothing was wrong". A mail per approved
    item trains people to ignore the mails that matter."""
    from fastapi import BackgroundTasks

    _, _, task = await _bank(db)
    reviewer = m.User(name="Yfirferð", auth0_id="auth0|mod-ok", email="mod-ok@t.is")
    db.add(reviewer)
    await db.flush()

    tasks = BackgroundTasks()
    await ModerationService(db).review(
        task.id, reviewer.id, ReviewDecision(review_state=ReviewState.approved), tasks
    )

    assert tasks.tasks == []


@pytest.mark.integration
@pytest.mark.asyncio
async def test_sending_back_tells_the_author_and_undoing_does_not(db):
    from fastapi import BackgroundTasks

    _, _, task = await _bank(db)
    reviewer = m.User(name="Yfirferð", auth0_id="auth0|mod-hide", email="mod-h@t.is")
    db.add(reviewer)
    await db.flush()
    svc = ModerationService(db)

    sending_back = BackgroundTasks()
    await svc.review(
        task.id,
        reviewer.id,
        ReviewDecision(review_state=ReviewState.needs_changes, note="Vantar leiðbeiningar"),
        sending_back,
    )
    assert len(sending_back.tasks) == 1

    undoing = BackgroundTasks()
    await svc.review(
        task.id, reviewer.id, ReviewDecision(review_state=ReviewState.unreviewed), undoing
    )
    assert undoing.tasks == []


def test_author_emails_escape_the_name_and_note(monkeypatch):
    from types import SimpleNamespace

    from app.services.moderation import _DECISION_EMAILS, _email_author

    sent: dict[str, str] = {}
    monkeypatch.setattr(
        "app.services.moderation.send_email_background",
        lambda _tasks, _to, subject, body: sent.update(subject=subject, body=body),
    )
    content = SimpleNamespace(
        id=uuid4(), name="<b>Leikur</b>", author=SimpleNamespace(email="a@t.is")
    )

    _email_author(BackgroundTasks(), content, _DECISION_EMAILS[ReviewState.rejected], "<script>")

    assert "&lt;b&gt;Leikur&lt;/b&gt;" in sent["body"]
    assert "&lt;script&gt;" in sent["body"]
    assert "<script>" not in sent["body"]
