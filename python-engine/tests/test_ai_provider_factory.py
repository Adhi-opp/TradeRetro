"""
Tests for ai/provider_factory.py — AIProviderFactory.

Verifies provider selection:

  * Direct provider names resolve to the correct provider class.
  * Registered model IDs resolve to their configured provider type.
  * Unknown providers raise a structured ValueError naming the supported set.
  * The openai-compatible provider is wired with the configured model, base
    URL and API key.
  * The legacy LLMProviderFactory delegates to AIProviderFactory.
"""

import pytest

from ai.config import AIConfig
from ai.llm_provider import LLMProviderFactory
from ai.ollama_provider import OllamaProvider
from ai.provider_factory import AIProviderFactory
from ai.providers.base_provider import BaseLLMProvider
from ai.providers.gemini_provider import GeminiProvider
from ai.providers.mock_provider import MockLLMProvider
from ai.providers.openai_compatible_provider import OpenAICompatibleProvider
from ai.providers.openai_provider import OpenAIProvider

UNKNOWN_PROVIDER_RE = "Unsupported provider"


@pytest.fixture(autouse=True)
def _no_ollama_network(monkeypatch):
    """Keep registry resolution offline so factory tests never hit a real daemon."""
    monkeypatch.setattr("ai.registry._fetch_ollama_tags", lambda: [])


@pytest.fixture(autouse=True)
def _no_ollama_discovery(monkeypatch):
    """Disable runtime Ollama discovery so model resolution is deterministic.

    The registry pings the local Ollama daemon over HTTP; tests must never
    touch the network.
    """
    monkeypatch.setattr("ai.registry._fetch_ollama_tags", lambda: [])


@pytest.fixture
def factory() -> AIProviderFactory:
    return AIProviderFactory()


# ── Direct provider names ────────────────────────────────────────────────────


class TestDirectProviderSelection:
    def test_mock_provider(self, factory):
        assert isinstance(factory.get_provider("mock"), MockLLMProvider)

    def test_ollama_provider(self, factory):
        assert isinstance(factory.get_provider("ollama"), OllamaProvider)

    def test_gemini_provider(self, factory):
        assert isinstance(factory.get_provider("gemini"), GeminiProvider)

    def test_openai_provider(self, factory):
        assert isinstance(factory.get_provider("openai"), OpenAIProvider)

    def test_openai_compatible_provider(self, factory):
        assert isinstance(factory.get_provider("openai-compatible"), OpenAICompatibleProvider)

    def test_default_provider_is_mock(self, factory):
        assert isinstance(factory.get_provider(), MockLLMProvider)

    def test_provider_case_insensitive(self, factory):
        assert isinstance(factory.get_provider("MOCK"), MockLLMProvider)
        assert isinstance(factory.get_provider("Ollama"), OllamaProvider)

    def test_provider_name_whitespace_tolerated(self, factory):
        assert isinstance(factory.get_provider("  mock "), MockLLMProvider)


# ── Registered model resolution ──────────────────────────────────────────────


class TestModelResolution:
    def test_openai_compatible_model_resolves(self, factory):
        provider = factory.get_provider("qwen2.5-coder-1.5b-instruct")
        assert isinstance(provider, OpenAICompatibleProvider)
        assert provider.model == "qwen2.5-coder-1.5b-instruct"

    def test_ollama_registered_model_resolves(self, factory):
        assert isinstance(factory.get_provider("llama3.2"), OllamaProvider)

    def test_openai_cloud_model_resolves(self, factory):
        assert isinstance(factory.get_provider("gpt-4o-mini"), OpenAIProvider)

    def test_gemini_cloud_model_resolves(self, factory):
        assert isinstance(factory.get_provider("gemini-pro"), GeminiProvider)

    def test_all_registered_models_resolve(self, factory):
        from ai.registry import REGISTERED_MODELS

        for model_id in REGISTERED_MODELS:
            provider = factory.get_provider(model_id)
            assert isinstance(provider, BaseLLMProvider), model_id


# ── Unknown provider handling ────────────────────────────────────────────────


class TestUnknownProvider:
    def test_unknown_provider_raises_value_error(self, factory):
        with pytest.raises(ValueError):
            factory.get_provider("nonexistent-provider")

    def test_error_mentions_supported_providers(self, factory):
        with pytest.raises(ValueError) as exc:
            factory.get_provider("does-not-exist")
        message = str(exc.value)
        assert UNKNOWN_PROVIDER_RE in message
        for name in ("mock", "ollama", "gemini", "openai", "openai-compatible"):
            assert name in message

    def test_error_message_includes_requested_name(self, factory):
        with pytest.raises(ValueError) as exc:
            factory.get_provider("bogus")
        assert "bogus" in str(exc.value)

    def test_error_is_not_a_crash(self, factory):
        """Unknown providers surface as structured ValueError, not exceptions."""
        with pytest.raises(ValueError):
            factory.get_provider("")
        with pytest.raises(ValueError):
            factory.get_provider("unknown.model")


# ── openai-compatible wiring ─────────────────────────────────────────────────


class TestOpenAICompatibleWiring:
    def test_wiring_uses_config_values(self):
        config = AIConfig(
            model="custom-model",
            openai_compatible_base_url="http://example.com:8080",
            openai_compatible_api_key="secret-key",
        )
        factory = AIProviderFactory(config=config)
        provider = factory.get_provider("qwen2.5-coder-7b-instruct")
        assert provider.model == "qwen2.5-coder-7b-instruct"
        assert provider.base_url == "http://example.com:8080"
        assert provider.api_key == "secret-key"

    def test_wiring_trailing_slash_stripped(self, factory):
        factory._config.openai_compatible_base_url = "http://host:9999/"
        provider = factory.get_provider("openai-compatible")
        assert provider.base_url == "http://host:9999"

    def test_all_providers_subclass_base(self, factory):
        for name in ("mock", "ollama", "gemini", "openai", "openai-compatible"):
            assert isinstance(factory.get_provider(name), BaseLLMProvider), name


# ── Legacy factory ───────────────────────────────────────────────────────────


class TestLegacyFactory:
    def test_legacy_factory_returns_mock(self):
        assert isinstance(LLMProviderFactory().get_provider("mock"), MockLLMProvider)

    def test_legacy_factory_returns_base_instance(self):
        assert isinstance(LLMProviderFactory().get_provider(), BaseLLMProvider)