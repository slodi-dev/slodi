"""Scheduled email sender worker.

Run from cron every 60 seconds:
    python -m app.workers.email_scheduler

Claims due drafts atomically (UPDATE ... WHERE ... RETURNING) to prevent
duplicate sends, then renders and dispatches each one via Resend.
"""

from __future__ import annotations

import asyncio
import logging

from app.core.db import get_session_maker
from app.repositories.email_drafts import EmailDraftRepository
from app.services.email_drafts import send_draft_by_id

logger = logging.getLogger(__name__)


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    async with get_session_maker()() as session:
        drafts = await EmailDraftRepository(session).claim_due()
        await session.commit()

    if not drafts:
        logger.info("No scheduled drafts due — exiting.")
        return
    logger.info("Claimed %d due draft(s)", len(drafts))
    for draft in drafts:
        await send_draft_by_id(draft.id)


if __name__ == "__main__":
    asyncio.run(main())
