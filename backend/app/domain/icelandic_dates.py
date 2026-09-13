"""Dates as Icelandic writes them.

`14. september 2026` — day, month spelled out, year. **Month names are
lowercase**: Icelandic does not capitalise them, and "14. September 2026" reads
as an English sentence in Icelandic clothes.

Spelled out here rather than left to `locale`: the casing is a rule about the
language, not a formatting preference, and it should not depend on which locales
happen to be installed in a container.
"""

from __future__ import annotations

import datetime as dt

MONTHS = (
    "janúar",
    "febrúar",
    "mars",
    "apríl",
    "maí",
    "júní",
    "júlí",
    "ágúst",
    "september",
    "október",
    "nóvember",
    "desember",
)


def format_date(value: dt.date | dt.datetime) -> str:
    """`14. september 2026`. The day is not zero-padded."""
    day = value.date() if isinstance(value, dt.datetime) else value
    return f"{day.day}. {MONTHS[day.month - 1]} {day.year}"
