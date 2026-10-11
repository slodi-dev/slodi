# Unsubscribing from the email list

Replaces `docs/todo/unsubscribe-frontend.md`, which described an older flow
(GET unsubscribed straight away; tokens were single-use) and is done.

The flow follows RFC 8058 and common practice: the mail client's one-click
button unsubscribes at once, the link in the email body opens a page that asks
first, and a GET never changes anything, because link scanners and previewers
fetch every link in an email.

## Every list email carries two links

Both are built by `backend/app/core/email.py` from the subscriber's
`unsubscribe_token`, and every send goes through
`backend/app/services/email_delivery.py`, so there is one place that decides
which link a recipient gets.

| Where | URL | Helper |
|---|---|---|
| Email body (`{unsubscribe_url}`) | `PUBLIC_SITE_URL/unsubscribe?token=…` | `unsubscribe_page_url` |
| `List-Unsubscribe` header, with `List-Unsubscribe-Post: List-Unsubscribe=One-Click` | `PUBLIC_API_URL/emaillist/unsubscribe/{token}` | `one_click_unsubscribe_url` |

Defaults: `PUBLIC_SITE_URL=https://slodi.is`, `PUBLIC_API_URL=https://api.slodi.is`.

Who gets what:

- **On the list** (broadcast, draft send to the list, or a manual recipient who
  is a current subscriber): their own token in both places.
- **Manual recipient not on the list**: no footer link and no header. There is
  nothing to unsubscribe from, and no subscription is created to get a token.
  Templates hide the footer link with `include_unsubscribe=False`.
- **Test send** (`POST /emails/drafts/{id}/test`): goes through the same batch
  sender as a real send. If the admin's address is on the list, their real
  token is used. Otherwise the footer shows a link with the sample token
  `00000000-0000-0000-0000-000000000000` and there is no header; the page
  recognises the sample token and says nothing was changed.
- **Template preview**: the sample token, same as above.

## Backend endpoints (public, no auth)

| Method | Path | Does |
|---|---|---|
| GET | `/emaillist/unsubscribe/{token}` | Read-only. `200 {subscribed, changed: false}` |
| POST | `/emaillist/unsubscribe/{token}` | Unsubscribes. `200 {subscribed: false, changed}`; body ignored |
| POST | `/emaillist/resubscribe/{token}` | Undoes it. `200 {subscribed: true, changed}` |

All three are idempotent. `changed: false` means the address was already in
that state: a second click, or a provider retrying its one-click POST, is not
an error. Only a token that never existed (or whose row an admin deleted with
`DELETE /emaillist/{email}`) gets `404`.

Unsubscribing sets `emaillist.unsubscribed_at` rather than deleting the row, so
the token keeps working. Every send reads only rows where it is null. Signing
up again through the public form clears it (same row, same token).

## Frontend

- `/unsubscribe?token=…` (`frontend/app/unsubscribe/page.tsx`) checks the token
  on load, then shows one of: a confirm button ("Afskrá mig"), "Netfangið er
  þegar afskráð.", the sample-link notice, or an invalid-link message. After
  unsubscribing, it offers "Skrá mig aftur".
- `frontend/app/api/emails/unsubscribe/route.ts` proxies GET (check) and POST
  (`{token}` to unsubscribe, `{token, action: "resubscribe"}` to resubscribe),
  rejecting anything that is not a UUID.
- There is deliberately no way to unsubscribe by typing an email address.

## Adding the link to a template

Put the literal placeholder `{unsubscribe_url}` (single braces) in the HTML,
inside `{% if include_unsubscribe|default(true) %}` so it disappears for
recipients who are not on the list. See `newsletter.html` and
`new_feature.html`. Do not pass `unsubscribe_url` in the render context; the
sender fills it in per recipient after rendering.
