"""LLM Provider Abstraction Module.

This module exports the BaseLLMProvider interface, MockLLMProvider implementation,
and LLMProviderFactory for instantiating LLM providers.
"""

from typing import Dict, Type
from ai.providers.base_provider import BaseLLMProvider
from ai.providers.mock_provider import MockLLMProvider


class LLMProviderFactory:
    """Factory for instantiating registered LLM provider instances."""

    _providers: Dict[str, Type[BaseLLMProvider]] = {
        "mock": MockLLMProvider,
    }

    def get_provider(self, provider_name: str = "mock") -> BaseLLMProvider:
        """Retrieves an instance of the specified LLM provider.

        Args:
            provider_name: The string identifier of the requested provider (e.g., "mock").

        Returns:
            An instance of BaseLLMProvider.

        Raises:
            ValueError: If the requested provider_name is not supported.
        """
        key = provider_name.lower().strip()
        if key not in self._providers:
            raise ValueError(
                f"Unsupported LLM provider '{provider_name}'. Supported providers: {list(self._providers.keys())}"
            )
        return self._providers[key]()


__all__ = ["BaseLLMProvider", "MockLLMProvider", "LLMProviderFactory"]
