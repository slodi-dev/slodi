---
id: community-member-likes-and-shares
persona: Community Member
stories: [E4, J4]
shortcut: [sc-531]
specs: [efnissida]
test: none
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
| S3 | opens the item | `Líkar` filled and the count at 1 |
| S4 | presses `Deila verkefni` and copies the link | the link on her clipboard |
| S5 | opens the link in a new tab | `Líkar` filled and the count at 1 |
| S6 | opens the link signed out, in a fresh browser _(as a Public Visitor)_ | the count at 1, and `Líkar` disabled with "Skráðu þig inn til að líka við" |

## What it guards

- **sc-531.** Likes show 0 on a direct link: S5 and S6 open the item with no
  bank page loaded first, which is where `LikesContext` had nothing cached.
- efnissida `SPEC.md`: `Líkar` (♡ + count) and `Deila` on the item page; a
  signed-out `Líkar` is disabled with its reason, never hidden.

## Fixture

`backend/scripts/seed_e2e.py`: task `…00a2`, "Hnútakeppni", authored by
`e2e|program-owner`, with no likes. Anna is `e2e|community-member`. S6 uses a
browser context with no session.

## Automation notes

S4 needs `context.grantPermissions(["clipboard-read", "clipboard-write"])` in
Chromium. S6 needs `/programs/<id>` to be readable signed out. Today
`lib/route-access.ts` makes it private, so S6 stays _(manual)_ until there is a
decision on public item pages.
