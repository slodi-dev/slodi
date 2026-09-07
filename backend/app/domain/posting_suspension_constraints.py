"""Limits for a posting suspension.

Shared by the model and the schemas so the database and the API cannot disagree.
"""

REASON_MAX = 500
"""Why someone was suspended, or why it was lifted early."""

MODERATOR_MAX_DAYS = 90
"""The longest a `moderator` may suspend someone for.

Beyond a season is a judgement about somebody's place in the movement rather
than about one piece of content, and that belongs to an admin.
"""
