"""Length limit for a reviewer's note.

Shared by the model and the schemas so the database and the API cannot disagree
about what fits.
"""

BODY_MAX = 2000
"""Long enough for a real suggestion — what to change and why — and short enough
that a pane full of them is still readable."""
