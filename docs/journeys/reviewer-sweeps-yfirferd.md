---
id: reviewer-sweeps-yfirferd
persona: Reviewer
stories: [E5]
shortcut: [sc-528]
specs: [yfirferd]
test: none
gate: nightly
---

# Reviewer sweeps Yfirferð

One of Dagskrárstjórnarteymið's three volunteers opens Yfirferð to clear the
week's new submissions. She approves what is fine, rejects what is not with a
reason the author will read, and sends an author a suggestion. For an item she
can't decide on yet, she asks to be reminded later.

**Story gap.** No user story in `user-stories.md` is written for the review
team; every story there is for a leader. The nearest is E5 ("who maintains
quality?"). The coverage report flags this journey as weakly linked until
þarfagreining adds a story for the reviewer role.

Source: [`design/yfirferd/SPEC.md`](../design/yfirferd/SPEC.md), sections 1–4
and the acceptance criteria in §10. There is no persona journey for this role
in `program-detail-page-improvements.md`.

## Steps

| Step | The reviewer… | She expects… |
|---|---|---|
| S1 | opens Yfirferð | the queue, with "Óyfirfarin hugmynd" in it and selected |
| S2 | reads the item in the pane | name, description, leiðbeiningar and documents, with the action bar visible without scrolling (§10) |
| S3 | approves it with `s` | it leaves the queue, focus moves to the next item, and `Afturkalla` is offered |
| S4 | rejects the next item with `h` | a `ConfirmDialog` that will not continue without a reason the author will see (§10) |
| S5 | writes a note and presses `Senda höfundi` | a confirmation that it cannot be taken back, and then the note is sent |
| S6 | copies the item's link with `Afrita hlekk`, then opens it | the same item selected, via `?efni=<id>` (§8 deep link) |
| S7 | presses `Minna mig á` on an item she can't decide _(manual: sc-528, not built)_ | the item comes back to her later |

## What it guards

- yfirferd `SPEC.md` §10: no `window.prompt` or `window.confirm`; a reason is
  required to reject; the whole sweep works from the keyboard.
- sc-528 ("Minna mig á") is still to be built. S7 stays manual until it is.

## Fixture

`backend/scripts/seed_e2e.py`: task `…00a3`, "Óyfirfarin hugmynd", by
`e2e|community-member`, `review_state = unreviewed`. The reviewer is
`e2e|reviewer`, with moderator permission. S4 and S5 need a second and third
unreviewed item, which still have to be added to the seed.

## Gate

Nightly, not PR. The sweep changes review state for several items and sends
author email (through Resend, which is unset in e2e, so nothing is delivered).
It is the longest journey and the one least often touched by a frontend PR.
Move it to `pr` if Yfirferð changes start breaking it.
