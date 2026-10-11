"""Per-recipient messages for list email: one place that fills in unsubscribe links.

Draft sends (now and scheduled), broadcasts and test sends used to each do
their own `{unsubscribe_url}` replacement, and two of them put a hard-coded,
tokenless https://slodi.is/unsubscribe into the email — a link that could not
unsubscribe anyone. Everything now goes through `subscriber_message` /
`draft_messages` / `build_test_message`, so the rules are:

- **On the list** (a current subscriber): body links to the confirmation page
  for their token, and the RFC 8058 List-Unsubscribe headers point at the
  one-click endpoint.
- **Not on the list** (a manual recipient who never subscribed): no footer
  link and no List-Unsubscribe header. There is nothing to unsubscribe from,
  and we do not create a subscription just to have a token.
- **Test send to an address not on the list**: the footer is rendered as the
  real recipients will see it, with a link to the sample token
  (`SAMPLE_UNSUBSCRIBE_TOKEN`), which the page explains instead of failing.
  No header. If the admin *is* on the list, their own token is used, so the
  test exercises the real flow end to end.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email import (
    SAMPLE_UNSUBSCRIBE_TOKEN,
    one_click_unsubscribe_url,
    unsubscribe_page_url,
)
from app.core.email_templates.renderer import render
from app.models.email_draft import EmailDraft
from app.services.email_list import EmailListService

#: (recipient, subject, html, one_click_url) — the shape `_send_batch` takes.
Message = tuple[str, str, str, str | None]

PLACEHOLDER = "{unsubscribe_url}"


def draft_context(draft: EmailDraft) -> dict[str, Any]:
    """Build the Jinja2 context dict from a draft.

    - ``newsletter`` stores blocks as a list of block dicts → passed as {"blocks": [...]}.
    - Other templates (welcome, new_feature, workspace_invite) store their
      variables as a flat dict → merged directly into context.
    """
    context: dict[str, Any] = {"subject": draft.subject, "preheader": draft.preheader}
    if isinstance(draft.blocks, dict):
        context.update(draft.blocks)
    else:
        context["blocks"] = draft.blocks
    return context


def render_draft(draft: EmailDraft, *, include_unsubscribe: bool = True) -> str:
    context = draft_context(draft)
    context["include_unsubscribe"] = include_unsubscribe
    return render(draft.template, context)


def subscriber_message(recipient: str, subject: str, html: str, token: UUID) -> Message:
    """A message to a current subscriber: their own page link and one-click header."""
    return (
        recipient,
        subject,
        html.replace(PLACEHOLDER, unsubscribe_page_url(token)),
        one_click_unsubscribe_url(token),
    )


def _non_subscriber_html(html: str) -> str:
    # Rendered without the footer link, so there should be nothing to fill in.
    # Belt and braces for custom HTML: never send the raw placeholder.
    return html.replace(PLACEHOLDER, unsubscribe_page_url(SAMPLE_UNSUBSCRIBE_TOKEN))


async def draft_messages(session: AsyncSession, draft: EmailDraft) -> list[Message]:
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
    messages: list[Message] = []
    for recipient in draft.manual_recipients:
        token = tokens.get(recipient.strip().lower())
        if token is not None:
            messages.append(subscriber_message(recipient, draft.subject, html, token))
            continue
        if bare_html is None:
            bare_html = _non_subscriber_html(render_draft(draft, include_unsubscribe=False))
        messages.append((recipient, draft.subject, bare_html, None))
    return messages


async def build_test_message(session: AsyncSession, draft: EmailDraft, recipient: str) -> Message:
    """The admin's test copy of a draft — see the module docstring."""
    subject = f"[TEST] {draft.subject}"
    html = render_draft(draft)
    token = (await EmailListService(session).active_tokens_for([recipient])).get(
        recipient.strip().lower()
    )
    if token is not None:
        return subscriber_message(recipient, subject, html, token)
    return (
        recipient,
        subject,
        html.replace(PLACEHOLDER, unsubscribe_page_url(SAMPLE_UNSUBSCRIBE_TOKEN)),
        None,
    )
