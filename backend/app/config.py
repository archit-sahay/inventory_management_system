"""Application configuration loaded from environment variables.

No credentials are hardcoded. All settings come from the environment (see
.env.example). For local development a .env file is loaded automatically.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Full SQLAlchemy database URL, e.g.
    #   postgresql+psycopg2://user:password@host:5432/dbname
    # Render/Railway provide DATABASE_URL as postgresql://... which is
    # normalized to the psycopg2 driver in database.py.
    database_url: str = "postgresql+psycopg2://ims:ims@db:5432/ims"

    # Comma-separated list of allowed CORS origins for the frontend.
    # Use "*" to allow all origins (handy for assessment/demo deployments).
    cors_origins: str = "*"

    # Threshold below which a product is considered "low stock" on the
    # dashboard summary.
    low_stock_threshold: int = 10

    # Set to "true" to insert demo data on startup when tables are empty.
    seed_on_startup: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
