"""Runtime configuration. Values come from the environment (see ../.env.example).

Secrets are never hard-coded. In development the database falls back to a local
SQLite file when DATABASE_URL is not set.
"""
from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "RAGI"
    app_env: str = "development"
    # Required outside development. The SQLite fallback is for local development only.
    database_url: str | None = None
    redis_url: str | None = None

    # Browser sessions
    session_cookie_name: str = "__Host-ragi_session"
    session_cookie_legacy_name: str = "ragi_session"
    public_base_url: str = "http://localhost:3410"
    forwarded_allow_ips: str = "127.0.0.1,::1"
    registration_mode: str = "closed"  # closed | invite | open
    ragi_owner_setup_token: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    apple_client_id: str = ""  # Services ID
    apple_team_id: str = ""
    apple_key_id: str = ""
    apple_private_key: str = ""  # PEM contents or empty when unset
    mfa_pending_minutes: int = 10
    idle_timeout_minutes_privileged: int = 30
    idle_timeout_minutes: int = 120
    session_ttl_hours: int = 12
    cookie_secure: bool = True  # browsers accept Secure cookies on http://localhost
    # Fernet key for encrypting sensitive columns (MFA secrets). Required outside development.
    field_encryption_key: str | None = None
    mfa_required_roles: list[str] = Field(default_factory=lambda: ["owner", "admin"])
    max_mfa_failures: int = 5
    api_docs_enabled: bool = True
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3410"])

    # Login protection
    max_failed_logins: int = 5
    lockout_minutes: int = 15

    # OIDC (interface only this round)
    oidc_issuer_url: str | None = None
    oidc_client_id: str | None = None
    oidc_client_secret: str | None = None

    # Providers (interfaces only this round)
    openai_api_key: str | None = None
    xai_api_key: str | None = None
    github_app_id: str | None = None
    github_private_key_file: str | None = None
    github_webhook_secret: str | None = None

    # Ecosystem
    ragi_api_url: str | None = None
    omh_api_url: str | None = None
    # Per-service rotating keys (JSON file, outside the repo). See docs/authentication.md
    # in ecosystem-contracts. RAGI signs outbound calls with its own active key id.
    ecosystem_keyring_file: str | None = None
    ecosystem_signing_key_id: str | None = None
    ecosystem_max_clock_skew_seconds: int = 300

    object_storage_endpoint: str | None = None
    object_storage_bucket: str | None = None

    # Safety switches — all off by default (master spec §14)
    agents_enabled: bool = False
    repository_writes_enabled: bool = False
    production_deployment_enabled: bool = False

    @property
    def is_development(self) -> bool:
        return self.app_env in {"development", "test"}

    @property
    def db_url(self) -> str:
        return self.database_url or "sqlite:///./ragi-dev.db"

    @property
    def is_sqlite(self) -> bool:
        return self.db_url.startswith("sqlite")

    @model_validator(mode="after")
    def _production_guard(self):
        if not self.is_development:
            problems = []
            if not self.database_url or not self.database_url.startswith("postgresql"):
                problems.append("DATABASE_URL must point to PostgreSQL")
            if not self.cookie_secure:
                problems.append("COOKIE_SECURE must be true")
            if not self.field_encryption_key:
                problems.append("FIELD_ENCRYPTION_KEY is required")
            if self.api_docs_enabled:
                problems.append("API_DOCS_ENABLED must be false")
            if self.registration_mode == "open":
                problems.append("REGISTRATION_MODE=open requires an explicit operator confirmation")
            if not self.google_client_id and not self.apple_client_id:
                pass  # providers stay disabled until client IDs exist
            if problems:
                raise ValueError("Refusing to start outside development: " + "; ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
