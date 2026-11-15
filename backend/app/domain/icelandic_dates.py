"""Dates as Icelandic writes them: `14. september 2026`, months lowercase."""

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
    day = value.date() if isinstance(value, dt.datetime) else value
    return f"{day.day}. {MONTHS[day.month - 1]} {day.year}"
