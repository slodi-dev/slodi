"""Token unsubscribe against a real database (sc-542)."""

from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models.email_list import EmailList
from app.repositories.email_list import EmailListRepository
from app.schemas.email_list import EmailListCreate
from app.services.email_list import EmailListService


async def _subscribe(db, email: str) -> EmailList:
    await EmailListService(db).create(EmailListCreate(email=email))
    rows = await EmailListRepository(db).list()
    return next(r for r in rows if r.email == email)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_checking_a_token_does_not_unsubscribe(db):
    entry = await _subscribe(db, "check@example.com")
    svc = EmailListService(db)

    status = await svc.subscription_status(entry.unsubscribe_token)

    assert (status.subscribed, status.changed) == (True, False)

    emails = [r.email for r in await EmailListRepository(db).list()]
    assert "check@example.com" in emails


@pytest.mark.integration
@pytest.mark.asyncio
async def test_unsubscribe_by_token_removes_only_that_subscriber(db):
    entry = await _subscribe(db, "leaving@example.com")
    await _subscribe(db, "staying@example.com")
    svc = EmailListService(db)

    await svc.unsubscribe_by_token(entry.unsubscribe_token)

    emails = [r.email for r in await EmailListRepository(db).list()]
    assert "leaving@example.com" not in emails
    assert "staying@example.com" in emails

    # The token keeps working: a second click or a provider retry is told
    # "already unsubscribed", not 404.
    status = await svc.subscription_status(entry.unsubscribe_token)
    assert (status.subscribed, status.changed) == (False, False)
    again = await svc.unsubscribe_by_token(entry.unsubscribe_token)
    assert (again.subscribed, again.changed) == (False, False)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_first_unsubscribe_reports_a_change(db):
    entry = await _subscribe(db, "first@example.com")

    result = await EmailListService(db).unsubscribe_by_token(entry.unsubscribe_token)

    assert (result.subscribed, result.changed) == (False, True)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_token_that_never_existed_is_404(db):
    svc = EmailListService(db)
    for call in (svc.subscription_status, svc.unsubscribe_by_token, svc.resubscribe_by_token):
        with pytest.raises(HTTPException) as exc:
            await call(uuid4())
        assert exc.value.status_code == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_resubscribe_with_the_same_token(db):
    entry = await _subscribe(db, "back@example.com")
    svc = EmailListService(db)
    await svc.unsubscribe_by_token(entry.unsubscribe_token)

    result = await svc.resubscribe_by_token(entry.unsubscribe_token)

    assert (result.subscribed, result.changed) == (True, True)
    assert "back@example.com" in [r.email for r in await EmailListRepository(db).list()]
    again = await svc.resubscribe_by_token(entry.unsubscribe_token)
    assert (again.subscribed, again.changed) == (True, False)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_signing_up_again_after_unsubscribing_resubscribes(db):
    entry = await _subscribe(db, "return@example.com")
    svc = EmailListService(db)
    await svc.unsubscribe_by_token(entry.unsubscribe_token)

    await svc.create(EmailListCreate(email="Return@Example.com"))

    rows = await EmailListRepository(db).list()
    again = next(r for r in rows if r.email == "return@example.com")
    assert again.unsubscribe_token == entry.unsubscribe_token


@pytest.mark.integration
@pytest.mark.asyncio
async def test_active_tokens_skip_unsubscribed_addresses(db):
    on = await _subscribe(db, "on@example.com")
    off = await _subscribe(db, "off@example.com")
    svc = EmailListService(db)
    await svc.unsubscribe_by_token(off.unsubscribe_token)

    tokens = await svc.active_tokens_for(["ON@example.com", "off@example.com", "never@example.com"])

    assert tokens == {"on@example.com": on.unsubscribe_token}
