"""The e2e signing-key switch (AUTH_TEST_JWKS_FILE) cannot reach production.

Journey tests sign their own access tokens and point the backend at the
matching public keys. These tests pin the two properties that make that safe:

1. Settings refuses to load when the switch is set outside ENV=e2e, so a
   production process with it set never starts.
2. With the switch on, tokens are still verified in full: a token signed by any
   other key, or carrying the wrong audience, is rejected.
"""

import base64
import json
import time
from pathlib import Path
from typing import Any

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from jose import jwt
from pydantic import ValidationError

from app.core import auth
from app.settings import Settings

BASE_ENV: dict[str, str] = {
    "DB_NAME": "x",
    "DB_USER": "x",
    "DB_PASSWORD": "x",
    "DB_HOST": "localhost",
    "DB_PORT": "5432",
    "AUTH0_DOMAIN": "e2e.slodi.invalid",
    "AUTH0_AUDIENCE": "https://api.e2e.slodi.invalid",
    "AZURE_STORAGE_ACCOUNT": "x",
    "AZURE_STORAGE_KEY": "eA==",
    "AZURE_STORAGE_CONTAINER_IMAGES": "x",
    "AZURE_STORAGE_CONTAINER_DOCUMENTS": "x",
}


def _settings(**overrides: str) -> Settings:
    return Settings(_env_file=None, **{**BASE_ENV, **overrides})  # type: ignore[call-arg]


# ── 1. The guard ──────────────────────────────────────────────────────────────


@pytest.mark.parametrize("env", ["production", "Production", "prod", "staging", "development", ""])
def test_refuses_to_load_outside_e2e(env: str) -> None:
    with pytest.raises(ValidationError, match="AUTH_TEST_JWKS_FILE"):
        _settings(ENV=env, AUTH_TEST_JWKS_FILE="/tmp/jwks.json")


def test_refuses_to_load_in_production_via_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """The same guard, reached the way a deployed process reads its config."""
    for key, value in BASE_ENV.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("AUTH_TEST_JWKS_FILE", "/tmp/jwks.json")
    with pytest.raises(ValidationError, match="only accepted when ENV is one of"):
        Settings(_env_file=None)  # type: ignore[call-arg]


def test_loads_in_e2e() -> None:
    assert _settings(ENV="e2e", AUTH_TEST_JWKS_FILE="/tmp/jwks.json").auth_test_jwks_file


def test_off_by_default_in_production() -> None:
    assert _settings(ENV="production").auth_test_jwks_file is None


# ── 2. Verification is unchanged ──────────────────────────────────────────────


def _b64(n: int) -> str:
    raw = n.to_bytes((n.bit_length() + 7) // 8, "big")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _keypair(kid: str) -> tuple[bytes, dict[str, str]]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    numbers = key.public_key().public_numbers()
    jwk = {"kty": "RSA", "kid": kid, "use": "sig", "alg": "RS256"}
    jwk |= {"n": _b64(numbers.n), "e": _b64(numbers.e)}
    return pem, jwk


def _token(pem: bytes, kid: str, **claims: Any) -> str:
    now = int(time.time())
    payload = {
        "sub": "e2e|program-owner",
        "aud": BASE_ENV["AUTH0_AUDIENCE"],
        "iss": f"https://{BASE_ENV['AUTH0_DOMAIN']}/",
        "iat": now,
        "exp": now + 600,
        "email": "owner@e2e.example.com",
    } | claims
    return jwt.encode(payload, pem.decode(), algorithm="RS256", headers={"kid": kid})


@pytest.fixture
def e2e_auth(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> bytes:
    """Point the module under test at a freshly generated test JWKS."""
    pem, jwk = _keypair("e2e-test")
    jwks_file = tmp_path / "jwks.json"
    jwks_file.write_text(json.dumps({"keys": [jwk]}))
    test_settings = _settings(ENV="e2e", AUTH_TEST_JWKS_FILE=str(jwks_file))
    monkeypatch.setattr(auth, "settings", test_settings)
    monkeypatch.setattr(auth, "jwks_cache", auth.JWKSCache())
    return pem


def test_accepts_token_signed_by_test_key(e2e_auth: bytes) -> None:
    payload = auth.verify_auth0_token(_token(e2e_auth, "e2e-test"))
    assert payload.sub == "e2e|program-owner"


def test_rejects_token_signed_by_another_key(e2e_auth: bytes) -> None:
    other_pem, _ = _keypair("e2e-test")
    with pytest.raises(HTTPException) as exc:
        auth.verify_auth0_token(_token(other_pem, "e2e-test"))
    assert exc.value.status_code == 401


def test_rejects_wrong_audience(e2e_auth: bytes) -> None:
    with pytest.raises(HTTPException) as exc:
        auth.verify_auth0_token(_token(e2e_auth, "e2e-test", aud="https://elsewhere"))
    assert exc.value.status_code == 401


def test_rejects_expired_token(e2e_auth: bytes) -> None:
    past = int(time.time()) - 3600
    with pytest.raises(HTTPException) as exc:
        auth.verify_auth0_token(_token(e2e_auth, "e2e-test", iat=past - 600, exp=past))
    assert exc.value.status_code == 401
