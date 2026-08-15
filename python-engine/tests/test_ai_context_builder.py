"""
Tests for ai/context_builder.py — ContextBuilder.

Verifies the context envelope contract used by the AI pipeline:

  * Envelope format: every data domain (market/strategy/backtest/metrics/
    portfolio) is a dict with exactly ``{available, source, data}``.
  * Availability contract: empty -> ``available = False``; populated ->
    ``available = True`` with data (and source when supplied) preserved.
  * User domain schema: ``message`` / ``conversation_id`` / ``session_id``.
  * Metadata: ``total_domains``, ``populated_domains``,
    ``domains_with_data`` and a UTC ISO timestamp.
  * Field hygiene: no unexpected fields leak into envelopes, top level or
    metadata; legacy ``build()`` matches ``build_context()``.
"""

from datetime import datetime

import pytest

from ai.context_builder import ContextBuilder

DATA_DOMAINS = ("market", "strategy", "backtest", "metrics", "portfolio")
EXPECTED_TOP_LEVEL = {"user", "market", "strategy", "backtest", "metrics", "portfolio", "metadata"}
ENVELOPE_KEYS = {"available", "source", "data"}


@pytest.fixture
def builder() -> ContextBuilder:
    return ContextBuilder()


def _populated_kwargs() -> dict:
    return {
        "market_data": {"symbol": "RELIANCE.NS", "close": 2850.0},
        "strategy_data": {"type": "MOVING_AVERAGE_CROSSOVER"},
        "backtest_data": {"trades": 42, "period_days": 252},
        "metrics_data": {"sharpe_ratio": 1.45, "max_drawdown": -0.12},
        "portfolio_data": {"cash": 100_000},
    }


def _strip_timestamp(ctx: dict) -> dict:
    """Returns a copy of the context without the volatile generated_at stamp."""
    stripped = {k: v for k, v in ctx.items() if k != "metadata"}
    stripped["metadata"] = {k: v for k, v in ctx["metadata"].items() if k != "generated_at"}
    return stripped


# ── Envelope format ─────────────────────────────────────────────────────────


class TestEnvelopeFormat:
    def test_envelope_has_exactly_three_keys(self, builder):
        env = builder._create_envelope(source="src", data={"a": 1})
        assert set(env.keys()) == ENVELOPE_KEYS

    def test_envelope_populated(self, builder):
        env = builder._create_envelope(source="engine", data={"k": "v"})
        assert env == {"available": True, "source": "engine", "data": {"k": "v"}}

    def test_envelope_empty(self, builder):
        env = builder._create_envelope(source="engine", data=None)
        assert env["available"] is False
        assert env["source"] is None
        assert env["data"] is None

    def test_empty_dict_envelope_unavailable(self, builder):
        env = builder._create_envelope(source="engine", data={})
        assert env["available"] is False
        assert env["source"] is None
        assert env["data"] is None

    def test_none_source_with_data_still_available(self, builder):
        env = builder._create_envelope(source=None, data={"x": 1})
        assert env["available"] is True
        assert env["source"] is None
        assert env["data"] == {"x": 1}

    @pytest.mark.parametrize("domain", DATA_DOMAINS)
    def test_all_data_domains_use_envelope_schema(self, builder, domain):
        ctx = builder.build_context(**_populated_kwargs())
        assert ctx[domain].keys() == ENVELOPE_KEYS
        assert isinstance(ctx[domain].get("available"), bool)

    def test_user_domain_is_not_an_envelope(self, builder):
        ctx = builder.build_context(user_data={"message": "hi"})
        assert set(ctx["user"].keys()) == {"message", "conversation_id", "session_id"}
        assert "available" not in ctx["user"]


# ── Availability contract ───────────────────────────────────────────────────


