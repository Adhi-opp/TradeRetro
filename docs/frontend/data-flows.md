# TradeRetro Frontend — Data Flows

One backend (`localhost:8000`), one origin, JSON REST. This page documents who
calls what, and the two HTTP clients in use.

## HTTP clients

### `services/apiClient.js` (axios)

```js
API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
```

- Axios instance with `baseURL`, JSON headers, `ApiError` normalization.
- `setAuthTokenProvider(fn)` — optional auth header injection
  (future/optional auth flows); not used by the stock UI.
- Used by: `aiService`, `marketService`, `pipelineService`, `feedbackService`.

### Raw `fetch` (with custom timeouts)

- `useBacktestStore` — 30 s aborting timeout on `/api/backtest`
  (`fetchWithTimeout`), because the engine's wall-clock can exceed axios
  defaults during parameter sweeps/WFA.
- `TickerInput` — `/api/universe` load and `/api/ingest/status/{jobId}`
  polling (2 s interval).

> Design note: `services/backtestService.js` exists with the full backtest
> contract (`/api/backtest`, `/sweep`, `/wfa`) as a reference/DSL, but the
> store deliberately uses its own tuned fetch — keep both in sync when the
> API changes.

## Call map

| Client surface | Endpoint(s) | Consumer | Notes |
|---|---|---|---|
| `runBacktest` | `POST /api/backtest` | `useBacktestStore` | payload `{symbol, strategyType, params, startDate, endDate}`; see store doc |
| `ParameterSweep` | `GET /api/backtest/sweep?…` | Deep Analytics | Margin sweep over param ranges → heatmap |
| `WalkForward` | `GET /api/backtest/wfa?…` | Deep Analytics | Walk-forward splits + report |
| `ChartWidget` | `GET /api/live/prices`, `/api/backtest/sweep` | Equity overlay candlesticks | Lightweight-charts render |
| `aiService.fetchModels` | `GET /api/ai/models` | `useAIStore.loadModels` | Registry for settings + header chip |
| `aiService.generate` | `POST /api/ai/generate` | `useAIStore.sendMessage` | `mode: chat/report`, `provider_name`, transient `api_key` |
| `marketService` | `GET /api/live/quotes`, `/api/live/vix`, `/api/live/signals`, `/api/signals/unified/{ticker}` | Idle dashboard strips, TearsheetGrid live cards, CrossAssetMonitor | |
| `pipelineService` | `GET /api/health`, `/api/health/pipeline` | PipelineDashboard | Worker + scheduler telemetry |
| `quality` | `GET /api/quality/audit`, `/api/quality/audit/{ticker}` | DataQualityDashboard | Freshness/completeness gates |
| `universe` | `GET /api/universe` | TickerInput, ControlBar | Symbol list + asset class |
| `ingestion` | `POST /api/ingest` → `GET /api/ingest/status/{jobId}` | TickerInput Add-ticker | Async job; sync polled |
| `feedbackService` | `POST /api/feedback` | FeedbackModal | Survey submit |

## Flow: running a backtest

```
ControlBar (Execute Backtest)
 └─ useBacktestStore.runBacktest()
     ├─ buildParams(): UI config → engine params
     └─ POST /api/backtest (30s timeout)
         ├─ ok    → set result, ranTicker/ranRange/ranStrategyParams,
         │          execution-status → "Results ready"
         └─ error → map message → execution-status "Execution failed" + toast

TearsheetGrid renders from `result`:
 ├─ KpiRibbon (metrics from response)
 ├─ StrategyAssessment (grades + verdict, computed client-side)
 ├─ EquityChart / DrawdownChart / TradeLog (from response arrays)
 └─ Deep Analytics (on expand):
     ├─ ChartWidget → /api/live/prices + sweep
     ├─ RiskMetricsGrid (from analytics payload)
     ├─ MonthlyHeatmap / ReturnDistribution (analytics)
     ├─ ParameterSweep → /api/backtest/sweep
     └─ WalkForward → /api/backtest/wfa
```

## Flow: AI Copilot message

```
Quick action / typed prompt
 └─ useAIStore.sendMessage(text)
     ├─ derive providerOverride ← selectedModel.provider
     ├─ buildAiContext(backtest snapshot) → market/strategy/backtest/metrics
     ├─ aiService.generate(text, providerOverride, contextPayload)
     └─ POST /api/ai/generate
         ├─ success → assistant message (Markdown rendered)
         └─ failure → friendly error; header may flip to Not Available

Headers: transient api_key from userApiKey travels per-request only
(never stored client-side).
```

## Flow: adding a ticker

```
TickerInput → POST /api/ingest {symbol}
   └─ poll GET /api/ingest/status/{jobId} every 2 s
       ├─ completed → refresh /api/universe, autofill selection
       └─ failed   → surface error in the add panel
```

## Error & loading conventions

- Every panel has explicit loading / error / empty states (`LoadingState`,
  error banners, `ErrorBoundary` fallbacks in `TearsheetGrid`).
- Backend contract errors (400 validation details, 500s) are unwrapped by
  `getErrorMessage`/`ApiError` into human messages ("Backend rejected the
  request", "Request timed out — the server took too long to respond").
- CORS: backend `allow_origins=["*"]` — browser calls are same-origin-agnostic;
  missing backend manifests as `Failed to fetch` → graceful empty states, never
  white screens.