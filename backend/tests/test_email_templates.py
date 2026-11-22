import pytest

from app.core.email_templates.catalog import PREVIEW_DATA as _PREVIEW_DATA
from app.core.email_templates.renderer import ALLOWED_TEMPLATES, _text_config, render


def test_the_wording_file_is_valid_json():
    _text_config.cache_clear()
    assert set(_text_config()) >= {"footer"}


@pytest.mark.parametrize("name", sorted(ALLOWED_TEMPLATES))
def test_every_template_renders_with_its_preview_data(name):
    html = render(name, dict(_PREVIEW_DATA[name]))
    assert "<html" in html


def test_wording_placeholders_are_filled_in_and_escaped():
    html = render("welcome", {"user_name": "Jón <b>"})
    assert "{user_name}" not in html
    assert "Jón &lt;b&gt;" in html


def test_wording_may_hold_html_and_keeps_the_unsubscribe_placeholder():
    html = render(
        "workspace_invite", {"inviter_name": "Anna", "workspace_name": "Úlfar", "accept_url": "x"}
    )
    assert "<strong>Úlfar</strong>" in html
    assert "{unsubscribe_url}" in render("newsletter", {"subject": "s", "blocks": []})
