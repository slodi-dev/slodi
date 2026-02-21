from __future__ import annotations

import logging

import resend
from fastapi import BackgroundTasks

from app.settings import settings

logger = logging.getLogger(__name__)


def _send_email(recipients: list[str], subject: str, html: str) -> None:
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not configured — skipping email to %s", recipients)
        return

    resend.api_key = settings.resend_api_key
    params: resend.Emails.SendParams = {
        "from": settings.resend_from_email,
        "to": recipients,
        "subject": subject,
        "html": html,
    }
    resend.Emails.send(params)


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
