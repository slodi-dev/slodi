# What you can put in the dagskrárbanki

Four kinds of thing, and the difference between them is **what they contain**.
Everything else about them — the name, the description, the age groups, the
equipment list — is the same.

| Kind | It is | It contains |
|---|---|---|
| **Verkefni** | a single dagskrárliður | nothing |
| **Fundur** | one skátafundur | verkefni |
| **Dagskrárhringur** | a programme over a period | fundir |
| **Viðburður** | something spanning several days | verkefni |

Read as a sentence: a **verkefni** is one thing you do. A **fundur** is a
collection of verkefni. A **dagskrárhringur** is a selection of fundir. A
**viðburður** is also a collection of verkefni, but spread over several days
rather than one evening — a útilega, a mót, a dagsferð.

So there are two collections of verkefni, and the thing that separates them is
time, not structure: a fundur happens once, a viðburður runs across days.

## Why the distinction is the whole design

The four names do not explain themselves. A leikur is a **verkefni**, not a
**dagskrárhringur**, and nothing about the words says so. This is why every
option in the create chooser carries a second line saying what it is for, and
why that hint line is not decoration that can be dropped on a narrow screen —
without it a new foringi files a leikur as a dagskrárhringur, and the bank
fills up with mis-classified content that somebody has to sort out by hand
later. That has already happened once (sc-129, Program → Task).

## September 2026: only Verkefni

**All four appear in the chooser. Only Verkefni can be created.** The other
three are visible and disabled, because a leader needs to know the bank will
hold their fundur eventually — a chooser with one option says the bank only
ever does one thing.

The reason the other three are disabled is the same for all of them: they are
collections, and **there is no way to put anything into a collection yet**. No
screen calls `POST /programs/{id}/events` or its equivalents. So creating one
today produces an empty container that its author cannot fill and a reviewer
cannot judge. Offering that is worse than not offering it.

They switch on when the child picker exists — one per kind, in this order:

1. **Fundur** — the smallest collection, and the one leaders ask for most.
2. **Viðburður** — same picker as fundur plus a span in days.
3. **Dagskrárhringur** — needs fundir to exist first, so it comes last. This is
   also the one that overlaps Vinnubekkurinn, and the two should not end up as
   two different ideas with one name.

## How this maps to what is in the database today

The code predates this vocabulary and does not match it:

| This document | `ContentType` today | Note |
|---|---|---|
| Verkefni | `task` | matches |
| Fundur | — | no type; `program` is the closest thing |
| Dagskrárhringur | — | related to `Season` on the planner track |
| Viðburður | `event` | matches, but is a single occurrence, not a span |

`program` is currently doing duty as "a collection of content" without saying
whether it is a fundur or a dagskrárhringur, which is exactly the ambiguity
this document exists to remove. Splitting it is a migration and a decision
about Vinnubekkurinn's `Season`, so it is **not** September work — but nothing
new should be built on `program` in the meantime.

`Event.start_dt` is nullable precisely because a bank viðburður is a *template*:
somebody may run it in March or in September, and stamping it with the date it
was written makes it sort as though it had already happened.
