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
    # Documents a foringi actually has: a printed leiðbeining, a Word file
    # from a course, a plain-text list. Deliberately NOT text/html or
    # image/svg+xml — both carry script, and a blob URL is same-origin enough
    # for that to matter even though downloads force `Content-Disposition:
    # attachment`. Nobody asked for them, so they stay out.
    "document": frozenset(
        {
            "application/pdf",
            "application/msword",  # .doc
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
            "text/plain",  # .txt, and .md from browsers that do not know it
            "text/markdown",  # .md
        }
    ),
}
