from __future__ import annotations

import json
from functools import cache
from pathlib import Path
from typing import Any, Literal, get_args

import css_inline
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

TemplateName = Literal["welcome", "newsletter", "new_feature", "workspace_invite"]
ALLOWED_TEMPLATES: frozenset[str] = frozenset(get_args(TemplateName))

_TEMPLATE_DIR = Path(__file__).resolve().parent

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html"]),
)


@cache
def _text_config() -> dict[str, dict[str, str]]:
    """The editable wording in template_text.json; changed in git, read once per process."""
    result: dict[str, dict[str, str]] = json.loads(
        (_TEMPLATE_DIR / "template_text.json").read_text(encoding="utf-8")
    )
    return result


class _KeepMissing(dict[str, Any]):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


def _fill(wording: str, context: dict[str, Any]) -> Markup:
    """Wording may hold HTML (it is in git); `{name}` gets the context value, escaped.
    Placeholders without a value, such as `{unsubscribe_url}`, are left for the sender."""
    return Markup(wording).format_map(_KeepMissing(context))


def render(template_name: str, context: dict[str, Any]) -> str:
    """Render a template with its wording from template_text.json and inline the CSS.

    `{unsubscribe_url}` is left as is; the sender fills it in per recipient.
    """
    if template_name not in ALLOWED_TEMPLATES:
        raise ValueError(f"Unknown email template: {template_name!r}")

    text = _text_config()
    wording = {
        key: _fill(value, context)
        for key, value in {**text.get("footer", {}), **text.get(template_name, {})}.items()
    }
    merged: dict[str, Any] = {**wording, **context}
    inlined: str = css_inline.inline(_env.get_template(f"{template_name}.html").render(**merged))
    return inlined
