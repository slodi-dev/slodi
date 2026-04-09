from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import css_inline
from jinja2 import Environment, FileSystemLoader, select_autoescape

ALLOWED_TEMPLATES: set[str] = {"welcome", "newsletter", "new_feature", "workspace_invite"}

_TEMPLATE_DIR = Path(__file__).resolve().parent
_TEXT_CONFIG_PATH = _TEMPLATE_DIR / "template_text.json"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html"]),
)


def _load_text_config() -> dict[str, dict[str, str]]:
    """Load editable text overrides from template_text.json."""
    if not _TEXT_CONFIG_PATH.exists():
        return {}
    result: dict[str, dict[str, str]] = json.loads(_TEXT_CONFIG_PATH.read_text(encoding="utf-8"))
    return result


def get_text_config() -> dict[str, dict[str, str]]:
    """Public accessor for the text config (used by API endpoints)."""
    return _load_text_config()


def save_text_config(config: dict[str, dict[str, str]]) -> None:
    """Write text config back to disk."""
    _TEXT_CONFIG_PATH.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def render(template_name: str, context: dict[str, Any]) -> str:
    """Render an email template and inline its CSS.

    1. Validate *template_name* against ALLOWED_TEMPLATES whitelist.
       Raise ``ValueError`` (→ 404) for unknown names.
    2. Load editable text from ``template_text.json`` and merge into context.
    3. Render the Jinja2 template with merged context.
    4. Inline CSS via ``css_inline.inline()``.
    5. Return the final HTML string.

    NOTE: Do **not** pass ``unsubscribe_url`` in *context*.
    The literal string ``{unsubscribe_url}`` (single braces) is kept intact
    through both Jinja2 rendering and CSS inlining.  The batch sender
    performs ``str.replace('{unsubscribe_url}', token_url)`` per recipient
    after this function returns.
    """
    if template_name not in ALLOWED_TEMPLATES:
        raise ValueError(
            f"Unknown email template: {template_name!r}. "
            f"Allowed templates: {sorted(ALLOWED_TEMPLATES)}"
        )

    # Merge editable text into context (template-specific + footer)
    text_config = _load_text_config()
    merged: dict[str, Any] = {}
    if "footer" in text_config:
        merged.update(text_config["footer"])
    if template_name in text_config:
        merged.update(text_config[template_name])
    merged.update(context)  # caller context wins over config defaults

    template = _env.get_template(f"{template_name}.html")
    html = template.render(**merged)
    inlined: str = css_inline.inline(html)
    return inlined
