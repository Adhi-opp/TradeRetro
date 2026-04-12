"""
Upstox OAuth2 Router
====================
GET /api/auth/login    → redirect to Upstox consent page
GET /api/auth/callback → exchange code for token
GET /api/auth/status   → check authentication state
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from services.upstox_client import upstox_auth

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/login")
async def login():
    """Redirect user to Upstox OAuth consent page."""
    if not upstox_auth.get_login_url():
        raise HTTPException(400, "UPSTOX_CLIENT_ID not configured")
    return RedirectResponse(upstox_auth.get_login_url())


@router.get("/callback")
async def callback(code: str):
    """Handle OAuth callback — exchange code for access token."""
    try:
        token_data = await upstox_auth.exchange_code(code)
        return {
            "status": "authenticated",
            "message": "Upstox access token acquired. WebSocket pipeline can now connect.",
            "token_preview": token_data.get("access_token", "")[:12] + "...",
        }
    except Exception as exc:
        raise HTTPException(400, f"Token exchange failed: {exc}")


@router.get("/status")
async def auth_status():
    """Check whether we have a valid Upstox token."""
    return {"authenticated": upstox_auth.is_authenticated}
