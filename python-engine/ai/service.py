"""AI Service Orchestration Layer.

This module provides the AIService class which orchestrates the generation of
AI Copilot responses by assembling context via ContextBuilder, constructing
prompts via PromptBuilder, and passing them to an LLM provider managed by
LLMProviderFactory.
"""

import json
import logging
from typing import Any, Dict, Optional

from ai.context_builder import ContextBuilder
from ai.llm_provider import LLMProviderFactory
from ai.prompt_builder import PromptBuilder

logger = logging.getLogger("traderetro.ai.service")


class AIService:
    """Orchestrates ContextBuilder, PromptBuilder, and LLMProviderFactory."""

    def __init__(
        self,
        context_builder: Optional[ContextBuilder] = None,
        prompt_builder: Optional[PromptBuilder] = None,
        provider_factory: Optional[LLMProviderFactory] = None,
    ) -> None:
        """Initializes the AIService orchestration dependencies.

        Args:
            context_builder: Optional ContextBuilder instance.
            prompt_builder: Optional PromptBuilder instance.
            provider_factory: Optional LLMProviderFactory instance.
        """
        self.context_builder = context_builder or ContextBuilder()
        self.prompt_builder = prompt_builder or PromptBuilder()
        self.provider_factory = provider_factory or LLMProviderFactory()

    def generate_response(
        self,
        user_query: str,
        provider_name: str = "mock",
        market_data: Optional[Dict[str, Any]] = None,
        strategy_data: Optional[Dict[str, Any]] = None,
        backtest_data: Optional[Dict[str, Any]] = None,
        metrics_data: Optional[Dict[str, Any]] = None,
        portfolio_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Generates an AI response for a given user query and context inputs.

        Args:
            user_query: Raw user query string.
            provider_name: Target LLM provider identifier (defaults to "mock").
            market_data: Optional market context input data.
            strategy_data: Optional strategy context input data.
            backtest_data: Optional backtest context input data.
            metrics_data: Optional metrics context input data.
            portfolio_data: Optional portfolio context input data.

        Returns:
            Dictionary containing execution success, provider metadata,
            user query, prompt string, context dictionary, and parsed LLM
            response payload.
        """
        try:
            context = self.context_builder.build(
                market_data=market_data,
                strategy_data=strategy_data,
                backtest_data=backtest_data,
                metrics_data=metrics_data,
                portfolio_data=portfolio_data,
            )

            prompt = self.prompt_builder.build(user_query=user_query, context=context)

            provider = self.provider_factory.get_provider(provider_name)

            raw_response_str = provider.generate_response(prompt)

            try:
                parsed_response = json.loads(raw_response_str)
            except (json.JSONDecodeError, TypeError):
                parsed_response = {"raw_response": raw_response_str}

            return {
                "success": True,
                "provider": provider_name,
                "user_query": user_query,
                "prompt": prompt,
                "context": context,
                "response": parsed_response,
                "error": None,
            }

        except Exception as exc:
            logger.error(f"Error in AIService.generate_response: {exc}", exc_info=True)
            return {
                "success": False,
                "provider": provider_name,
                "user_query": user_query,
                "error": str(exc),
            }
