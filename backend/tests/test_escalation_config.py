"""An `unsafe` report that emails nobody should be loud at boot."""

import logging
from unittest.mock import patch

from app.main import create_app


def test_booting_without_moderation_recipients_says_so(caplog):
    """The failure is otherwise one log line per dropped escalation, noticed
    when somebody asks why the alias never heard about something."""
    with (
        caplog.at_level(logging.ERROR),
        patch("app.settings.settings.moderation_emails", ""),
        patch("app.settings.settings.admin_emails", ""),
    ):
        create_app()

    assert any("MODERATION_EMAILS" in r.message for r in caplog.records)


def test_a_configured_deployment_is_silent(caplog):
    with (
        caplog.at_level(logging.ERROR),
        patch("app.settings.settings.moderation_emails", "dagskra@skatarnir.is"),
    ):
        create_app()

    assert not any("MODERATION_EMAILS" in r.message for r in caplog.records)


def test_healthz_reports_whether_escalation_can_reach_anybody():
    """So it is visible to whatever watches the deployment, not only at boot."""
    from fastapi.testclient import TestClient

    with patch("app.settings.settings.moderation_emails", "dagskra@skatarnir.is"):
        body = TestClient(create_app()).get("/healthz").json()
    assert body["unsafe_escalation"] is True

    with (
        patch("app.settings.settings.moderation_emails", ""),
        patch("app.settings.settings.admin_emails", ""),
    ):
        body = TestClient(create_app()).get("/healthz").json()
    assert body["unsafe_escalation"] is False
