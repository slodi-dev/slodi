---
id: community-member-likes-and-shares
persona: Community Member
stories: [E4, J4]
shortcut: [sc-531]
specs: [efnissida]
test: frontend/e2e/journeys/community-member-likes-and-shares.journey.ts
gate: pr
---

# Community Member likes, then shares

Anna, a foringi from another troop, finds a leikur in the bank she wants to
keep. She likes it, then copies its link to send to her co-leaders. When she
opens the link herself, the item should look the same as when she left it:
liked by her, with a count that includes her.

E4 asks for a favourites button that "works", so that something saved can be
found again. J4 asks for sharing beyond the editing team. Social proof only
helps if a link shows the same count as the bank does (Journey 3, step 4 in
the persona doc).

Source: Journey 2 (Community Member) in
[`frontend/program-detail-page-improvements.md`](../frontend/program-detail-page-improvements.md#-user-journeys),
steps 1, 4 and 6.

## Steps

| Step | Anna… | She expects… |
|---|---|---|
| S1 | opens the dagskrárbanki and finds "Hnútakeppni" | its card, with a like count of 0 |
| S2 | likes it from the card | the heart filled and the count at 1, immediately |
| S3 | opens the item | `Taka rokkstig til baka` (filled, pressed) and the count at 1 |
| S4 | presses `Deila verkefni` and copies the link | the link on her clipboard |
| S5 | opens the link in a new tab | `Taka rokkstig til baka` (filled, pressed) and the count at 1 |
| S6 | opens the link signed out, in a fresh browser _(as a Public Visitor; manual)_ | the count at 1, and the rokkstig button disabled with "Skráðu þig inn til að gefa rokkstig" |

## What it guards

- **sc-531.** Likes show 0 on a direct link: S5 and S6 open the item with no
  bank page loaded first, which is where `LikesContext` had nothing cached.
  - Before the fix, S5 failed: the new tab showed the item as not liked, with 0. The
    item page registered the like as (not liked, 0) before the item had
    loaded, and `initLike` kept the first value it got.
  - Now `LikesContext` registers only like data that came from the server,
    lets each later server value replace the stored one, and holds back only
    while the reader's own toggle is in flight. After a toggle it re-fetches
    the item past the browser cache, so a link opened in a new tab within the
    minute `/content/{id}` is cacheable does not get the pre-like copy.
  - S5 is a normal `step`.
- efnissida `SPEC.md`: `Gefa rokkstig` (♡ + count) and `Deila` on the item page; a
  signed-out rokkstig button is disabled with its reason, never hidden. The
  like action is called rokkstig everywhere (decision 2026-10-12), so the card
  and the item page name the button the same way, count included.

## Fixture

`backend/scripts/seed_e2e.py`: task `…00a2`, "Hnútakeppni", authored by
`e2e|program-owner`, with no likes. Anna is `e2e|community-member`. S6 uses a
browser context with no session.

## Automation notes

S4 grants `clipboard-read` and `clipboard-write`, and hides Web Share, so
`Deila` takes the clipboard path (and its "Hlekkur afritaður!" alert) on every
runner. S2 also waits for the like to reach the server, not just the
optimistic heart.

S6 needs `/programs/<id>` to be readable signed out. Today
`lib/route-access.ts` makes it private, so S6 stays _(manual)_ until there is a
decision on public item pages. The test records it with `manualStep`, and the
report shows the journey as "passing, some steps manual" rather than proven.
