import pytest

from app.settings import Settings

OTHER_ENV = {
    "ENV": "development",
    "DB_HOST": "db",
    "DB_PORT": "5432",
    "AUTH0_DOMAIN": "x.auth0.com",
    "AUTH0_AUDIENCE": "https://api.x",
    "AZURE_STORAGE_ACCOUNT": "x",
    "AZURE_STORAGE_KEY": "eA==",
    "AZURE_STORAGE_CONTAINER_IMAGES": "x",
    "AZURE_STORAGE_CONTAINER_DOCUMENTS": "x",
}


def _settings(monkeypatch: pytest.MonkeyPatch, **db: str) -> Settings:
    for key in (
        "POSTGRES_DB",
        "POSTGRES_USER",
        "POSTGRES_PASSWORD",
        "DB_NAME",
        "DB_USER",
        "DB_PASSWORD",
    ):
        monkeypatch.delenv(key, raising=False)
    for key, value in {**OTHER_ENV, **db}.items():
        monkeypatch.setenv(key, value)
    return Settings(_env_file=None)  # type: ignore[call-arg]


def test_reads_the_postgres_names(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _settings(monkeypatch, POSTGRES_DB="d", POSTGRES_USER="u", POSTGRES_PASSWORD="p")
    assert s.db_url == "postgresql+psycopg://u:p@db:5432/d"


def test_still_reads_the_old_names(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _settings(monkeypatch, DB_NAME="d", DB_USER="u", DB_PASSWORD="p")
    assert s.db_url == "postgresql+psycopg://u:p@db:5432/d"


def test_the_postgres_names_win(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _settings(
        monkeypatch, POSTGRES_DB="d", POSTGRES_USER="u", POSTGRES_PASSWORD="p", DB_PASSWORD="old"
    )
    assert s.db_password == "p"
