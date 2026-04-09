from __future__ import annotations

import logging

import resend
from fastapi import BackgroundTasks

from app.settings import settings

logger = logging.getLogger(__name__)

_BATCH_SIZE = 100


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


def _send_batch(messages: list[tuple[str, str, str]]) -> None:
    """Send a batch of individual emails.

    Each message is (recipient, subject, html).
    """
    if not settings.resend_api_key:
        logger.warning(
            "RESEND_API_KEY not configured — skipping batch of %d emails",
            len(messages),
        )
        return

    resend.api_key = settings.resend_api_key
    for i in range(0, len(messages), _BATCH_SIZE):
        chunk = messages[i : i + _BATCH_SIZE]
        params: list[resend.Emails.SendParams] = []
        for recipient, subject, html in chunk:
            entry: resend.Emails.SendParams = {
                "from": settings.resend_from_email,
                "to": [recipient],
                "reply_to": settings.resend_from_email,
                "subject": subject,
                "html": html,
            }
            params.append(entry)
        resend.Batch.send(params)


def send_email_background(
    background_tasks: BackgroundTasks,
    recipients: list[str],
    subject: str,
    html: str,
) -> None:
    """Queue an email to be sent after the response is returned.

    If RESEND_API_KEY is not set the call is a no-op (logs a warning).
    FastAPI runs sync background tasks in a thread-pool executor, so the
    blocking Resend SDK call does not block the event loop.
    """
    background_tasks.add_task(_send_email, recipients, subject, html)


def send_batch_background(
    background_tasks: BackgroundTasks,
    messages: list[tuple[str, str, str]],
) -> None:
    """Queue a batch of individual emails as a background task.

    Each message is (recipient, subject, html).
    """
    background_tasks.add_task(_send_batch, messages)
