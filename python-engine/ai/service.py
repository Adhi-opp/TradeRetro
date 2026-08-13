"""AI Service Orchestration Layer.

This module provides the AIService class which orchestrates the generation of
AI Copilot responses by assembling context via ContextBuilder, constructing
prompts via PromptBuilder, and passing them to an LLM provider managed by
AIProviderFactory.
"""

import json
import logging
from typing import Any, Dict, Optional

from ai.config import AIConfig
from ai.context_builder import ContextBuilder
from ai.mode import AnalysisMode
from ai.provider_factory import AIProviderFactory
from ai.prompt_builder import PromptBuilder

logger = logging.getLogger("traderetro.ai.service")


class AIService:
    """Orchestrates ContextBuilder, PromptBuilder, and AIProviderFactory."""

    def __init__(
        self,
        context_builder: Optional[ContextBuilder] = None,
        prompt_builder: Optional[PromptBuilder] = None,
        provider_factory: Optional[AIProviderFactory] = None,
        config: Optional[AIConfig] = None,
    ) -> None:
        """Initializes the AIService orchestration dependencies.

        Args:
            context_builder: Optional ContextBuilder instance.
            prompt_builder: Optional PromptBuilder instance.
            provider_factory: Optional AIProviderFactory instance.
            config: Optional AIConfig instance.
        """
        self.config = config or AIConfig()
        self.context_builder = context_builder or ContextBuilder()
        self.prompt_builder = prompt_builder or PromptBuilder()
        self.provider_factory = provider_factory or AIProviderFactory(config=self.config)

    def generate_response(
        self,
        user_query: str,
        mode: AnalysisMode = AnalysisMode.CHAT,
        provider_name: Optional[str] = None,
        market_data: Optional[Dict[str, Any]] = None,
        strategy_data: Optional[Dict[str, Any]] = None,
        backtest_data: Optional[Dict[str, Any]] = None,
        metrics_data: Optional[Dict[str, Any]] = None,
        portfolio_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Generates an AI response for a given user query and context inputs.

        Args:
            user_query: Raw user query string.
            mode: Analysis mode for the pipeline. Defaults to chat mode.
            provider_name: Model or provider identifier. Falls back to
                ``config.model`` if not provided.
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
        provider_name = provider_name or self.config.model
        try:
            context = self.context_builder.build(
                market_data=market_data,
                strategy_data=strategy_data,
                backtest_data=backtest_data,
                metrics_data=metrics_data,
                portfolio_data=portfolio_data,
            )

            prompt = self.prompt_builder.build(user_query=user_query, context=context, mode=mode)
            logger.info(
                "Selected provider/model=%s | Prompt built (%d chars)",
                provider_name, len(prompt),
            )

            provider = self.provider_factory.get_provider(provider_name)
            logger.info("Request sent to %s", type(provider).__name__)

            raw_response_str = provider.generate_response(prompt)
            logger.info("Response received (%d chars)", len(raw_response_str))

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
            logger.error("Error in AIService.generate_response: %s", exc, exc_info=True)
            return {
                "success": False,
                "provider": provider_name,
                "user_query": user_query,
                "error": str(exc),
            }
