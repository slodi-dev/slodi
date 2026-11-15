"""What each template is for and the sample data its preview is rendered with."""

from __future__ import annotations

from typing import Any

TEMPLATE_INFO: list[dict[str, Any]] = [
    {
        "name": "welcome",
        "description": "New user onboarding email",
        "variables": ["user_name", "login_url"],
    },
    {
        "name": "workspace_invite",
        "description": "Workspace invitation",
        "variables": ["inviter_name", "workspace_name", "personal_note", "accept_url"],
    },
    {
        "name": "newsletter",
        "description": "Block-based newsletter",
        "variables": ["subject", "preheader", "blocks"],
    },
    {
        "name": "new_feature",
        "description": "Feature announcement",
        "variables": [
            "feature_name",
            "feature_description",
            "feature_image",
            "feature_details",
            "cta_label",
            "cta_url",
        ],
    },
]

PREVIEW_DATA: dict[str, dict[str, Any]] = {
    "welcome": {
        "user_name": "Jón Jónsson",
        "login_url": "https://slodi.is",
    },
    "workspace_invite": {
        "inviter_name": "Anna Sigurðardóttir",
        "workspace_name": "Úlfar sveitin",
        "personal_note": "Vertu velkomin\ní hópinn!",
        "accept_url": "https://slodi.is",
    },
    "newsletter": {
        "subject": "Fréttabréf Slóða",
        "preheader": "Nýjustu fréttir frá Slóða",
        "blocks": [
            {"type": "heading", "text": "Velkomin í fréttabréfið"},
            {
                "type": "text",
                "text": (
                    "Hér eru nýjustu fréttir og uppfærslur frá Slóða. "
                    "Við höfum verið að vinna hörðum höndum að nýjum eiginleikum."
                ),
            },
            {
                "type": "image",
                "src": "https://placehold.co/600x300",
                "alt": "Slóði forsíðumynd",
            },
            {
                "type": "feature_card",
                "title": "Nýtt viðburðakerfi",
                "description": "Skipuleggðu viðburði og skráðu þátttakendur á einfaldan hátt.",
            },
            {"type": "divider"},
            {
                "type": "cta",
                "label": "Skoða á Slóða",
                "url": "https://slodi.is",
            },
        ],
    },
    "new_feature": {
        "feature_name": "Viðburðadagatal",
        "feature_description": (
            "Nýtt viðburðadagatal gerir þér kleift að sjá alla viðburði á einum stað "
            "og skipuleggja starf sveitarinnar á skilvirkan hátt."
        ),
        "feature_image": "https://placehold.co/600x300",
        "feature_details": [
            "Skoðaðu alla viðburði í mánaðar- eða vikuyfirliti",
            "Skráðu þátttakendur beint úr dagatalinu",
            "Deildu viðburðum með foreldrum og leiðtogum",
        ],
        "cta_label": "Skoða",
        "cta_url": "https://slodi.is",
    },
}
