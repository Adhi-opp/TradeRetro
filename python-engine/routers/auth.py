"""
Upstox OAuth2 Router
====================
GET  /api/auth/login    → redirect to Upstox consent page
GET  /api/auth/callback → exchange code for token, store in Redis
GET  /api/auth/status   → check authentication state
POST /api/auth/token    → manually inject an access token
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from services.upstox_client import upstox_auth

router = APIRouter(prefix="/api/auth", tags=["auth"])


class TokenInjectRequest(BaseModel):
    access_token: str


@router.get("/login")
async def login():
    """Redirect user to Upstox OAuth consent page."""
    url = upstox_auth.get_login_url()
    return RedirectResponse(url)


@router.get("/callback")
async def callback(code: str):
    """Handle OAuth callback — exchange code for access token."""
    try:
        token_data = await upstox_auth.exchange_code(code)
        return {
            "status": "authenticated",
            "message": "Token acquired and stored. Pipeline can now connect to Upstox WebSocket.",
            "token_preview": token_data.get("access_token", "")[:12] + "...",
        }
    except Exception as exc:
        raise HTTPException(400, f"Token exchange failed: {exc}")


@router.get("/status")
async def auth_status():
    """Check whether we have a valid Upstox token (checks Redis)."""
    authenticated = await upstox_auth.check_authenticated()
    return {"authenticated": authenticated}


@router.post("/token")
async def inject_token(body: TokenInjectRequest):
    """Manually inject an access token (skip OAuth flow)."""
    await upstox_auth._store_token(body.access_token)
    return {
        "status": "authenticated",
        "message": "Token stored in Redis. Pipeline can now connect.",
        "token_preview": body.access_token[:12] + "...",
    }
