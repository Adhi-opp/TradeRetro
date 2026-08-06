"""
Tests for ai/service.py — AIService orchestration.
==================================================
Verifies the service contract: success/error payload shape, strict exception
containment (no uncaught exceptions escape to the API), provider selection
through the injected factory, context propagation into the returned payload,
and prompt propagation to providers.

The provider factory is stubbed so no network or LLM calls are made.
"""

import json

from ai.config import AIConfig
from ai.context_builder import ContextBuilder
from ai.prompt_builder import PromptBuilder
from ai.service import AIService


# ── Fakes ───────────────────────────────────────────────────────────────────


class _StubFactory:
    """Deterministic stand-in for AIProviderFactory."""

    def __init__(self, provider):
        self.provider = provider
        self.requested = None

    def get_provider(self, name):
        self.requested = name
        return self.provider


class _RaisingFactory:
    """Factory whose selected provider always raises, simulating a broken
    backend (e.g. an unreachable LM Studio)."""

    def __init__(self, exc):
        self.exc = exc

    def get_provider(self, name):
        raise self.exc


class _EchoProvider:
    """Provider that returns a deterministic JSON payload."""

    def generate_response(self, prompt):
        return json.dumps({"provider": "echo", "success": True, "response": "echo reply"})


class _RawTextProvider:
    """Provider that returns a non-JSON plain text string."""

    def generate_response(self, prompt):
        return "plain text, not json"


def _make_service(provider=None, factory=None):
    """Builds an AIService with injected, deterministic internals."""
    if factory is None:
        factory = _StubFactory(provider or _EchoProvider())
    return AIService(
        context_builder=ContextBuilder(),
        prompt_builder=PromptBuilder(),
        provider_factory=factory,
    ), factory


# ── Successful generation ───────────────────────────────────────────────────


class TestSuccessPath:
    def test_generation_succeeds(self):
        svc, _ = _make_service()
        assert svc.generate_response("Is this profitable?", provider_name="mock")["success"] is True

    def test_response_payload_shape(self):
        svc, _ = _make_service()
        result = svc.generate_response("Query A", provider_name="mock")
        assert set(result.keys()) == {
            "success", "provider", "user_query", "prompt", "context", "response", "error",
        }

    def test_provider_passthrough(self):
        svc, factory = _make_service()
        svc.generate_response("q", provider_name="llama3.2")
        assert factory.requested == "llama3.2"

    def test_default_provider_is_config_model(self):
        svc, factory = _make_service()
        svc.generate_response("q")
        assert factory.requested == AIConfig().model

    def test_provider_echoes_in_response(self):
        svc, _ = _make_service()
        assert svc.generate_response("q", provider_name="mock")["provider"] == "mock"

    def test_user_query_echoes(self):
        svc, _ = _make_service()
        assert svc.generate_response("my question", provider_name="mock")["user_query"] == "my question"

    def test_prompt_built_and_carries_query(self):
        svc, _ = _make_service()
        result = svc.generate_response("Explain Drawdown?", provider_name="mock")
        assert isinstance(result["prompt"], str) and len(result["prompt"]) > 0
        assert "Explain Drawdown?" in result["prompt"]

    def test_error_none_on_success(self):
        svc, _ = _make_service()
        assert svc.generate_response("q", provider_name="mock")["error"] is None

    def test_context_shape(self):
        svc, _ = _make_service()
        ctx = svc.generate_response("q", provider_name="mock")["context"]
        assert set(ctx.keys()) == {
            "user", "market", "strategy", "backtest", "metrics", "portfolio", "metadata",
        }
        assert set(ctx["user"].keys()) == {"message", "conversation_id", "session_id"}

    def test_context_domains_available_when_populated(self):
        svc, _ = _make_service()
        result = svc.generate_response(
            "q", provider_name="mock",
            metrics_data={"sharpe_ratio": 1.9}, market_data={"symbol": "X"},
        )
        ctx = result["context"]
        assert ctx["metrics"]["available"] is True
        assert ctx["metrics"]["data"]["sharpe_ratio"] == 1.9
        assert ctx["market"]["available"] is True
        assert ctx["strategy"]["available"] is False

    def test_metric_context_reaches_prompt(self):
        svc, _ = _make_service()
        result = svc.generate_response("q", provider_name="mock", metrics_data={"sharpe_ratio": 2.2})
        assert "sharpe_ratio" in result["prompt"]

    def test_absent_domains_flagged_unavailable(self):
        svc, _ = _make_service()
        ctx = svc.generate_response("q", provider_name="mock")["context"]
        for domain in ("market", "strategy", "backtest", "portfolio"):
            assert ctx[domain]["available"] is False
            assert ctx[domain]["data"] is None


# ── Response parsing ────────────────────────────────────────────────────────


class TestJsonParsing:
    def test_valid_json_output_parsed(self):
        svc, _ = _make_service()
        result = svc.generate_response("q", provider_name="mock")
        assert result["response"] == {
            "provider": "echo", "success": True, "response": "echo reply",
        }

    def test_non_json_output_wrapped_in_raw_response(self):
        svc, _ = _make_service(provider=_RawTextProvider())
        result = svc.generate_response("q", provider_name="mock")
        assert result["success"] is True
        assert result["response"] == {"raw_response": "plain text, not json"}


# ── Failure / exception containment ─────────────────────────────────────────


class TestFailureHandling:
    def test_provider_exception_returns_success_false(self):
        svc, _ = _make_service(factory=_RaisingFactory(RuntimeError("broken backend")))
        assert svc.generate_response("q", provider_name="mock")["success"] is False

    def test_provider_exception_does_not_escape(self):
        svc, _ = _make_service(factory=_RaisingFactory(RuntimeError("boom")))
        svc.generate_response("q", provider_name="mock")  # must not raise

    def test_error_keeps_provider_and_query(self):
        svc, _ = _make_service(factory=_RaisingFactory(RuntimeError("x")))
        result = svc.generate_response("my query", provider_name="mock")
        assert result["provider"] == "mock"
        assert result["user_query"] == "my query"

    def test_error_contains_exception_message(self):
        svc, _ = _make_service(factory=_RaisingFactory(RuntimeError("connection refused")))
        assert "connection refused" in svc.generate_response("q", provider_name="mock")["error"]

    def test_error_payload_compact_shape(self):
        svc, _ = _make_service(factory=_RaisingFactory(RuntimeError("boom")))
        result = svc.generate_response("q", provider_name="mock")
        assert set(result.keys()) == {"success", "provider", "user_query", "error"}

    def test_unknown_provider_error_preserved(self):
        svc, _ = _make_service(factory=_RaisingFactory(ValueError("Unsupported provider 'foo'")))
        result = svc.generate_response("q", provider_name="foo")
        assert result["success"] is False
        assert "Unsupported provider 'foo'" in result["error"]


# ── Robustness ──────────────────────────────────────────────────────────────


class TestRobustness:
    def test_empty_query_handled(self):
        svc, _ = _make_service()
        assert svc.generate_response("", provider_name="mock")["success"] is True

    def test_blank_query_uses_prompt_fallback(self):
        svc, _ = _make_service()
        assert "No user query provided." in svc.generate_response("")["prompt"]

    def test_context_outputs_are_deterministic_envelopes(self):
        svc, _ = _make_service()
        a = svc.generate_response("q", provider_name="mock")["context"]
        b = svc.generate_response("q", provider_name="mock")["context"]
        a["metadata"].pop("generated_at")
        b["metadata"].pop("generated_at")
        assert a == b