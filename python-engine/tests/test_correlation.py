"""
Tests for the Correlation Lab.

Layer 1 — pure-math tests against engine.corr_engine with a seeded
DataFrame. No DB, no FastAPI, no network.

Layer 2 — router integration tests via TestClient, mocking the DB
fetch the same way test_routers.py does.
"""

import sys
import types
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pandas as pd
import pytest

# ── Stub heavy optional deps so main.py imports cleanly on thin venvs ──
for mod_name in ("redis", "redis.asyncio", "asyncpg", "prefect",
                 "prefect.deployments", "prefect.runtime"):
    if mod_name not in sys.modules:
        try:
            __import__(mod_name)
        except ImportError:
            stub = types.ModuleType(mod_name)
            stub.Redis = MagicMock
            stub.Pool = MagicMock
            stub.flow = lambda *a, **kw: (lambda f: f)
            stub.task = lambda *a, **kw: (lambda f: f)
            stub.get_run_logger = MagicMock
            sys.modules[mod_name] = stub


from engine import corr_engine  # noqa: E402


# ── Helpers ──────────────────────────────────────────────────────


def _make_prices(n_days: int = 150, seed: int = 42, tickers=None) -> pd.DataFrame:
    """Geometric Brownian walk, same drift, slightly different vol per ticker."""
    tickers = tickers or ["NIFTY50.NS", "RELIANCE.NS", "HDFCBANK.NS", "USDINR", "CRUDE"]
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range(end=date.today(), periods=n_days)

    data = {}
    for i, t in enumerate(tickers):
        rets = rng.normal(0.0003, 0.01 + 0.002 * i, size=n_days)
        prices = 100 * np.cumprod(1 + rets)
        data[t] = prices
    return pd.DataFrame(data, index=dates)


# ── Layer 1: pure-math ──────────────────────────────────────────


def test_matrix_diagonal_is_one_and_symmetric():
    prices = _make_prices(60)
    out = corr_engine.compute_corr_matrix(prices, window_days=30)

    assert out["status"] == "ok"
    assert len(out["tickers"]) == prices.shape[1]
    m = np.array(out["matrix"])
    # Diagonal = 1 exactly (after rounding).
    np.testing.assert_allclose(np.diag(m), 1.0, atol=1e-4)
    # Symmetric.
    np.testing.assert_allclose(m, m.T, atol=1e-4)
    # All values in [-1, 1].
    assert m.min() >= -1.0001 and m.max() <= 1.0001


def test_matrix_excludes_sparse_ticker():
    """A ticker with mostly NaN close prices should be excluded from the matrix."""
    prices = _make_prices(60)
    # Wipe out most observations for one ticker.
    sparse_col = prices.columns[0]
    prices.loc[prices.index[:55], sparse_col] = np.nan

    out = corr_engine.compute_corr_matrix(prices, window_days=30)
    excluded_tickers = {e["ticker"] for e in out["excluded_due_to_missing_data"]}
    assert sparse_col in excluded_tickers
    assert sparse_col not in out["tickers"]


def test_matrix_insufficient_data_empty_frame():
    out = corr_engine.compute_corr_matrix(pd.DataFrame(), window_days=20)
    assert out["status"] == "insufficient_data"
    assert out["tickers"] == []


def test_rolling_corr_series_length_is_bounded_by_lookback():
    prices = _make_prices(200)
    out = corr_engine.compute_rolling_corr(
        prices, base="NIFTY50.NS", peers=["RELIANCE.NS"],
        window_days=20, lookback_days=60,
    )
    assert out["status"] == "ok"
    assert len(out["series"]) == 1
    pts = out["series"][0]["points"]
    # Must not exceed lookback_days; allowed to be shorter if warehouse is thin.
    assert 0 < len(pts) <= 60
    # Every point is a valid float in [-1, 1].
    for p in pts:
        assert -1.0001 <= p["corr"] <= 1.0001


def test_leadlag_identical_series_zero_lag():
    """corr(x, x_{t-k}) is maximized at k=0 with value 1.0."""
    prices = _make_prices(120)
    # Force peer == base.
    prices["CLONE.NS"] = prices["NIFTY50.NS"]

    out = corr_engine.compute_lead_lag(
        prices, base="NIFTY50.NS", peers=["CLONE.NS"],
        max_lag=5, window_bars=60,
    )
    assert out["lead_lag_proxy"] is True
    assert "disclaimer" in out
    assert out["status"] == "ok"
    r = out["results"][0]
    assert r["best_lag_bars"] == 0
    assert r["corr_at_best"] >= 0.9999


