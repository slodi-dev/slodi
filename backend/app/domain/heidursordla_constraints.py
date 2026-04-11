"""
Heiðursorðla domain constants.

Owns the constants that the model, service, repository, router, and migration
all need to agree on. Importing values from here keeps them in lockstep — no
magic numbers scattered across files.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path
from zoneinfo import ZoneInfo

# ── Game shape ─────────────────────────────────────────────────────────────

WORD_LENGTH = 5
"""Length of every Heiðursorðla puzzle answer (and every valid guess)."""

MAX_GUESSES = 6
"""Maximum number of guesses a player gets per puzzle."""


# ── Dictionary file ────────────────────────────────────────────────────────

DICTIONARY_PATH: Path = (
    Path(__file__).resolve().parent.parent / "data" / "icelandic_5_letter_words.txt"
)
"""Filesystem path to the static valid-guess dictionary committed in the repo.

Generated from BÍN via the islenska package — see
``backend/scripts/generate_heidursordla_dictionary.py`` and
``backend/app/data/NOTICE.md``. The runtime backend has no islenska dependency:
this file is the entire dictionary, loaded into a frozenset at startup.
"""


# ── Event window (Saturday-only Skátaþing 2026) ────────────────────────────

ICELAND_TZ = ZoneInfo("Atlantic/Reykjavik")
"""The single timezone Heiðursorðla uses for every cadence calculation."""

EVENT_END_AT: dt.datetime = dt.datetime(2026, 4, 12, 0, 0, 0, tzinfo=ICELAND_TZ)
"""Sunday 12 April 2026 00:00 Atlantic/Reykjavik — the moment the event closes.

After this timestamp the API enters archive mode: ``/today`` returns
``{event_ended: True, leaderboards: [...]}`` and ``/{puzzle_id}/guess``
returns HTTP 410 Gone. The frontend renders a "Skátaþingsorðlu er lokið"
view. There is no admin toggle for Phase 1.
"""


# ── Saturday round schedule (2h30+2h30+2h30+6h, 10:30 → 24:00) ─────────────
#
# Three back-to-back 2.5-hour rounds in the afternoon, plus one long 6-hour
# final round filling the rest of the day. At most one round is live at any
# moment. Outside the 10:30–24:00 window the index page renders only a
# countdown to the next 10:30 drop (or, after Saturday midnight, the
# event-ended archive view).

_SAT = dt.date(2026, 4, 11)


def _at(hour: int, minute: int = 0) -> dt.datetime:
    return dt.datetime.combine(_SAT, dt.time(hour, minute), tzinfo=ICELAND_TZ)


ROUND_1_UNLOCKS_AT = _at(10, 30)
ROUND_1_LOCKS_AT = _at(13, 0)
ROUND_2_UNLOCKS_AT = _at(13, 0)
ROUND_2_LOCKS_AT = _at(15, 30)
ROUND_3_UNLOCKS_AT = _at(15, 30)
ROUND_3_LOCKS_AT = _at(18, 0)
ROUND_4_UNLOCKS_AT = _at(18, 0)
ROUND_4_LOCKS_AT = EVENT_END_AT
"""Round 4 locks at midnight Saturday — i.e. Sunday 00:00 — which is the same
moment ``EVENT_END_AT`` triggers. They are deliberately the same instant so
the locked-puzzle countdown rolls straight into the event-ended archive view
without an interstitial gap.
"""
