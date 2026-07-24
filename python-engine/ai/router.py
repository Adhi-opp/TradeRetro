"""
AI Module FastAPI Router
========================
Prefix: /api/ai
Tag: AI
"""

from fastapi import APIRouter

from ai.models.chat import AIHealthResponse, GenerateRequest, GenerateResponse
from ai.service import AIService

router = APIRouter(prefix="/api/ai", tags=["AI"])

ai_service = AIService()


@router.get("/health", response_model=AIHealthResponse)
async def health() -> AIHealthResponse:
    """AI module health check."""
    return AIHealthResponse(module="ai", status="initialized")


@router.post("/generate", response_model=GenerateResponse)
async def generate(body: GenerateRequest) -> GenerateResponse:
    """Generate an AI Copilot response using the full pipeline."""
    result = ai_service.generate_response(
        user_query=body.user_query,
        provider_name=body.provider_name,
        market_data=body.market_data,
        strategy_data=body.strategy_data,
        backtest_data=body.backtest_data,
        metrics_data=body.metrics_data,
        portfolio_data=body.portfolio_data,
    )
    return GenerateResponse(**result)
