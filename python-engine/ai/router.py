"""
AI Module FastAPI Router
========================
Prefix: /api/ai
Tag: AI
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/ai", tags=["AI"])


@router.get("/health")
async def health():
    """AI module health check."""
    return {
        "module": "ai",
        "status": "initialized",
    }
