from typing import Final

# The frontend checks before upload; AttachmentVerifier checks again when an item is saved.
MAX_UPLOAD_BYTES: Final[dict[str, int]] = {
    "image": 10 * 1024 * 1024,  # 10 MB — a phone photo is 3–8 MB
    "document": 25 * 1024 * 1024,  # 25 MB
}

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
    # No text/html or image/svg+xml: both can carry script.
    "document": frozenset(
        {
            "application/pdf",
            "application/msword",  # .doc
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
            "text/plain",  # .txt, and .md from browsers that do not know it
            "text/markdown",  # .md
            "application/vnd.oasis.opendocument.text",  # .odt
            "application/vnd.oasis.opendocument.spreadsheet",  # .ods
            "application/vnd.oasis.opendocument.presentation",  # .odp
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
            "application/vnd.ms-excel",  # .xls
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # .pptx
            "application/vnd.ms-powerpoint",  # .ppt
        }
    ),
}
