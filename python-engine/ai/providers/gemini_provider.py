"""Gemini LLM Provider Stub.

Placeholder for future Gemini integration.
"""

import json

from ai.providers.base_provider import BaseLLMProvider


class GeminiProvider(BaseLLMProvider):
    """Placeholder provider for Google Gemini."""

    def generate_response(self, prompt: str) -> str:
        """Returns a not-implemented response.

        Args:
            prompt: The input prompt string (ignored in stub).

        Returns:
            A JSON string indicating Gemini is not yet implemented.
        """
        return json.dumps({
            "provider": "gemini",
            "success": False,
            "error": "Gemini provider is not yet implemented",
            "response": None,
        })
