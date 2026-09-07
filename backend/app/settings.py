from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.docker"), env_file_encoding="utf-8", extra="ignore"
    )

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

    # Seed: emails that are always promoted to admin on `make seed`
    admin_emails: str = Field("", alias="ADMIN_EMAILS")
    # Where an `unsafe` report is escalated to. Falls back to ADMIN_EMAILS when
    # unset, because a safeguarding report with nowhere to go is the one failure
    # mode this must not have.
    moderation_emails: str = Field("", alias="MODERATION_EMAILS")

    # HMAC key for signed game run tokens. REQUIRED outside development —
    # run_tokens._secret() raises when it is unset and ENV is not a dev value.
    #
    # It is deliberately NOT derived from another credential. An earlier version
    # derived it from DB_PASSWORD, which made every token handed out by the
    # unauthenticated /games/{slug}/runs endpoint a free offline oracle for
    # brute-forcing the database password. See run_tokens._secret().
    #
    # Production sets itself: deploy-backend.yml generates a value into
    # backend/.env.docker when that file has none, and never overwrites one.
    #
    # Changing it invalidates every run token still parked in a player's
    # sessionStorage, up to the 12h TTL. Those runs come back as a rejected
    # signature and are retried rather than lost, but the players affected will
    # see an error. The same applies mid-rolling-deploy if one worker has the
    # variable and another does not, so set it everywhere in the same release.
    game_token_secret: str = Field("", alias="GAME_TOKEN_SECRET")

    # CORS configuration
    cors_origins: list[str] = Field(["http://localhost:3000"], alias="CORS_ORIGINS")

    # Resend (email) configuration
    resend_api_key: str | None = Field(None, alias="RESEND_API_KEY")
    resend_from_email: str = Field("Slóði <noreply@slodi.is>", alias="RESEND_FROM_EMAIL")
    resend_max_recipients: int = Field(50, alias="RESEND_MAX_RECIPIENTS")

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
        return [e.strip().lower() for e in self.admin_emails.split(",") if e.strip()]

    @property
    def moderation_email_list(self) -> list[str]:
        """Who hears about an `unsafe` report, within the day.

        Falls back to the admins rather than to nothing: an escalation that
        silently goes nowhere is worse than one that reaches the wrong inbox.
        """
        addresses = [e.strip().lower() for e in self.moderation_emails.split(",") if e.strip()]
        return addresses or self.admin_email_list

    def model_post_init(self, __context: object) -> None:
        # Production database URL
        self.db_url = f"postgresql+psycopg://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"


settings: Settings = Settings()  # type: ignore[call-arg]
