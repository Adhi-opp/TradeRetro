"""LLM Provider Abstraction Module.

This module re-exports provider abstractions and provides the
legacy LLMProviderFactory for backward compatibility.
"""

from ai.provider_factory import AIProviderFactory
from ai.providers.base_provider import BaseLLMProvider
from ai.providers.mock_provider import MockLLMProvider


class LLMProviderFactory:
    """Legacy factory that delegates to AIProviderFactory.

    .. deprecated::
        Use :class:`AIProviderFactory` directly instead.
    """

    def get_provider(self, provider_name: str = "mock") -> BaseLLMProvider:
        """Retrieves an instance of the specified LLM provider.

        .. deprecated::
            Delegates to :meth:`AIProviderFactory.get_provider`.

        Args:
            provider_name: The model or provider identifier.

        Returns:
            An instance of :class:`BaseLLMProvider`.
        """
        return AIProviderFactory().get_provider(provider_name)


__all__ = ["BaseLLMProvider", "MockLLMProvider", "LLMProviderFactory"]
