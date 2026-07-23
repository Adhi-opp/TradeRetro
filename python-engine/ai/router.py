"""
AI Module FastAPI Router
========================
Prefix: /api/ai
Tag: AI
"""

from fastapi import APIRouter

from ai.models.chat import AIHealthResponse

router = APIRouter(prefix="/api/ai", tags=["AI"])


@router.get("/health", response_model=AIHealthResponse)
async def health() -> AIHealthResponse:
    """AI module health check."""
    return AIHealthResponse(module="ai", status="initialized")