def test_leadlag_recovers_known_shift_within_one_bar():
    """If peer is base shifted forward by +3, best lag should be within [2, 4]."""
    prices = _make_prices(200)
    base = prices["NIFTY50.NS"]
    shift_k = 3
    # peer_t = base_{t-3}  → peer leads by 3 when we correlate base_t vs peer_{t-k=3}.
    prices["SHIFTED"] = base.shift(-shift_k)
    prices = prices.dropna()

    out = corr_engine.compute_lead_lag(
        prices, base="NIFTY50.NS", peers=["SHIFTED"],
        max_lag=6, window_bars=120,
    )
    assert out["status"] == "ok"
    best = out["results"][0]["best_lag_bars"]
    assert abs(best - shift_k) <= 1


def test_leadlag_insufficient_data_empty_frame():
    out = corr_engine.compute_lead_lag(
        pd.DataFrame({"NIFTY50.NS": []}),
        base="NIFTY50.NS", peers=["RELIANCE.NS"],
        max_lag=5, window_bars=30,
    )
    assert out["status"] == "insufficient_data"
    assert out["lead_lag_proxy"] is True


def test_divergence_series_starts_at_zero_pct():
    prices = _make_prices(60)
    out = corr_engine.compute_divergence(
        prices, base="NIFTY50.NS", peers=["RELIANCE.NS", "CRUDE"],
        lookback_days=40,
    )
    assert out["status"] == "ok"
    for s in out["series"]:
        # First anchor point is always 0% by construction.
        assert abs(s["points"][0]["cum_pct"]) < 1e-6


# ── Layer 2: router integration ─────────────────────────────────


@pytest.fixture
def client():
    """TestClient with DB/Redis init stubbed so main.py boots without infra."""
    import services.db
    import services.redis_client

    with (
        patch.object(services.db, "init_pool", new_callable=AsyncMock),
        patch.object(services.redis_client, "init_redis", new_callable=AsyncMock),
        patch.object(services.db, "close_pool", new_callable=AsyncMock),
        patch.object(services.redis_client, "close_redis", new_callable=AsyncMock),
    ):
        from fastapi.testclient import TestClient
        from main import app
        with TestClient(app) as c:
            yield c


def _seed_rows(n_days: int = 60, tickers=None) -> list[dict]:
    """Return flat rows matching raw.historical_prices shape for the fake pool."""
    prices = _make_prices(n_days, tickers=tickers)
    rows = []
    for d, row in prices.iterrows():
        for t in prices.columns:
            rows.append({
                "ticker": t,
                "trade_date": d.date(),
                "close_price": float(row[t]),
            })
    return rows


def _fake_pool(rows):
    """Build an asyncpg-Pool look-alike whose conn.fetch returns `rows`."""
    conn = MagicMock()
    conn.fetch = AsyncMock(return_value=rows)

    class _AsyncCM:
        async def __aenter__(self_inner): return conn
        async def __aexit__(self_inner, *exc): return False

    pool = MagicMock()
    pool.acquire = MagicMock(return_value=_AsyncCM())
    return pool


def test_matrix_endpoint_returns_ok_with_seeded_data(client):
    rows = _seed_rows(60)
    with patch("routers.correlation.get_pool", return_value=_fake_pool(rows)):
        resp = client.get("/api/correlation/matrix?window_days=20")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert len(body["tickers"]) >= 2
    assert len(body["matrix"]) == len(body["tickers"])


def test_matrix_endpoint_insufficient_data_when_warehouse_empty(client):
    with patch("routers.correlation.get_pool", return_value=_fake_pool([])):
        resp = client.get("/api/correlation/matrix?window_days=20")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "insufficient_data"
    assert body["tickers"] == []


def test_leadlag_endpoint_carries_proxy_flag_and_disclaimer(client):
    rows = _seed_rows(120)
    with patch("routers.correlation.get_pool", return_value=_fake_pool(rows)):
        resp = client.get(
            "/api/correlation/leadlag"
            "?base=NIFTY%2050&peers=RELIANCE&peers=HDFCBANK"
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["lead_lag_proxy"] is True
    assert "disclaimer" in body and "Granger" in body["disclaimer"]
