"""
AI Chat Models
==============
Placeholder Pydantic models for AI conversation interface.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str = Field(..., description="Message sender role (e.g. user, assistant, system)")
    content: str = Field(..., description="Text content of the message")


class ChatRequest(BaseModel):
    messages: List[Message] = Field(..., description="Conversation history")
    context: Optional[dict] = Field(default=None, description="Optional market or strategy context")


class ChatResponse(BaseModel):
    message: Message = Field(..., description="Assistant response message")
    usage: Optional[dict] = Field(default=None, description="Token usage stats if available")