class TestAvailabilityContract:
    def test_empty_context_has_no_available_domains(self, builder):
        ctx = builder.build_context()
        for domain in DATA_DOMAINS:
            assert ctx[domain]["available"] is False, domain
            assert ctx[domain]["data"] is None, domain

    def test_each_populated_domain_is_available(self, builder):
        ctx = builder.build_context(**_populated_kwargs())
        for domain in DATA_DOMAINS:
            assert ctx[domain]["available"] is True, domain
            assert ctx[domain]["data"], f"{domain} data must be present"

    def test_single_populated_domain(self, builder):
        ctx = builder.build_context(metrics_data={"sharpe_ratio": 1.5})
        assert ctx["metrics"]["available"] is True
        assert ctx["market"]["available"] is False

    def test_source_propagated_only_with_data(self, builder):
        ctx = builder.build_context(
            market_data={"symbol": "X"}, sources={"market": "market-service"},
        )
        assert ctx["market"]["source"] == "market-service"

    def test_source_dropped_without_data(self, builder):
        ctx = builder.build_context(sources={"market": "svc"})
        assert ctx["market"] == {"available": False, "source": None, "data": None}

    def test_data_payload_preserved_intact(self, builder):
        payload = {"sharpe_ratio": 1.45, "max_drawdown": -0.12}
        ctx = builder.build_context(metrics_data=payload)
        assert ctx["metrics"]["data"] == payload


# ── User context ────────────────────────────────────────────────────────────


class TestUserContext:
    def test_user_message_preserved(self, builder):
        ctx = builder.build_context(user_data={"message": "analyse the backtest"})
        assert ctx["user"]["message"] == "analyse the backtest"

    def test_user_ids_propagated(self, builder):
        ctx = builder.build_context(
            user_data={"message": "m", "conversation_id": "c1", "session_id": "s1"},
        )
        assert ctx["user"]["conversation_id"] == "c1"
        assert ctx["user"]["session_id"] == "s1"

    def test_missing_user_fields_defaulted(self, builder):
        assert builder.build_context()["user"] == {
            "message": "", "conversation_id": None, "session_id": None,
        }

    def test_partial_user_data_defaulted(self, builder):
        ctx = builder.build_context(user_data={"message": "only"})
        assert ctx["user"]["conversation_id"] is None
        assert ctx["user"]["session_id"] is None


# ── Metadata ────────────────────────────────────────────────────────────────


class TestMetadata:
    def test_total_domains_is_constant(self, builder):
        assert builder.build_context()["metadata"]["total_domains"] == len(DATA_DOMAINS) + 1

    def test_populated_domains_with_empty_context(self, builder):
        assert builder.build_context()["metadata"]["populated_domains"] == 0

    def test_populated_domains_count_with_one_domain(self, builder):
        ctx = builder.build_context(metrics_data={"sharpe_ratio": 1.5})
        assert ctx["metadata"]["populated_domains"] == 1

    def test_populated_domains_count_all_domains(self, builder):
        ctx = builder.build_context(**_populated_kwargs())
        assert ctx["metadata"]["populated_domains"] == len(DATA_DOMAINS)

    def test_domains_with_data_lists_available(self, builder):
        ctx = builder.build_context(metrics_data={"sharpe_ratio": 1.5})
        assert ctx["metadata"]["domains_with_data"] == ["metrics"]

    def test_metadata_timestamp_is_isoformat(self, builder):
        raw = builder.build_context()["metadata"]["generated_at"]
        assert isinstance(raw, str) and "T" in raw
        assert datetime.fromisoformat(raw) is not None

    def test_metadata_has_no_unexpected_fields(self, builder):
        assert set(builder.build_context()["metadata"].keys()) == {
            "generated_at", "total_domains", "populated_domains", "domains_with_data",
        }

    def test_user_domain_not_counted_as_data_domain(self, builder):
        ctx = builder.build_context(user_data={"message": "hi"})
        assert ctx["metadata"]["populated_domains"] == 0


# ── Top-level contract ──────────────────────────────────────────────────────


class TestTopLevel:
    def test_build_context_returns_all_domains(self, builder):
        assert set(builder.build_context().keys()) == EXPECTED_TOP_LEVEL

    def test_no_unexpected_top_level_fields(self, builder):
        ctx = builder.build_context(**_populated_kwargs())
        assert set(ctx.keys()) == EXPECTED_TOP_LEVEL

    def test_legacy_build_matches_build_context(self, builder):
        kwargs = _populated_kwargs()
        legacy = _strip_timestamp(builder.build(**kwargs))
        modern = _strip_timestamp(builder.build_context(**kwargs))
        assert legacy == modern

    def test_legacy_build_forwards_no_user_data(self, builder):
        legacy = _strip_timestamp(builder.build())
        modern = _strip_timestamp(builder.build_context())
        assert legacy == modern