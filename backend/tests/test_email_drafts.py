import datetime as dt
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.domain.enums import DraftStatus
from app.models.email_draft import EmailDraft
from app.schemas.email import DraftCreate
from app.services.email_drafts import send_draft


def _draft(status=DraftStatus.draft):
    return EmailDraft(
        id=uuid4(),
        subject="Fréttir",
        preheader=None,
        template="newsletter",
        blocks=[],
        manual_recipients=None,
        status=status,
        scheduled_at=None,
        sent_at=None,
        created_by=uuid4(),
        created_at=dt.datetime.now(dt.timezone.utc),
        updated_at=None,
    )


def test_a_draft_must_name_a_real_template():
    with pytest.raises(ValidationError):
        DraftCreate(subject="Halló", template="no-such-template")


def test_send_now_answers_processing_and_sends_in_the_background(client, mock_db_session):
    draft = _draft()
    mock_db_session.get = AsyncMock(return_value=draft)
    with patch("app.routers.email_router.send_draft_by_id", new_callable=AsyncMock) as send:
        response = client.post(f"/emails/drafts/{draft.id}/send")

    assert response.status_code == 200
    assert response.json()["status"] == "processing"
    send.assert_awaited_once_with(draft.id)


def test_a_sent_draft_cannot_be_sent_again(client, mock_db_session):
    mock_db_session.get = AsyncMock(return_value=_draft(DraftStatus.sent))
    response = client.post(f"/emails/drafts/{uuid4()}/send")
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_a_draft_that_fails_to_render_is_marked_failed_not_stuck():
    draft, session = _draft(DraftStatus.processing), AsyncMock()
    with patch("app.services.email_drafts.draft_messages", side_effect=ValueError("bad")):
        await send_draft(draft, session)

    assert draft.status == DraftStatus.failed
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_a_draft_is_marked_sent_only_after_sending():
    draft, session = _draft(DraftStatus.processing), AsyncMock()
    with (
        patch("app.services.email_drafts.draft_messages", new_callable=AsyncMock, return_value=[]),
    ):
        await send_draft(draft, session)

    assert draft.status == DraftStatus.sent
    assert draft.sent_at is not None
