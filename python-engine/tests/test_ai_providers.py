"""
Tests for ai providers — Mock, OpenAI-compatible, Ollama, OpenAI and Gemini.

Covers the provider behaviour contract:

  * MockLLMProvider: deterministic, prompt-independent, structurally valid JSON.
  * OpenAICompatibleProvider: prompt transmission, payload shape, and the
    HTTP 404 / connect / timeout / generic-exception / empty-response paths.
  * OllamaProvider: request payload and success/failure behaviour.
  * OpenAI / Gemini stubs: structured "not implemented" responses.
  * BaseLLMProvider: abstract contract cannot be instantiated directly.
"""

import json
from unittest.mock import patch

import httpx
import pytest

from ai.ollama_provider import OllamaProvider
from ai.providers.base_provider import BaseLLMProvider
from ai.providers.gemini_provider import GeminiProvider
from ai.providers.mock_provider import MockLLMProvider
from ai.providers.openai_compatible_provider import OpenAICompatibleProvider
from ai.providers.openai_provider import OpenAIProvider

CHAT_URL = "http://localhost:1234/v1/chat/completions"
OLLAMA_URL = "http://localhost:11434/api/generate"


class _FakeResponse:
    """Minimal stand-in for httpx.Response covering the accessed surface."""

    def __init__(self, status_code, payload=None, exc=None):
        self.status_code = status_code
        self._payload = payload
        self._exc = exc

    def json(self):
        if self._exc:
            raise self._exc
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", response=self)


class _RecordingClient:
    """Fake httpx client that records the last request."""

    def __init__(self):
        self.last_url = None
        self.last_json = None
        self.last_headers = None
        self.response = None  # a _FakeResponse or an exception instance

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        return False

    def post(self, url, json=None, headers=None):
        self.last_url = url
        self.last_json = json
        self.last_headers = headers
        if isinstance(self.response, Exception):
            raise self.response
        if self.response is not None:
            return self.response
        return _FakeResponse(200, None)


def _provider_module(provider):
    if isinstance(provider, OpenAICompatibleProvider):
        import ai.providers.openai_compatible_provider as module

        return module
    import ai.ollama_provider as module

    return module


def _httpx_client_patch(provider, client):
    """Context manager stubbing the provider's ``httpx.Client`` so the
    provider talks to the fake recording client instead of the network."""
    module = _provider_module(provider)
    return patch.object(module.httpx, "Client", return_value=client)


def _openai_compatible(model="qwen2.5-coder-7b-instruct", **kwargs) -> OpenAICompatibleProvider:
    return OpenAICompatibleProvider(model=model, **kwargs)


def _ollama(model="llama3.2", **kwargs) -> OllamaProvider:
    return OllamaProvider(model=model, **kwargs)


