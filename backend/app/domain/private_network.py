"""Refuse content URLs that point at a visitor's own machine or local network.

A picture hosted on ``http://192.168.1.20/…`` or ``http://localhost:3000/…``
shows nobody but its author anything, and on slodi.is it makes Chrome ask every
visitor for "local network access" (Chrome's Local Network Access prompt). The
frontend drops such URLs when rendering (``frontend/lib/private-network.ts``);
this keeps new ones from being saved at all.

Only the host is judged, by its spelling. A public name that *resolves* to a
private address is not caught here; the site's Permissions-Policy header is
what stops the browser from following it.
"""

from __future__ import annotations

import ipaddress
import re
import socket
from typing import Any
from urllib.parse import urlsplit

_PRIVATE_V4 = [
    ipaddress.ip_network(n)
    for n in (
        "0.0.0.0/8",  # Chrome treats 0.0.0.0 as this machine
        "10.0.0.0/8",
        "100.64.0.0/10",  # carrier-grade NAT
        "127.0.0.0/8",
        "169.254.0.0/16",
        "172.16.0.0/12",
        "192.168.0.0/16",
    )
]
_PRIVATE_V6 = [ipaddress.ip_network(n) for n in ("::/128", "::1/128", "fc00::/7", "fe80::/10")]

# What a browser's URL parser reads as an IPv4 address: dot-separated decimal,
# hex or octal parts, as in 127.1, 0x7f.0.0.1 or 2130706433.
_IPV4_LIKE = re.compile(r"^(0x[0-9a-f]*|[0-9]+)(\.(0x[0-9a-f]*|[0-9]+)){0,3}\.?$", re.I)


def _is_private_ip(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if isinstance(addr, ipaddress.IPv6Address):
        if addr.ipv4_mapped is not None:
            return _is_private_ip(addr.ipv4_mapped)
        return any(addr in net for net in _PRIVATE_V6)
    return any(addr in net for net in _PRIVATE_V4)


def is_private_network_host(host: str) -> bool:
    """True for localhost, ``*.local`` and private/loopback/link-local IPs."""
    host = host.strip().lower().rstrip(".")
    if host.startswith("[") and host.endswith("]"):
        host = host[1:-1]
    if not host:
        return False
    if host == "localhost" or host.endswith((".localhost", ".local")):
        return True
    try:
        return _is_private_ip(ipaddress.ip_address(host.split("%", 1)[0]))
    except ValueError:
        pass
    if _IPV4_LIKE.match(host):
        # inet_aton accepts the same short and hex forms browsers do.
        try:
            return _is_private_ip(ipaddress.IPv4Address(socket.inet_aton(host)))
        except OSError:
            return False
    return False


def is_private_network_url(url: str) -> bool:
    """True if ``url`` is absolute and its host is a private-network host."""
    try:
        host = urlsplit(url.strip()).hostname
    except ValueError:
        return False
    return bool(host) and is_private_network_host(host or "")


PRIVATE_URL_MESSAGE = (
    "URL points at a local or private network address and would not load for anyone else"
)


def check_public_url(url: str | None) -> str | None:
    """Pydantic-style validator body: return ``url`` or raise ValueError."""
    if url and is_private_network_url(url):
        raise ValueError(PRIVATE_URL_MESSAGE)
    return url


def check_public_media(media: dict[str, Any] | None) -> dict[str, Any] | None:
    """Refuse a ``media`` dict whose images or documents use a private URL."""
    if not isinstance(media, dict):
        return media
    for key in ("images", "documents"):
        entries = media.get(key)
        if not isinstance(entries, list):
            continue
        for entry in entries:
            url = entry.get("url") if isinstance(entry, dict) else entry
            if isinstance(url, str):
                check_public_url(url)
    return media
