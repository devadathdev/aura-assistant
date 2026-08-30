from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "sentinel-api"
    environment: str = "development"
    debug: bool = False
    log_level: str = "INFO"

    host: str = "0.0.0.0"
    port: int = 8000

    database_url: str = "postgresql+asyncpg://sentinel:sentinel@localhost:5432/sentinel"
    database_pool_size: int = 10
    database_max_overflow: int = 20

    redis_url: str = "redis://localhost:6379/0"

    secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    cors_origins: list[str] = ["http://localhost:3000"]
    cors_allow_credentials: bool = True
    cors_allow_methods: list[str] = ["*"]
    cors_allow_headers: list[str] = ["*"]

    encryption_master_key: str | None = None

    threat_intel_api_keys: dict[str, str] = {}
    breach_api_keys: dict[str, str] = {}

    ai_provider: str = "mock"
    ai_api_key: str | None = None
    ai_model: str = "gpt-4o-mini"

    audit_chain_key: str | None = None

    rate_limit_requests: int = 100
    rate_limit_window_seconds: int = 60

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if not v or v == "your-super-secret-key-change-in-production-min-32-chars":
            raise ValueError("SECRET_KEY must be set to a secure random value (min 32 chars)")
        return v

    @field_validator("encryption_master_key")
    @classmethod
    def validate_encryption_master_key(cls, v: str | None) -> str | None:
        if v == "your-32-byte-base64-encoded-master-key":
            raise ValueError("ENCRYPTION_MASTER_KEY must be set to a secure base64-encoded value")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()