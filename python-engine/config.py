"""
Configuration
=============
Central config using pydantic-settings. All values can be
overridden via environment variables or a .env file.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database (TimescaleDB) ─────────────────────────────────
    database_url: str = "postgresql://postgres:postgres@localhost:5432/traderetro_raw"

    # ── Redis ──────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379"

    # ── Upstox ─────────────────────────────────────────────────
    upstox_client_id: str = ""
    upstox_client_secret: str = ""
    upstox_redirect_uri: str = "http://localhost:8000/api/auth/callback"

    # ── Financial constants ────────────────────────────────────
    risk_free_rate: float = 0.065        # India 10Y bond yield ~6.5%
    trading_days_per_year: int = 252     # Standard for Indian equity markets
    default_initial_capital: float = 100_000.0  # INR

    # ── Server ─────────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
