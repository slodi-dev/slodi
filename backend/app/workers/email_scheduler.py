"""Scheduled email sender worker.

Run from cron every 60 seconds:
    python -m app.workers.email_scheduler

Claims due drafts atomically (UPDATE ... WHERE ... RETURNING) to prevent
duplicate sends, then renders and dispatches each one via Resend.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import logging
from typing import Any

import resend
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.core.db import get_session_maker
from app.core.email_templates.renderer import render
from app.models.email_draft import EmailDraft
from app.services.email_list import EmailListService
from app.settings import settings

logger = logging.getLogger(__name__)

_BATCH_SIZE = 100


async def claim_due_drafts(session: AsyncSession) -> list[EmailDraft]:
    """Atomically claim all drafts whose scheduled_at has arrived."""
    result = await session.execute(
        update(EmailDraft)
        .where(
            EmailDraft.status == "scheduled",
            EmailDraft.scheduled_at <= func.now(),
        )
        .values(status="processing")
        .returning(EmailDraft)
    )
    await session.commit()
    return list(result.scalars().all())


def _send_batch_sync(messages: list[tuple[str, str, str, str | None]]) -> None:
    """Send emails via Resend SDK (blocking).

    Each message is (recipient, subject, html, unsubscribe_url).
    Adds List-Unsubscribe headers when unsubscribe_url is provided.
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
        for recipient, subject, html, unsub_url in chunk:
            entry: resend.Emails.SendParams = {
                "from": settings.resend_from_email,
                "to": [recipient],
                "reply_to": settings.resend_from_email,
                "subject": subject,
                "html": html,
            }
            if unsub_url:
                entry["headers"] = {
                    "List-Unsubscribe": f"<{unsub_url}>",
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                }
            params.append(entry)
        resend.Batch.send(params)


async def process_draft(draft: EmailDraft, session: AsyncSession) -> None:
    """Render, build per-recipient HTML, send, and update status."""
    try:
        context: dict[str, Any] = {"subject": draft.subject, "preheader": draft.preheader}
        if isinstance(draft.blocks, dict):
            context.update(draft.blocks)
        else:
            context["blocks"] = draft.blocks
        html = render(draft.template, context)

        messages: list[tuple[str, str, str, str | None]] = []

        if draft.manual_recipients:
            for recipient in draft.manual_recipients:
                recipient_html = html.replace("{unsubscribe_url}", "https://slodi.is/unsubscribe")
                messages.append((recipient, draft.subject, recipient_html, None))
        else:
            subscribers = await EmailListService(session).list()
            for subscriber in subscribers:
                unsub_url = f"https://slodi.is/unsubscribe?token={subscriber.unsubscribe_token}"
                subscriber_html = html.replace("{unsubscribe_url}", unsub_url)
                messages.append((subscriber.email, draft.subject, subscriber_html, unsub_url))

        if messages:
            # Run blocking Resend call in a thread to avoid blocking the loop
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, _send_batch_sync, messages)

        draft.status = "sent"
        draft.sent_at = dt.datetime.now(dt.timezone.utc)
        await session.commit()
        logger.info("Draft %s sent successfully (%d recipients)", draft.id, len(messages))

    except Exception:
        logger.exception("Failed to send draft %s", draft.id)
        draft.status = "failed"
        await session.commit()


async def main() -> None:
    """Entry point: claim due drafts and process them."""
    logging.basicConfig(level=logging.INFO)
    async_session = get_session_maker()

    async with async_session() as session:
        drafts = await claim_due_drafts(session)
        if not drafts:
            logger.info("No scheduled drafts due — exiting.")
            return
        logger.info("Claimed %d due draft(s)", len(drafts))

    for draft in drafts:
        async with async_session() as session:
            # Re-attach draft to this session
            merged_draft = await session.merge(draft)
            await process_draft(merged_draft, session)


if __name__ == "__main__":
    asyncio.run(main())
