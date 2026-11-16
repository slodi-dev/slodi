from __future__ import annotations

from .content import Content, ContentType


class Season(Content):
    __mapper_args__ = {"polymorphic_identity": ContentType.season}
