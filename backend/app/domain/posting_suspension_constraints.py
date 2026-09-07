"""Limits for a posting suspension.

Shared by the model and the schemas so the database and the API cannot disagree.
"""

REASON_MAX = 500
"""Why someone was suspended, or why it was lifted early."""

MAX_DAYS = 3650
"""The longest a dated suspension may run.

Past ten years, "open-ended" is the honest word for what is meant — and that is
a separate choice a reviewer makes deliberately, not one they reach by typing a
large number.
"""
