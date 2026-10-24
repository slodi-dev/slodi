"""Length limits for a content report, and which reasons a comment can be
reported for.

Shared by the model and the schemas so the database and the API cannot disagree
about what fits.
"""

from app.domain.enums import ReportReason

COMMENT_REPORT_REASONS = frozenset(
    {ReportReason.inappropriate, ReportReason.unsafe, ReportReason.spam, ReportReason.other}
)
"""`duplicate` and `wrong_type` describe an item in the bank; a comment can be
neither."""

NOTE_MAX = 500
"""What the reporter writes. Long enough to explain, short enough to read in a
sweep of fifty."""

RESOLUTION_NOTE_MAX = 500
"""What the reviewer writes when closing it."""
