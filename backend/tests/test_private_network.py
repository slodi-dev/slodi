"""Content may not reference localhost or private-network URLs.

Such a URL makes Chrome ask every visitor of slodi.is for local network access.
See app/domain/private_network.py.
"""

import pytest
from pydantic import ValidationError

from app import models as m
from app import schemas as s
from app.domain.private_network import (
    check_public_media,
    is_private_network_host,
    is_private_network_url,
)
from app.schemas.group import GroupCreate, GroupOut, GroupUpdate
from app.schemas.program import ProgramUpdate

PRIVATE = [
    "http://localhost:8000/x.png",
    "http://LOCALHOST./x.png",
    "http://api.localhost/x.png",
    "http://printer.local/x.png",
    "http://127.0.0.1/x.png",
    "http://127.1/x.png",
    "http://0x7f.0.0.1/x.png",
    "http://2130706433/x.png",
    "http://0.0.0.0/x.png",
    "http://10.1.2.3/x.png",
    "http://172.16.0.1/x.png",
    "http://172.31.255.255/x.png",
    "http://192.168.1.1/x.png",
    "http://169.254.169.254/latest",
    "http://100.64.0.1/x.png",
    "http://[::1]/x.png",
    "http://[::]/x.png",
    "http://[fc00::1]/x.png",
    "http://[fd12:3456::1]/x.png",
    "http://[fe80::1]/x.png",
    "http://[::ffff:127.0.0.1]/x.png",
    "http://user:pw@192.168.0.1:8080/x.png",
]

PUBLIC = [
    "https://slodiblobstorage.blob.core.windows.net/content-images/images/a.png",
    "https://example.com/x.png",
    "https://localhost.example.com/x.png",
    "http://172.15.0.1/x.png",
    "http://172.32.0.1/x.png",
    "http://8.8.8.8/x.png",
    "http://[2001:db8::1]/x.png",
    "http://[::ffff:8.8.8.8]/x.png",
    "http://123abc.example/x.png",
    "/relative/local.png",
    "data:image/png;base64,AAAA",
    "",
    "not a url",
    "http://[broken/x.png",
]


@pytest.mark.parametrize("url", PRIVATE)
def test_private_urls_are_flagged(url: str) -> None:
    assert is_private_network_url(url)


@pytest.mark.parametrize("url", PUBLIC)
def test_public_urls_pass(url: str) -> None:
    assert not is_private_network_url(url)


def test_host_check_handles_brackets_and_zone_ids() -> None:
    assert is_private_network_host("[::1]")
    assert is_private_network_host("fe80::1%eth0")
    assert not is_private_network_host("")


def test_content_create_refuses_private_hero_image() -> None:
    with pytest.raises(ValidationError, match="private network"):
        s.ProgramCreate(
            name="Leikur",
            content_type=m.ContentType.program,
            image="http://192.168.1.10/mynd.jpg",
        )


def test_content_update_refuses_private_media_image() -> None:
    with pytest.raises(ValidationError, match="private network"):
        ProgramUpdate(media={"images": [{"url": "http://localhost:3000/a.png"}]})


def test_content_refuses_private_document_url() -> None:
    with pytest.raises(ValidationError):
        s.TaskCreate(
            name="Verkefni",
            content_type=m.ContentType.task,
            media={"documents": [{"url": "http://10.0.0.5/skjal.pdf", "name": "x"}]},
        )


def test_content_accepts_blob_and_public_urls() -> None:
    blob = "https://slodiblobstorage.blob.core.windows.net/content-images/images/a.png"
    p = s.ProgramCreate(
        name="Leikur",
        content_type=m.ContentType.program,
        image=blob,
        media={"images": [{"url": blob}, {"url": "https://example.com/b.png"}]},
    )
    assert p.image == blob


def test_reading_existing_private_image_still_works() -> None:
    """Output schemas are not validated, so old rows stay readable."""
    out = GroupOut(
        id="00000000-0000-0000-0000-000000000001", name="Hópur", image="http://localhost/x"
    )
    assert out.image == "http://localhost/x"


def test_group_create_and_update_refuse_private_image() -> None:
    with pytest.raises(ValidationError):
        GroupCreate(name="Hópur", image="http://127.0.0.1/x.png")
    with pytest.raises(ValidationError):
        GroupUpdate(image="http://[::1]/x.png")
    assert GroupUpdate(image="https://example.com/x.png").image == "https://example.com/x.png"


def test_media_shapes_that_carry_no_url_pass() -> None:
    assert check_public_media(None) is None
    assert check_public_media({"images": "nope", "other": [1]}) == {"images": "nope", "other": [1]}
    assert check_public_media({"images": [None, 3, {"alt": "x"}]}) is not None
