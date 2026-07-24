"""
AI Module FastAPI Router
========================
Prefix: /api/ai
Tag: AI
"""

from fastapi import APIRouter

from ai.models.chat import AIHealthResponse, GenerateRequest, GenerateResponse

router = APIRouter(prefix="/api/ai", tags=["AI"])


@router.get("/health", response_model=AIHealthResponse)
async def health() -> AIHealthResponse:
    """AI module health check."""
    return AIHealthResponse(module="ai", status="initialized")


@router.post("/generate", response_model=GenerateResponse)
async def generate(body: GenerateRequest) -> GenerateResponse:
    """Stub AI generate endpoint."""
    return GenerateResponse(
        success=True,
        provider="stub",
        user_query=body.user_query,
        prompt="",
        context=None,
        response={"message": "AI endpoint is connected successfully."},
        error=None,
    )
