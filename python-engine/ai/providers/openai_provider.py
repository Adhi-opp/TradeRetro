"""OpenAI LLM Provider Stub.

Placeholder for future OpenAI integration.
"""

import json

from ai.providers.base_provider import BaseLLMProvider


class OpenAIProvider(BaseLLMProvider):
    """Placeholder provider for OpenAI."""

    def generate_response(self, prompt: str) -> str:
        """Returns a not-implemented response.

        Args:
            prompt: The input prompt string (ignored in stub).

        Returns:
            A JSON string indicating OpenAI is not yet implemented.
        """
        return json.dumps({
            "provider": "openai",
            "success": False,
            "error": "OpenAI provider is not yet implemented",
            "response": None,
        })
