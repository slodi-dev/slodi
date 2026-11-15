from app.domain.enums import ReportReason

# `duplicate` and `wrong_type` only make sense for an item.
COMMENT_REPORT_REASONS = frozenset(
    {ReportReason.inappropriate, ReportReason.unsafe, ReportReason.spam, ReportReason.other}
)

NOTE_MAX = 500
RESOLUTION_NOTE_MAX = 500
