"""AI Provider Factory Module.

This module provides the AIProviderFactory which selects and
instantiates the correct LLM provider based on a model or
provider name, using the model registry.
"""

from typing import Dict, Optional, Type

from ai.config import AIConfig
from ai.ollama_provider import OllamaProvider
from ai.providers.base_provider import BaseLLMProvider
from ai.providers.gemini_provider import GeminiProvider
from ai.providers.mock_provider import MockLLMProvider
from ai.providers.openai_compatible_provider import OpenAICompatibleProvider
from ai.providers.openai_provider import OpenAIProvider
from ai.registry import resolve_model


class AIProviderFactory:
    """Factory for selecting and instantiating LLM providers.

    Uses the model registry to resolve model identifiers to the
    correct provider backend.
    """

    _provider_classes: Dict[str, Type[BaseLLMProvider]] = {
        "mock": MockLLMProvider,
        "ollama": OllamaProvider,
        "gemini": GeminiProvider,
        "openai": OpenAIProvider,
        "openai-compatible": OpenAICompatibleProvider,
    }

    def __init__(self, config: Optional[AIConfig] = None) -> None:
        """Initializes the factory.

        Args:
            config: Optional AIConfig used to pass connection
                details (e.g. base URL, API key) to providers that
                need them.
        """
        self._config = config or AIConfig()

    def get_provider(self, model_or_provider: str = "mock") -> BaseLLMProvider:
        """Returns an LLM provider instance for the given model or provider name.

        Resolution order:
        1. Look up ``model_or_provider`` in the model registry.
        2. If found, use the registered provider type.
        3. If not found, treat it as a direct provider name.

        Args:
            model_or_provider: A model ID (e.g. ``"qwen2.5-coder-7b-instruct"``) or
                provider name (e.g. ``"mock"``, ``"ollama"``).

        Returns:
            An instance of :class:`BaseLLMProvider`.

        Raises:
            ValueError: If no provider class can be resolved.
        """
        key = model_or_provider.lower().strip()

        resolved_model_id = None
        try:
            info = resolve_model(key)
            provider_type = info.provider
            resolved_model_id = info.id
        except KeyError:
            provider_type = key

        cls = self._provider_classes.get(provider_type)
        if cls is None:
            raise ValueError(
                f"Unsupported provider '{provider_type}' resolved "
                f"from '{model_or_provider}'. "
                f"Supported: {list(self._provider_classes.keys())}"
            )

        if provider_type == "openai-compatible":
            return cls(
                model=resolved_model_id or self._config.model,
                base_url=self._config.openai_compatible_base_url,
                api_key=self._config.openai_compatible_api_key,
                temperature=self._config.temperature,
                max_tokens=self._config.max_tokens,
            )

        if provider_type == "ollama":
            kwargs = {
                "temperature": self._config.temperature,
                "max_tokens": self._config.max_tokens,
            }
            if resolved_model_id:
                kwargs["model"] = resolved_model_id
            return cls(**kwargs)

        if provider_type == "gemini":
            return cls(
                model=resolved_model_id or self._config.gemini_model,
                api_key=self._config.gemini_api_key,
                base_url=self._config.gemini_base_url,
                temperature=self._config.temperature,
                max_tokens=self._config.max_tokens,
            )

        return cls()
