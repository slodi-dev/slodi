from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _split_emails(raw: str) -> list[str]:
    return [e.strip().lower() for e in raw.split(",") if e.strip()]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Environment configuration
    env: str = Field(..., alias="ENV")

    # Production database configuration
    db_name: str = Field(..., alias="DB_NAME")
    db_user: str = Field(..., alias="DB_USER")
    db_password: str = Field(..., alias="DB_PASSWORD")
    db_port: str = Field(..., alias="DB_PORT")
    db_host: str = Field(..., alias="DB_HOST")
    logger_level: str = Field("INFO", alias="LOGGER_LEVEL")
    logger_file: str | None = Field(None, alias="LOGGER_FILE")
    db_url: str = ""

    # Auth0 configuration
    auth0_domain: str = Field(..., alias="AUTH0_DOMAIN")
    auth0_audience: str = Field(..., alias="AUTH0_AUDIENCE")
    auth0_algorithms: list[str] = Field(["RS256"], alias="AUTH0_ALGORITHMS")
    auth_debug: bool = Field(False, alias="AUTH0_DEBUG")

    # Journey tests only: replaces Auth0's signing keys, allowed only when ENV is e2e
    auth_test_jwks_file: str | None = Field(None, alias="AUTH_TEST_JWKS_FILE")

    # Seed: emails promoted to admin / moderator on `make seed`
    admin_emails: str = Field("", alias="ADMIN_EMAILS")
    moderator_emails: str = Field("", alias="MODERATOR_EMAILS")
    # Unsafe-report escalation; falls back to ADMIN_EMAILS
    moderation_emails: str = Field("", alias="MODERATION_EMAILS")

    # Game run token signing key, required outside development
    game_token_secret: str = Field("", alias="GAME_TOKEN_SECRET")

    # Feature flags
    heidursordla_enabled: bool = Field(False, alias="HEIDURSORDLA_ENABLED")

    # CORS configuration
    cors_origins: list[str] = Field(["http://localhost:3000"], alias="CORS_ORIGINS")

    # Resend (email) configuration
    resend_api_key: str | None = Field(None, alias="RESEND_API_KEY")
    resend_from_email: str = Field("Slóði <noreply@slodi.is>", alias="RESEND_FROM_EMAIL")
    resend_max_recipients: int = Field(50, alias="RESEND_MAX_RECIPIENTS")

    # Public base URLs for links in outgoing email
    public_site_url: str = Field("https://slodi.is", alias="PUBLIC_SITE_URL")
    public_api_url: str = Field("https://api.slodi.is", alias="PUBLIC_API_URL")

    # Cache configuration
    cache_backend: str = Field("memory", alias="CACHE_BACKEND")  # "memory" or "redis"
    redis_host: str = Field("localhost", alias="REDIS_HOST")
    redis_port: int = Field(6379, alias="REDIS_PORT")
    cache_user_ttl_seconds: int = Field(300, alias="CACHE_USER_TTL_SECONDS")
    cache_membership_ttl_seconds: int = Field(120, alias="CACHE_MEMBERSHIP_TTL_SECONDS")
    cache_tags_ttl_seconds: int = Field(600, alias="CACHE_TAGS_TTL_SECONDS")
    rate_limit_max_window_seconds: int = Field(3600, alias="RATE_LIMIT_MAX_WINDOW_SECONDS")

    # Blob storage (one account, two containers)
    azure_storage_account: str = Field(..., alias="AZURE_STORAGE_ACCOUNT")
    azure_storage_key: str = Field(..., alias="AZURE_STORAGE_KEY")
    # Public container: images served directly via <img> (anonymous blob read).
    azure_storage_container_images: str = Field(..., alias="AZURE_STORAGE_CONTAINER_IMAGES")
    # Private container: documents are only reachable via a download SAS.
    azure_storage_container_documents: str = Field(..., alias="AZURE_STORAGE_CONTAINER_DOCUMENTS")

    @property
    def admin_email_list(self) -> list[str]:
        return _split_emails(self.admin_emails)

    @property
    def moderator_email_list(self) -> list[str]:
        return _split_emails(self.moderator_emails)

    @property
    def moderation_email_list(self) -> list[str]:
        return _split_emails(self.moderation_emails) or self.admin_email_list

    @model_validator(mode="after")
    def _test_jwks_only_in_e2e(self) -> "Settings":
        if self.auth_test_jwks_file and self.env != "e2e":
            raise ValueError(
                f"AUTH_TEST_JWKS_FILE is only accepted when ENV is 'e2e' (ENV is {self.env!r})"
            )
        return self

    def model_post_init(self, __context: object) -> None:
        # Production database URL
        self.db_url = f"postgresql+psycopg://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"


settings: Settings = Settings()  # type: ignore[call-arg]
