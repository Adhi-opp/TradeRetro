"""Mock LLM Provider Implementation.

This module provides a deterministic mock provider implementation for offline
testing and architecture validation without making network or AI API calls.
"""

import json
from ai.providers.base_provider import BaseLLMProvider


class MockLLMProvider(BaseLLMProvider):
    """Deterministic mock provider implementation for LLM requests."""

    def generate_response(self, prompt: str) -> str:
        """Generates a deterministic fake JSON response.

        Args:
            prompt: The input prompt string (ignored for mock generation).

        Returns:
            A JSON-formatted string containing static mock provider output.
        """
        payload = {
            "provider": "mock",
            "success": True,
            "response": "Mock response generated successfully.",
            "tokens_used": 0,
        }
        return json.dumps(payload, indent=4)
