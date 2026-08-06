"""
AI Module FastAPI Router
========================
Prefix: /api/ai
Tag: AI
"""

from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from ai.models.chat import AIHealthResponse, GenerateRequest, GenerateResponse
from ai.registry import list_models
from ai.service import AIService

router = APIRouter(prefix="/api/ai", tags=["AI"])

ai_service = AIService()


@router.get("/health", response_model=AIHealthResponse)
async def health() -> AIHealthResponse:
    """AI module health check."""
    return AIHealthResponse(module="ai", status="initialized")


@router.get("/models")
async def list_available_models() -> list:
    """Return all available models from the registry, including
    any locally discovered Ollama models."""
    return [m.__dict__ for m in list_models()]


@router.post("/generate", response_model=GenerateResponse)
async def generate(body: GenerateRequest) -> GenerateResponse:
    """Generate an AI Copilot response using the full pipeline.

    The pipeline below performs synchronous (blocking) provider I/O via
    synchronous ``httpx.Client``. It is deliberately NOT rewritten to async:
    providers remain synchronous by design. Instead the blocking call is
    offloaded to FastAPI's thread pool so the event loop is never blocked
    while a provider response is awaited. Behaviour, schema, and exception
    handling are unchanged.
    """
    result = await run_in_threadpool(
        ai_service.generate_response,
        user_query=body.user_query,
        provider_name=body.provider_name,
        market_data=body.market_data,
        strategy_data=body.strategy_data,
        backtest_data=body.backtest_data,
        metrics_data=body.metrics_data,
        portfolio_data=body.portfolio_data,
    )
    return GenerateResponse(**result)
