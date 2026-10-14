# UX conventions

How Slóði behaves, so every screen behaves the same way. These rules came out of the UX audit of
2026-10-12: 20 conventions already in the code and specs, plus 11 proposals, merged into the 12
rules below. Where a rule is checked automatically, it says how. Where it isn't yet, the gap is
tracked in Shortcut (epics 603–610).

Specs that go deeper for one area win over this page for that area:
`docs/design/efnissida/SPEC.md` (item page) and `docs/design/yfirferd/SPEC.md` (review).

## 1. Language

- All UI copy is Icelandic and addresses the reader as *þú*. It's gender-neutral (*þau*).
- Use kind-neutral words: items are "einingar" or "efni". Say "dagskrá" only when the item is a
  Dagskrá; kind-dependent strings come from `kindCopy` / `CONTENT_TYPE_LABEL`.
- Shared words come from one copy table:

  | Meaning | Word |
  |---|---|
  | cancel | Hætta við |
  | close (✕ only) | Loka |
  | save | Vista / Vista breytingar |
  | delete | Eyða {kind} |
  | undo | Afturkalla |
  | retry | Reyna aftur |
  | like | rokkstig |
  | tag | merkimiði |
  | items (count) | einingar |

- Busy buttons say what they're doing: "Vista…", "Eyði…", never a bare "…". The ellipsis is
  always the single character `…`.

*Checked by:* the crawler fails on leftover English UI words.

## 2. Numbers, dates and plurals

- Dates go through `formatIcelandicDate[Short]` and numbers through `formatIcelandicNumber`.
  Never use `toLocale*` or `Intl` directly, because Chrome lacks is-IS and falls back to English.
- A number next to a noun goes through `countIs(n, one, many)`. Icelandic takes the singular when
  the number ends in 1, except 11: "1 eining", "21 eining", "11 einingar".

## 3. Errors

- The frontend's API layer reports an error as a status code plus the raw detail. It never hands
  a display string to the UI.
- Components show one Icelandic message from `userMessage(err)`. Form errors from the backend
  are mapped onto the fields they belong to.
- Errors appear inline, are announced (`role="alert"`) and say what to do next. A failed load
  always offers "Reyna aftur".
- Errors and 404s use the house voice ("Úps! Fórstu út fyrir slóðann?"). The raw message may
  appear only as small print under it.
- A crash shows our own error page (`app/error.tsx`), never Next's English default.

## 4. Feedback

- Every action ends in exactly one visible result, and that result is announced to screen readers.
  - **An error in context:** inline.
  - **A success that closes or changes the view:** a toast (`role="status"`, at least 5 seconds).
  - **A reversible delete:** a toast with "Afturkalla".
- When an optimistic update fails and is rolled back, say so.
- Never `alert()`, and never report an outcome only to the console.

## 5. Destructive and consequential actions

- **Irreversible** acts use a confirmation dialog: delete an item, send an email, a permanent
  suspension.
  - The dialog names the item.
  - Cancel comes first and is quiet; the confirm button is red and carries the verb ("Eyða
    verkefni").
  - An error keeps the dialog open, so typed text isn't lost.
- **Reversible** acts happen at once and offer "Afturkalla" for at least 8 seconds: hide, reject,
  close a report, delete a comment, clear a draft, most role changes.
- **Mass or external** effects always confirm with a count: "Senda á 1.234 netföng?"
- Promoting someone to moderator or admin always confirms.
- Cancel always means cancel.
- No `window.prompt`, `window.confirm` or `window.alert`.

## 6. Forms

- Validate on submit, then on every change for fields already in error.
- After a failed submit, focus the first error, open its section, and show a summary.
- The submit button stays enabled except while busy.
- Use one way to mark fields: either required fields get `*`, or optional ones say "(valfrjálst)".
  A form never mixes the two.
- Length limits mirror the backend (`backend/app/domain/`), with a counter from 90%: "4.950 / 5.000".
- Closing a form with unsaved changes asks first ("Henda breytingum?"), through every way of
  closing: ✕, Escape, the backdrop, Hætta við, leaving the page.
- The create form keeps an unsent draft. An edit asks before discarding.
- Enter in a sub-field (chips, tag search) never submits the form.
  - In a textarea, Enter is a newline and Ctrl/Cmd+Enter sends.
  - Space is always text.

## 7. Dialogs and drawers

- There is one shared dialog primitive, and every modal and drawer uses it. On opening it:
  - moves focus to the first meaningful element and traps Tab inside;
  - locks page scroll.
- On closing, focus returns to whatever opened it.
- Escape closes only the topmost layer.
- Ids come from `useId()`, sizes use `dvh`, and stacking uses `--sl-z-*` tokens.
- Below 620px, a dialog opens as a bottom sheet that respects the iPhone safe area.

## 8. Phones and touch

- Every interactive element has a hit area of at least 48px at phone width (`--sl-touch-target`).
- No action is revealed only by hover. Under `@media (hover: none)`, it's always visible.
- Inputs are at least 16px, so iOS doesn't zoom when one is tapped.
- Use `dvh`, never `vh`.
- Fixed bottom elements pad for `env(safe-area-inset-bottom)`.

*Planned check:* the crawler fails on targets under 44px at 390px wide.

## 9. Access, and things that aren't available

- **A page you can't use** shows `<NoAccess>`: the reason, in the house voice, plus a way out.
  No silent redirects.
- **A control you can't use right now** is disabled, and its reason is visible text, not a
  tooltip. "Right now" means suspended, signed out, or an empty tab.
- **A control your role can never use** is absent.
- **A feature that isn't built yet** is either absent or visibly marked "Kemur síðar". It is never
  a live button that answers with an alert.
- Platform permission (viewer, member, moderator, admin) gates platform pages. Workspace role gates
  workspace actions. The frontend mirrors the backend rules in `lib/permissions.ts`.
- A signed-out visitor to a private page goes to login and comes back to the same path and query.
  A 401 from the API does the same.

## 10. URL state

- Anything Back, refresh or a shared link should keep belongs in the URL: filters, search, page
  number, tab, the selected item. It's always written with `replace`, so it doesn't fill the Back
  history.
- After a delete, navigate with `replace`, so Back doesn't lead to the deleted item.
- A "back to the list" link restores the list URL the reader came from.

## 11. Loading

- Page and list loads use a skeleton that mirrors the finished layout. Nothing shifts when the
  content arrives, and the skeleton is static under `prefers-reduced-motion`.
- A small in-place load uses one `<Loading>` with an Icelandic label and `role="status"`.
- While busy, disable the button, not the field being typed in, so the phone keyboard stays open.

## 12. Shared components

- Use the shared Modal, Button, ActiveChip, CollapsibleSection and Alert instead of local copies.
- Styling comes from design tokens (`--sl-*`) only. See Storybook → Design system → Tokens.

*Checked by:* `check:tokens`. A ratchet on hand-written `<button>`s is planned.