def _success_payload():
    return {
        "choices": [{"message": {"content": "  Hello from server  "}}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
    }


# ── MockLLMProvider ───────────────────────────────────────────────────────────────


class TestMockProvider:
    def test_returns_valid_json(self):
        assert isinstance(json.loads(MockLLMProvider().generate_response("anything")), dict)

    def test_payload_shape(self):
        body = json.loads(MockLLMProvider().generate_response("p"))
        assert set(body.keys()) == {"provider", "success", "response", "tokens_used"}

    def test_success_fields(self):
        body = json.loads(MockLLMProvider().generate_response("p"))
        assert body["success"] is True
        assert body["provider"] == "mock"
        assert body["tokens_used"] == 0

    def test_response_message(self):
        body = json.loads(MockLLMProvider().generate_response("p"))
        assert body["response"] == "Mock response generated successfully."

    def test_output_is_deterministic(self):
        provider = MockLLMProvider()
        assert provider.generate_response("prompt A") == provider.generate_response("prompt B")

    def test_prompt_is_ignored(self):
        provider = MockLLMProvider()
        assert provider.generate_response("") == provider.generate_response("full prompt")

    def test_is_base_llm_provider(self):
        assert isinstance(MockLLMProvider(), BaseLLMProvider)


# ── OpenAICompatibleProvider ─────────────────────────────────────────────────────


class TestOpenAICompatibleProvider:
    def test_success_parses_response(self):
        client = _RecordingClient()
        client.response = _FakeResponse(200, _success_payload())
        provider = _openai_compatible()
        with _httpx_client_patch(provider, client):
            body = json.loads(provider.generate_response("p"))
        assert body["provider"] == "openai-compatible"
        assert body["success"] is True
        assert body["response"] == "Hello from server"
        assert body["tokens_used"] == {"prompt": 10, "completion": 5, "total": 15}

    def test_prompt_transmitted_in_chat_message(self):
        client = _RecordingClient()
        client.response = _FakeResponse(200, _success_payload())
        provider = _openai_compatible()
        with _httpx_client_patch(provider, client):
            provider.generate_response("the user prompt")
        assert client.last_url == CHAT_URL
        assert client.last_json["messages"] == [{"role": "user", "content": "the user prompt"}]
        assert client.last_json["model"] == "qwen2.5-coder-7b-instruct"
        assert client.last_json["stream"] is False

    def test_temperature_and_max_tokens_sent_when_configured(self):
        client = _RecordingClient()
        client.response = _FakeResponse(200, _success_payload())
        provider = _openai_compatible(temperature=0.2, max_tokens=1024)
        with _httpx_client_patch(provider, client):
            provider.generate_response("hi")
        assert client.last_json["temperature"] == 0.2
        assert client.last_json["max_tokens"] == 1024

    def test_generation_params_omitted_when_not_configured(self):
        client = _RecordingClient()
        client.response = _FakeResponse(200, _success_payload())
        provider = _openai_compatible()
        with _httpx_client_patch(provider, client):
            provider.generate_response("hi")
        assert "temperature" not in client.last_json
        assert "max_tokens" not in client.last_json

    def test_authorization_header_when_api_key(self):
        client = _RecordingClient()
        client.response = _FakeResponse(200, _success_payload())
        provider = _openai_compatible(api_key="sk-test")
        with _httpx_client_patch(provider, client):
            provider.generate_response("hi")
        assert client.last_headers["Authorization"] == "Bearer sk-test"

    def test_no_authorization_header_without_api_key(self):
        client = _RecordingClient()
        client.response = _FakeResponse(200, _success_payload())
        provider = _openai_compatible(api_key="")
        with _httpx_client_patch(provider, client):
            provider.generate_response("hi")
        assert "Authorization" not in client.last_headers

    def test_404_returns_model_error(self):
        client = _RecordingClient()
        client.response = _FakeResponse(404, {"error": {"message": "model not loaded"}})
        provider = _openai_compatible()
        with _httpx_client_patch(provider, client):
            body = json.loads(provider.generate_response("hi"))
        assert body["success"] is False
        assert "model not loaded" in body["error"]
        assert body["response"] is None

    def test_no_choices_returns_error(self):
        client = _RecordingClient()
        client.response = _FakeResponse(200, {"choices": []})
        provider = _openai_compatible()
        with _httpx_client_patch(provider, client):
            body = json.loads(provider.generate_response("hi"))
        assert body["success"] is False
        assert "No choices returned" in body["error"]

    def test_empty_content_returns_error(self):
        client = _RecordingClient()
        client.response = _FakeResponse(200, {"choices": [{"message": {"content": "  "}}]})
        provider = _openai_compatible()
        with _httpx_client_patch(provider, client):
            body = json.loads(provider.generate_response("hi"))
        assert body["success"] is False
        assert "Empty response content" in body["error"]

    def test_connect_error_returns_message(self):
        client = _RecordingClient()
        client.response = httpx.ConnectError("Connection refused")
        provider = _openai_compatible()
        with _httpx_client_patch(provider, client):
            body = json.loads(provider.generate_response("hi"))
        assert body["success"] is False
        assert "Cannot connect to" in body["error"]

    def test_timeout_error_returns_message(self):
        client = _RecordingClient()
        client.response = httpx.TimeoutException("slow")
        provider = _openai_compatible()
        with _httpx_client_patch(provider, client):
            body = json.loads(provider.generate_response("hi"))
        assert body["success"] is False
        assert "timed out" in body["error"]

    def test_generic_exception_returns_message(self):
        client = _RecordingClient()
        client.response = RuntimeError("boom")
        provider = _openai_compatible()
        with _httpx_client_patch(provider, client):
            body = json.loads(provider.generate_response("hi"))
        assert body["success"] is False
        assert body["error"] == "boom"

    def test_unknown_exception_never_propagates(self):
        """Providers must translate transport errors into JSON, never raise."""
        for exc in (ValueError("v"), KeyError("k"), httpx.TimeoutException("t")):
            client = _RecordingClient()
            client.response = exc
            provider = _openai_compatible()
            with _httpx_client_patch(provider, client):
                body = json.loads(provider.generate_response("hi"))
            assert body["success"] is False

    def test_is_base_llm_provider(self):
        assert isinstance(_openai_compatible(), BaseLLMProvider)


# ── OllamaProvider ──────────────────────────────────────────────────────────────


class TestOllamaProvider:
    def test_success_parses_response(self):
        client = _RecordingClient()
        client.response = _FakeResponse(200, {"response": "  ollama answer  "})
        provider = _ollama()
        with _httpx_client_patch(provider, client):
            body = json.loads(provider.generate_response("hi"))
        assert body["provider"] == "ollama"
        assert body["success"] is True
        assert body["response"] == "ollama answer"

    def test_payload_sent_to_generate_api(self):
        client = _RecordingClient()
        client.response = _FakeResponse(200, {"response": "ok"})
        provider = _ollama(model="mistral")
        with _httpx_client_patch(provider, client):
            provider.generate_response("hi")
        assert client.last_url == OLLAMA_URL
        assert client.last_json == {"model": "mistral", "prompt": "hi", "stream": False}

    def test_generation_options_sent_when_configured(self):
        client = _RecordingClient()
        client.response = _FakeResponse(200, {"response": "ok"})
        provider = _ollama(model="mistral", temperature=0.2, max_tokens=1024)
        with _httpx_client_patch(provider, client):
            provider.generate_response("hi")
        assert client.last_json["options"] == {"temperature": 0.2, "num_predict": 1024}

    def test_generation_options_omitted_when_not_configured(self):
        client = _RecordingClient()
        client.response = _FakeResponse(200, {"response": "ok"})
        provider = _ollama()
        with _httpx_client_patch(provider, client):
            provider.generate_response("hi")
        assert "options" not in client.last_json

    def test_404_returns_pull_hint(self):
        client = _RecordingClient()
        client.response = _FakeResponse(404, {})
        provider = _ollama()
        with _httpx_client_patch(provider, client):
            body = json.loads(provider.generate_response("hi"))
        assert body["success"] is False
        assert "ollama pull" in body["error"]

    def test_connect_error_returns_message(self):
        client = _RecordingClient()
        client.response = httpx.ConnectError("refused")
        provider = _ollama()
        with _httpx_client_patch(provider, client):
            body = json.loads(provider.generate_response("hi"))
        assert body["success"] is False
        assert "Cannot connect to Ollama" in body["error"]

    def test_timeout_error_returns_message(self):
        client = _RecordingClient()
        client.response = httpx.TimeoutException("slow")
        provider = _ollama()
        with _httpx_client_patch(provider, client):
            body = json.loads(provider.generate_response("hi"))
        assert body["success"] is False
        assert "timed out" in body["error"]

    def test_empty_response_returns_error(self):
        client = _RecordingClient()
        client.response = _FakeResponse(200, {"response": ""})
        provider = _ollama()
        with _httpx_client_patch(provider, client):
            body = json.loads(provider.generate_response("hi"))
        assert body["success"] is False
        assert "empty response" in body["error"]

    def test_is_base_llm_provider(self):
        assert isinstance(_ollama(), BaseLLMProvider)


# ── OpenAI / Gemini stubs ─────────────────────────────────────────────────


class TestStubProviders:
    def test_openai_stub_not_implemented(self):
        body = json.loads(OpenAIProvider().generate_response("hi"))
        assert body["provider"] == "openai"
        assert body["success"] is False
        assert "not yet implemented" in body["error"]
        assert body["response"] is None

    def test_gemini_stub_not_implemented(self):
        body = json.loads(GeminiProvider().generate_response("hi"))
        assert body["provider"] == "gemini"
        assert body["success"] is False
        assert "not yet implemented" in body["error"]
        assert body["response"] is None

    def test_stubs_are_base_providers(self):
        assert isinstance(OpenAIProvider(), BaseLLMProvider)
        assert isinstance(GeminiProvider(), BaseLLMProvider)


# ── Base contract ────────────────────────────────────────────────────────────


class TestBaseContract:
    def test_base_provider_cannot_be_instantiated(self):
        with pytest.raises(TypeError):
            BaseLLMProvider()

    def test_subclass_must_implement_generate_response(self):
        class Incomplete(BaseLLMProvider):
            pass

        with pytest.raises(TypeError):
            Incomplete()