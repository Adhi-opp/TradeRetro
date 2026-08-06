# AI Context Builder

The `ContextBuilder` class in `python-engine/ai/context_builder.py` aggregates structured data from multiple trading system domains into a unified context dictionary for LLM consumption.

## What It Does

Raw domain data — market prices, strategy parameters, backtest results — enters in one shape and leaves as a structured, standardized dict. This decouples data collection from prompt construction: the `PromptBuilder` only needs to check `available` flags; it never needs to know where data originated or what keys to expect.

## Domain Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CONTEXT BUILDER                       │
│                                                         │
│  build_context(                                          │
│    user_data, market_data, strategy_data,                │
│    backtest_data, metrics_data, portfolio_data,          │
│    sources                                               │
│  )                                                       │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  USER    │  │  MARKET  │  │ STRATEGY │  │BACKTEST │ │
│  │          │  │          │  │          │  │         │ │
│  │ message  │  │available │  │available │  │available│ │
│  │ conv_id  │  │source    │  │source    │  │source   │ │
│  │ sess_id  │  │data      │  │data      │  │data     │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│  ┌──────────┐  ┌──────────┐                               │
│  │ METRICS  │  │PORTFOLIO │                               │
│  │          │  │          │                               │
│  │available │  │available │                               │
│  │source    │  │source    │                               │
│  │data      │  │data      │                               │
│  └──────────┘  └──────────┘                               │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  METADATA                                        │   │
│  │  generated_at, total_domains, populated_domains, │   │
│  │  domains_with_data                                │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Domain Details

### User Domain

**Builder:** `_build_user_context(data, source)`

**Schema (guaranteed, even with `None` input):**

```python
{
    "message": str,           # User query, default ""
    "conversation_id": str,   # or None
    "session_id": str,        # or None
}
```

**Special behavior:** Unlike other domains, the user domain does not use the envelope pattern. It always returns exactly these three fields. This is because the PromptBuilder needs to extract the user's `message` directly, and the envelope would add an extra nesting level.

### Market Domain

**Builder:** `_build_market_context(data, source)`

**Expected data:** Market price series, quotes, or any market-related information.

### Strategy Domain

**Builder:** `_build_strategy_context(data, source)`

**Expected data:** Strategy configuration, parameters, entry/exit rules.

### Backtest Domain

**Builder:** `_build_backtest_context(data, source)`

**Expected data:** Backtest execution results, trade logs, equity curves.

### Metrics Domain

**Builder:** `_build_metrics_context(data, source)`

**Expected data:** Quantitative performance metrics (Sharpe ratio, drawdown, win rate, returns, etc.).

### Portfolio Domain

**Builder:** `_build_portfolio_context(data, source)`

**Expected data:** Current portfolio positions, cash balances, exposure.

## Envelope Pattern (Market, Strategy, Backtest, Metrics, Portfolio)

Each non-user domain uses the same envelope structure:

```python
{
    "available": bool,       # True if data is not None and not empty
    "source": str | None,    # Source identifier (or None if unavailable)
    "data": dict | None,     # The actual payload (or None if unavailable)
}
```

**Why the envelope?**
- The PromptBuilder can check `domain["available"]` without knowing the data shape
- Sources can be tagged (e.g., `"yahoo-finance"`, `"backtest-engine"`) for attribution in the response
- Unavailable domains produce a consistent `{"available": false, "source": null, "data": null}` instead of missing keys

## Metadata

After assembling all domains, the builder appends a metadata block:

```python
{
    "generated_at": "2026-07-25T03:00:00.000000+00:00",  # UTC ISO 8601
    "total_domains": 6,      # Always 6 (user + 5 domain envelopes)
    "populated_domains": 2,  # Count of envelope domains with data available
    "domains_with_data": ["market", "metrics"],  # Populated envelope domain names
}
```

The `user` domain is not an envelope domain and is therefore **excluded** from
`populated_domains` and `domains_with_data` — those counts describe only the five
data domains (market, strategy, backtest, metrics, portfolio).

The metadata is useful for:
- Logging/debugging what data was provided
- Downstream analytics on context coverage
- PromptBuilder can use populated_domains count for conditional formatting (not currently implemented)

## Data Flow

```
AIService.generate_response()
         │
         │  market_data = {"symbol": "RELIANCE.NS", "close": 2850.0}
         │  metrics_data = {"sharpe_ratio": 1.45}
         │  (other domains: None)
         ▼
ContextBuilder.build(
    market_data={...},
    metrics_data={...},
)
         │
         ▼
{
    "user": {"message": "...", "conversation_id": None, "session_id": None},
    "market": {"available": true, "source": None, "data": {"symbol": "RELIANCE.NS", ...}},
    "strategy": {"available": false, "source": null, "data": null},
    "backtest": {"available": false, "source": null, "data": null},
    "metrics": {"available": true, "source": None, "data": {"sharpe_ratio": 1.45}},
    "portfolio": {"available": false, "source": null, "data": null},
    "metadata": {
        "generated_at": "2026-07-25T03:00:00+00:00",
        "total_domains": 6,
        "populated_domains": 2,
        "domains_with_data": ["market", "metrics"]
    }
}
         │
         ▼
PromptBuilder.build_prompt(context)
```

## Source Tagging

The optional `sources` parameter maps domain names to source identifiers:

```python
context = builder.build_context(
    market_data={...},
    metrics_data={...},
    sources={
        "market": "yahoo-finance",
        "metrics": "backtest-engine",
    }
)
# → market: {"available": true, "source": "yahoo-finance", "data": {...}}
# → metrics: {"available": true, "source": "backtest-engine", "data": {...}}
```

Sources are displayed in the prompt as `[Market Data] (Source: yahoo-finance)`, helping the LLM attribute information and cite data origins.

## Compatibility Wrapper

`ContextBuilder.build(market_data, strategy_data, ...)` calls `build_context` with `user_data=None`. New code should call `build_context()` directly — the parameter names make the intent clearer.

## Adding New Domains

The envelope pattern keeps extension simple. To add a domain:

1. Add a private builder method (e.g., `_build_sentiment_context()`)
2. Add the domain to `build_context()`'s parameters
3. Add it to the `contexts` dict in `build_context()`
4. Add a label mapping in `PromptBuilder._build_context()`

No changes to the orchestration layer or router are required — the new domain will use the existing envelope and availability-checking logic.
