"""Dates as Icelandic writes them."""

import datetime as dt

import pytest

from app.domain.icelandic_dates import MONTHS, format_date


def test_a_date_reads_the_way_icelandic_writes_one():
    assert format_date(dt.date(2026, 9, 14)) == "14. september 2026"


def test_the_month_is_lowercase():
    """Icelandic does not capitalise month names. "14. September 2026" reads as
    an English sentence in Icelandic clothes."""
    assert all(m == m.lower() for m in MONTHS)
    assert format_date(dt.date(2026, 1, 1)) == "1. janúar 2026"


def test_the_day_is_not_padded():
    assert format_date(dt.date(2026, 9, 1)).startswith("1. ")


def test_a_datetime_is_reduced_to_its_day():
    assert format_date(dt.datetime(2026, 12, 24, 23, 59, tzinfo=dt.timezone.utc)) == (
        "24. desember 2026"
    )


@pytest.mark.parametrize("month,expected", list(enumerate(MONTHS, start=1)))
def test_every_month_has_a_name(month, expected):
    assert format_date(dt.date(2026, month, 15)) == f"15. {expected} 2026"
