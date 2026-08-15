"""
AI Chat Models
==============
Pydantic models for AI Copilot request/response interface.
"""

from typing import List, Optional
from pydantic import BaseModel, Field

from ai.mode import AnalysisMode


class Message(BaseModel):
    role: str = Field(..., description="Message sender role (e.g. user, assistant, system)")
    content: str = Field(..., description="Text content of the message")


class ChatRequest(BaseModel):
    messages: List[Message] = Field(..., description="Conversation history")
    context: Optional[dict] = Field(default=None, description="Optional market or strategy context")


class ChatResponse(BaseModel):
    message: Message = Field(..., description="Assistant response message")
    usage: Optional[dict] = Field(default=None, description="Token usage stats if available")


class GenerateRequest(BaseModel):
    user_query: str = Field(..., description="User query text")
    provider_name: str = Field(default="qwen2.5-coder-1.5b-instruct", description="LLM provider identifier")
    api_key: Optional[str] = Field(default=None, description="Transient, single-request API key (never persisted)")
    mode: AnalysisMode = Field(default=AnalysisMode.CHAT, description="Analysis mode for the pipeline")
    market_data: Optional[dict] = Field(default=None, description="Market context data")
    strategy_data: Optional[dict] = Field(default=None, description="Strategy context data")
    backtest_data: Optional[dict] = Field(default=None, description="Backtest context data")
    metrics_data: Optional[dict] = Field(default=None, description="Metrics context data")
    portfolio_data: Optional[dict] = Field(default=None, description="Portfolio context data")


class GenerateResponse(BaseModel):
    success: bool = Field(..., description="Whether the generation succeeded")
    provider: str = Field(..., description="Provider identifier used")
    user_query: str = Field(..., description="Original user query")
    prompt: str = Field(default="", description="Constructed prompt string")
    context: Optional[dict] = Field(default=None, description="Context dictionary")
    response: Optional[dict] = Field(default=None, description="Parsed LLM response")
    error: Optional[str] = Field(default=None, description="Error message if generation failed")


class AIHealthResponse(BaseModel):
    module: str = Field(default="ai", description="Module identifier")
    status: str = Field(default="initialized", description="Current module status")

