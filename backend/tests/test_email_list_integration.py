"""Token unsubscribe against a real database (sc-542)."""

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

    await svc.check_unsubscribe_token(entry.unsubscribe_token)

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

    # The token is spent: both checking and reusing it now 404.
    with pytest.raises(HTTPException) as exc:
        await svc.check_unsubscribe_token(entry.unsubscribe_token)
    assert exc.value.status_code == 404
    with pytest.raises(HTTPException) as exc:
        await svc.unsubscribe_by_token(entry.unsubscribe_token)
    assert exc.value.status_code == 404
