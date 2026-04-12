"""
Upstox API v2 — OAuth2 + REST helpers.
Handles authorization flow and WebSocket URL retrieval.
"""

import logging
from urllib.parse import urlencode

import httpx

from config import settings

logger = logging.getLogger("traderetro.upstox")

UPSTOX_AUTH_BASE = "https://api.upstox.com/v2/login/authorization"
UPSTOX_WS_AUTH = "https://api.upstox.com/v2/feed/market-data-feed/authorize"


class UpstoxAuth:
    """Singleton that manages the Upstox access token lifecycle."""

    def __init__(self) -> None:
        self.access_token: str | None = None

    @property
    def is_authenticated(self) -> bool:
        return self.access_token is not None

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
            self.access_token = data.get("access_token")
            logger.info("Upstox token acquired")
            return data

    async def get_ws_url(self) -> str:
        """Get authorized WebSocket URL for market data feed."""
        if not self.access_token:
            raise RuntimeError("Not authenticated — complete OAuth flow first")

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                UPSTOX_WS_AUTH,
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Accept": "application/json",
                },
            )
            resp.raise_for_status()
            return resp.json()["data"]["authorizedRedirectUri"]


# Module-level singleton
upstox_auth = UpstoxAuth()
