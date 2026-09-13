"""Length limits for a content report.

Shared by the model and the schemas so the database and the API cannot disagree
about what fits.
"""

NOTE_MAX = 500
"""What the reporter writes. Long enough to explain, short enough to read in a
sweep of fifty."""

RESOLUTION_NOTE_MAX = 500
"""What the reviewer writes when closing it."""
