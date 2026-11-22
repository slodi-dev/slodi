---
id: program-owner-edits-from-bank
persona: Program Owner
stories: [B4, E2, E6]
shortcut: [sc-530]
specs: [efnissida]
test: frontend/e2e/journeys/program-owner-edits-from-bank.journey.ts
gate: pr
---

# Program Owner edits from the bank

Sigurður put a leikur in the dagskrárbanki with step-by-step leiðbeiningar and
a rules sheet attached. A week later he spots a clumsy title while browsing the
bank, fixes it from the card, and moves on. He expects the title to be the only
thing that changed.

The bank is only worth sharing to if what you put in stays put. B4 asks for
"copy-and-edit, never frozen", E2 for a bank worth searching, and E6 for
"ready-made, editable classics". An edit that silently drops the leiðbeiningar
breaks all three, and the author finds out only when someone else runs the
leikur without instructions.

Source: Journey 1 (Program Owner) in
[`frontend/program-detail-page-improvements.md`](../frontend/program-detail-page-improvements.md#-user-journeys),
steps 1, 2 and 6–7, applied to editing from the bank instead of from the item
page. Both entry points open the same `ContentCreateModal`.

## Steps

| Step | Sigurður… | He expects… |
|---|---|---|
| S1 | opens the dagskrárbanki and searches for his item | to see its card |
| S2 | opens `Breyta` on the card | the edit form, filled in with what he wrote |
| S3 | changes only the title (`Heiti hugmyndar`) and presses `Vista breytingar` | the form to close without an error |
| S4 | looks at the bank | the card to show the new title |
| S5 | opens the item | the new title, and the **leiðbeiningar he wrote, unchanged** |
| S6 | looks at the attachments | **`Leikreglur.pdf` still attached** |

## What it guards

- **sc-530** (fixed). Editing from a bank card wiped the leiðbeiningar and
  attached documents. The bank list returns `ContentListOut`, which has no
  `instructions` or `media`; the card passed that summary to the form as
  `initial`, and saving sent those fields back as cleared. The card now fetches
  the whole item before the editor opens, and an edit sends only the fields
  that changed. S5 (leiðbeiningar) and S6 (documents) guard it.
- efnissida `SPEC.md` §10 #9: `Breyta` is offered to the author. S2 checks it
  from the bank side.

## Fixture

`backend/scripts/seed_e2e.py`: task `…00a1`, "Fánaleikur í myrkri", authored by
`e2e|program-owner`, with three lines of instructions and one document.
