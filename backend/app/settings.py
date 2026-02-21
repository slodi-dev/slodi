from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

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

    # Test database configuration
    test_db_name: str = Field(..., alias="TEST_DB_NAME")
    test_db_user: str = Field(..., alias="TEST_DB_USER")
    test_db_password: str = Field(..., alias="TEST_DB_PASSWORD")
    test_db_port: str = Field(..., alias="TEST_DB_PORT")
    test_db_host: str = Field(..., alias="TEST_DB_HOST")
    test_db_url: str = ""

    # Auth0 configuration
    auth0_domain: str = Field(..., alias="AUTH0_DOMAIN")
    auth0_audience: str = Field(..., alias="AUTH0_AUDIENCE")
    auth0_algorithms: list[str] = Field(["RS256"], alias="AUTH0_ALGORITHMS")

    # Seed: emails that are always promoted to admin on `make seed`
    admin_emails: str = Field("", alias="ADMIN_EMAILS")

    # CORS configuration
    cors_origins: list[str] = Field(["http://localhost:3000"], alias="CORS_ORIGINS")

    # Resend (email) configuration
    resend_api_key: str | None = Field(None, alias="RESEND_API_KEY")
    resend_from_email: str = Field("Slóði <noreply@slodi.is>", alias="RESEND_FROM_EMAIL")

    @property
    def admin_email_list(self) -> list[str]:
        return [e.strip().lower() for e in self.admin_emails.split(",") if e.strip()]

    def model_post_init(self, __context: object) -> None:
        # Production database URL
        self.db_url = f"postgresql+psycopg://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

        # Test database URL
        self.test_db_url = f"postgresql+psycopg://{self.test_db_user}:{self.test_db_password}@{self.test_db_host}:{self.test_db_port}/{self.test_db_name}"


settings: Settings = Settings()  # type: ignore[call-arg]
