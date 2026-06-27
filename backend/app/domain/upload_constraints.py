from typing import Final

# How long an issued upload SAS token stays valid.
SAS_TTL_MINUTES: Final[int] = 15

# Per-purpose MIME allowlist. A SAS is only issued for content types listed here.
ALLOWED_MIME_TYPES: Final[dict[str, frozenset[str]]] = {
    "image": frozenset(
        {
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
        }
    ),
    "document": frozenset(
        {
            "application/pdf",
        }
    ),
}
