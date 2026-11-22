from __future__ import annotations

import logging
from typing import NamedTuple
from uuid import UUID

import resend
from fastapi import BackgroundTasks

from app.settings import settings

logger = logging.getLogger(__name__)

_BATCH_SIZE = 100

# For links shown without a subscription behind them (previews, test sends); the
# unsubscribe page recognises it as a sample. Never used in a List-Unsubscribe header.
SAMPLE_UNSUBSCRIBE_TOKEN = UUID(int=0)


class OutgoingEmail(NamedTuple):
    recipient: str
    subject: str
    html: str
    one_click_url: str | None = None
    """When set, RFC 8058 List-Unsubscribe headers point at it."""


def unsubscribe_page_url(token: UUID | str) -> str:
    """Link for the email body: a page where the reader confirms unsubscribing."""
    return f"{settings.public_site_url.rstrip('/')}/unsubscribe?token={token}"


def one_click_unsubscribe_url(token: UUID | str) -> str:
    """RFC 8058 target: mail providers POST here, so it is the backend endpoint, not a page."""
    return f"{settings.public_api_url.rstrip('/')}/emaillist/unsubscribe/{token}"


def _send_email(recipients: list[str], subject: str, html: str) -> None:
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not configured — skipping email to %s", recipients)
        return

    resend.api_key = settings.resend_api_key
    params: resend.Emails.SendParams = {
        "from": settings.resend_from_email,
        "to": [settings.resend_from_email],
        "bcc": recipients,
        "reply_to": settings.resend_from_email,
        "subject": subject,
        "html": html,
    }
    resend.Emails.send(params)


def _batch_params(message: OutgoingEmail) -> resend.Emails.SendParams:
    params: resend.Emails.SendParams = {
        "from": settings.resend_from_email,
        "to": [message.recipient],
        "reply_to": settings.resend_from_email,
        "subject": message.subject,
        "html": message.html,
    }
    if message.one_click_url:
        params["headers"] = {
            "List-Unsubscribe": f"<{message.one_click_url}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
    return params


def send_batch(messages: list[OutgoingEmail]) -> None:
    """Send one email per message (blocking); a failed chunk does not stop the rest, but
    the call raises at the end so the caller knows not everyone got it."""
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not configured — skipping batch of %d emails", len(messages))
        return

    resend.api_key = settings.resend_api_key
    failed = 0
    for i in range(0, len(messages), _BATCH_SIZE):
        chunk = messages[i : i + _BATCH_SIZE]
        try:
            resend.Batch.send([_batch_params(m) for m in chunk])
        except Exception:
            failed += len(chunk)
            logger.exception("Batch of %d emails failed (from message %d)", len(chunk), i)
    if failed:
        raise RuntimeError(f"{failed} of {len(messages)} emails were not sent")


def send_email_background(
    background_tasks: BackgroundTasks,
    recipients: list[str],
    subject: str,
    html: str,
) -> None:
    """Send after the response; a no-op with a warning when RESEND_API_KEY is unset."""
    background_tasks.add_task(_send_email, recipients, subject, html)


def send_batch_background(background_tasks: BackgroundTasks, messages: list[OutgoingEmail]) -> None:
    background_tasks.add_task(send_batch, messages)
