"""
Upstox API v2 — OAuth2 + REST helpers.
Handles authorization flow, token persistence (via Redis), and WebSocket URL retrieval.

Token lifecycle:
    - Acquired via OAuth callback or injected via UPSTOX_ACCESS_TOKEN env var
    - Persisted in Redis key 'upstox:access_token' so all containers can access it
    - Valid for ~1 year (no daily re-auth needed)
"""

import logging
import os
from urllib.parse import urlencode

import httpx

from config import settings

logger = logging.getLogger("traderetro.upstox")

UPSTOX_AUTH_BASE = "https://api.upstox.com/v2/login/authorization"
UPSTOX_WS_AUTH = "https://api.upstox.com/v2/feed/market-data-feed/authorize"
REDIS_TOKEN_KEY = "upstox:access_token"


class UpstoxAuth:
    """Manages the Upstox access token — shared across containers via Redis."""

    def __init__(self) -> None:
        self._local_token: str | None = None

    def get_login_url(self) -> str:
        params = urlencode({
            "client_id": settings.upstox_client_id,
            "redirect_uri": settings.upstox_redirect_uri,
            "response_type": "code",
        })
        return f"{UPSTOX_AUTH_BASE}/dialog?{params}"

    async def exchange_code(self, code: str) -> dict:
        """Exchange authorization code for access token."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{UPSTOX_AUTH_BASE}/token",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "code": code,
                    "client_id": settings.upstox_client_id,
                    "client_secret": settings.upstox_client_secret,
                    "redirect_uri": settings.upstox_redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            token = data.get("access_token")
            if token:
                await self._store_token(token)
                logger.info("Upstox token acquired and stored in Redis")
            return data

    async def get_access_token(self) -> str | None:
        """
        Retrieve access token. Priority:
            1. Redis (shared across containers)
            2. UPSTOX_ACCESS_TOKEN env var (manual injection)
            3. Local cache
        """
        # Try Redis first
        try:
            from services.redis_client import get_redis
            r = get_redis()
            token = await r.get(REDIS_TOKEN_KEY)
            if token:
                self._local_token = token.decode() if isinstance(token, bytes) else token
                return self._local_token
        except Exception:
            pass

        # Fall back to env var
        env_token = os.environ.get("UPSTOX_ACCESS_TOKEN")
        if env_token:
            await self._store_token(env_token)
            return env_token

        return self._local_token

    @property
    def is_authenticated(self) -> bool:
        return self._local_token is not None

    async def check_authenticated(self) -> bool:
        """Check Redis for a valid token (async version of is_authenticated)."""
        token = await self.get_access_token()
        return token is not None

    async def get_ws_url(self) -> str:
        """Get authorized WebSocket URL for market data feed."""
        token = await self.get_access_token()
        if not token:
            raise RuntimeError("Not authenticated — complete OAuth at /api/auth/login")

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                UPSTOX_WS_AUTH,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                },
            )
            resp.raise_for_status()
            return resp.json()["data"]["authorizedRedirectUri"]

    async def _store_token(self, token: str) -> None:
        """Persist token in Redis with 24h TTL."""
        self._local_token = token
        try:
            from services.redis_client import get_redis
            r = get_redis()
            await r.set(REDIS_TOKEN_KEY, token, ex=31536000)  # 1 year expiry
        except Exception as exc:
            logger.warning(f"Could not persist token to Redis: {exc}")

    async def clear_token(self) -> None:
        """Remove stored token (e.g., on auth failure)."""
        self._local_token = None
        try:
            from services.redis_client import get_redis
            r = get_redis()
            await r.delete(REDIS_TOKEN_KEY)
        except Exception:
            pass


# Module-level singleton
upstox_auth = UpstoxAuth()
