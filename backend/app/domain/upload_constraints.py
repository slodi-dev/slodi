from typing import Final

# Per-purpose size ceiling, in bytes.
#
# **A blob SAS cannot enforce this.** It grants write permission for a window;
# the client then PUTs whatever it likes straight to Azure, and nothing in this
# codebase is in the path to stop it. So these numbers do two jobs: the
# frontend refuses an oversized file before wasting the upload, and this module
# is the single place the number is written down.
#
# Real enforcement would have to be after the fact — check the blob's length
# when the content record that references it is saved, and refuse the record
# (the blob is then an orphan for a cleanup job). That is worth doing before
# the bank is open to strangers; it is not done yet.
#
# Documents are generous on purpose: a scanned leiðbeining with photographs is
# legitimately 15–20 MB, and a limit that rejects real material teaches people
# the feature is broken.
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
            # OpenDocument — the ISO/IEC 26300 open standard, which is what
            # LibreOffice writes. Plenty of foringjar do not have Word, and a
            # bank that only takes Microsoft's formats quietly tells them to go
            # and buy it.
            "application/vnd.oasis.opendocument.text",  # .odt
            "application/vnd.oasis.opendocument.spreadsheet",  # .ods
            "application/vnd.oasis.opendocument.presentation",  # .odp
            # And the Microsoft equivalents, current and legacy. Accepting an
            # .ods while refusing an .xlsx is an arbitrary penalty on whoever
            # happens to use Excel — and the same goes for the old binary
            # formats, which is what a 2014 æfingaskjal is actually saved as.
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
            "application/vnd.ms-excel",  # .xls
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # .pptx
            "application/vnd.ms-powerpoint",  # .ppt
        }
    ),
}
