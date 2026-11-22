"""Per-recipient messages for list email, with the right unsubscribe link for each.

- A current subscriber gets a link to the confirmation page and one-click headers.
- Someone not on the list gets no link and no header; there is nothing to leave.
- A test send to an address not on the list links to the sample token, which the
  page explains; an admin on the list gets their own token.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email import (
    SAMPLE_UNSUBSCRIBE_TOKEN,
    OutgoingEmail,
    one_click_unsubscribe_url,
    unsubscribe_page_url,
)
from app.core.email_templates.renderer import render
from app.models.email_draft import EmailDraft
from app.services.email_list import EmailListService

PLACEHOLDER = "{unsubscribe_url}"


def draft_context(draft: EmailDraft) -> dict[str, Any]:
    """Jinja2 context: newsletter blocks go under `blocks`, other templates' dicts merge in."""
    context: dict[str, Any] = {"subject": draft.subject, "preheader": draft.preheader}
    blocks = draft.blocks
    # Older drafts saved a template's fields as a one-item list.
    if draft.template != "newsletter" and isinstance(blocks, list) and len(blocks) == 1:
        blocks = blocks[0]
    if isinstance(blocks, dict):
        context.update(blocks)
    else:
        context["blocks"] = blocks
    return context


def render_draft(draft: EmailDraft, *, include_unsubscribe: bool = True) -> str:
    context = draft_context(draft)
    context["include_unsubscribe"] = include_unsubscribe
    return render(draft.template, context)


def subscriber_message(recipient: str, subject: str, html: str, token: UUID) -> OutgoingEmail:
    """A message to a current subscriber: their own page link and one-click header."""
    return OutgoingEmail(
        recipient,
        subject,
        html.replace(PLACEHOLDER, unsubscribe_page_url(token)),
        one_click_unsubscribe_url(token),
    )


def _non_subscriber_html(html: str) -> str:
    # Rendered without the footer link, so there should be nothing to fill in.
    # Belt and braces for custom HTML: never send the raw placeholder.
    return html.replace(PLACEHOLDER, unsubscribe_page_url(SAMPLE_UNSUBSCRIBE_TOKEN))


async def draft_messages(session: AsyncSession, draft: EmailDraft) -> list[OutgoingEmail]:
    """Every message a draft send produces, with the right unsubscribe link for each."""
    svc = EmailListService(session)
    html = render_draft(draft)

    if not draft.manual_recipients:
        return [
            subscriber_message(s.email, draft.subject, html, s.unsubscribe_token)
            for s in await svc.list()
        ]

    tokens = await svc.active_tokens_for(draft.manual_recipients)
    bare_html: str | None = None
    messages: list[OutgoingEmail] = []
    for recipient in draft.manual_recipients:
        token = tokens.get(recipient)
        if token is not None:
            messages.append(subscriber_message(recipient, draft.subject, html, token))
            continue
        if bare_html is None:
            bare_html = _non_subscriber_html(render_draft(draft, include_unsubscribe=False))
        messages.append(OutgoingEmail(recipient, draft.subject, bare_html))
    return messages


async def build_test_message(
    session: AsyncSession, draft: EmailDraft, recipient: str
) -> OutgoingEmail:
    """The admin's test copy of a draft — see the module docstring."""
    subject = f"[TEST] {draft.subject}"
    html = render_draft(draft)
    token = await EmailListService(session).active_token_for(recipient)
    if token is not None:
        return subscriber_message(recipient, subject, html, token)
    return OutgoingEmail(recipient, subject, _non_subscriber_html(html))
