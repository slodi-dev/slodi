"""Every outgoing list email gets a working unsubscribe link, or none — sc-542.

Manual-recipient sends and test sends used to put a hard-coded, tokenless
https://slodi.is/unsubscribe into the footer, a link that could not unsubscribe
anyone. These pin the rules in app/services/email_delivery.py.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.core.email import (
    SAMPLE_UNSUBSCRIBE_TOKEN,
    one_click_unsubscribe_url,
    unsubscribe_page_url,
)
from app.models.email_draft import EmailDraft
from app.schemas.email_list import EmailListOut
from app.services.email_delivery import build_test_message, draft_messages

SVC = "app.services.email_list.EmailListService"


def _draft(manual_recipients=None, template="newsletter"):
    return EmailDraft(
        subject="Fréttir",
        preheader=None,
        template=template,
        blocks=[],
        manual_recipients=manual_recipients,
    )


def _assert_no_dead_link(html):
    assert "{unsubscribe_url}" not in html
    assert 'href="https://slodi.is/unsubscribe"' not in html


@pytest.mark.asyncio
async def test_list_send_gives_each_subscriber_their_own_link_and_header():
    a, b = uuid4(), uuid4()
    subs = [
        EmailListOut(email="a@x.is", unsubscribe_token=a),
        EmailListOut(email="b@x.is", unsubscribe_token=b),
    ]
    with patch(f"{SVC}.list", new_callable=AsyncMock, return_value=subs):
        messages = await draft_messages(AsyncMock(), _draft())

    assert [(m[0], m[3]) for m in messages] == [
        ("a@x.is", one_click_unsubscribe_url(a)),
        ("b@x.is", one_click_unsubscribe_url(b)),
    ]
    assert unsubscribe_page_url(a) in messages[0][2]
    assert unsubscribe_page_url(b) in messages[1][2]


@pytest.mark.asyncio
async def test_manual_recipient_on_the_list_gets_their_real_token():
    token = uuid4()
    with patch(f"{SVC}.active_tokens_for", new_callable=AsyncMock, return_value={"on@x.is": token}):
        [message] = await draft_messages(AsyncMock(), _draft(["On@x.is"]))

    recipient, _subject, html, header = message
    assert recipient == "On@x.is"
    assert unsubscribe_page_url(token) in html
    assert header == one_click_unsubscribe_url(token)


@pytest.mark.asyncio
async def test_manual_recipient_not_on_the_list_gets_no_link_and_no_header():
    """Nothing to unsubscribe from, and no subscription is created for them."""
    with (
        patch(f"{SVC}.active_tokens_for", new_callable=AsyncMock, return_value={}),
        patch(f"{SVC}.create", new_callable=AsyncMock) as create,
    ):
        [message] = await draft_messages(AsyncMock(), _draft(["off@x.is"]))

    _recipient, _subject, html, header = message
    assert header is None
    _assert_no_dead_link(html)
    assert "/unsubscribe" not in html
    assert "Segja upp póstlista" not in html
    create.assert_not_called()


@pytest.mark.asyncio
async def test_test_send_to_a_subscriber_uses_their_real_token():
    token = uuid4()
    with patch(
        f"{SVC}.active_tokens_for", new_callable=AsyncMock, return_value={"admin@x.is": token}
    ):
        recipient, subject, html, header = await build_test_message(
            AsyncMock(), _draft(), "admin@x.is"
        )

    assert (recipient, subject) == ("admin@x.is", "[TEST] Fréttir")
    assert unsubscribe_page_url(token) in html
    assert header == one_click_unsubscribe_url(token)


@pytest.mark.asyncio
async def test_test_send_to_a_non_subscriber_shows_the_sample_link_without_subscribing():
    with (
        patch(f"{SVC}.active_tokens_for", new_callable=AsyncMock, return_value={}),
        patch(f"{SVC}.create", new_callable=AsyncMock) as create,
    ):
        _recipient, _subject, html, header = await build_test_message(
            AsyncMock(), _draft(), "admin@x.is"
        )

    assert unsubscribe_page_url(SAMPLE_UNSUBSCRIBE_TOKEN) in html
    _assert_no_dead_link(html)
    assert header is None
    create.assert_not_called()


def test_test_send_route_goes_through_the_batch_sender(client, mock_db_session):
    """Same path as a real send, so the admin sees the real footer and headers."""
    token = uuid4()
    mock_db_session.get = AsyncMock(return_value=_draft())
    with (
        patch(
            f"{SVC}.active_tokens_for",
            new_callable=AsyncMock,
            return_value={"admin@test.com": token},
        ),
        patch("app.routers.email_router.send_batch_background") as send,
    ):
        response = client.post(f"/emails/drafts/{uuid4()}/test")

    assert response.status_code == 202
    [message] = send.call_args.args[1]
    assert message[0] == "admin@test.com"
    assert message[3] == one_click_unsubscribe_url(token)
