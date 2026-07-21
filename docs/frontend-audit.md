# TradeRetro Frontend Audit

Audit date: 2026-07-12

Scope: React frontend in `client/`. This audit documents the current implementation only. It does not propose functional, styling, dependency, or UX changes as immediate edits.

## 1. Current Folder Structure

```text
TradeRetro/
  client/
    public/
      vite.svg
    src/
      assets/
        react.svg
      components/
        ChartWidget.jsx
        ControlBar.jsx
        CorrelationLab.jsx
        CrossAssetMonitor.jsx
        Dashboard.jsx
        DataQualityDashboard.jsx
        DrawdownChart.jsx
        EquityChart.jsx
        ErrorBoundary.jsx
        ExecutionSummary.jsx
        KpiRibbon.jsx
        Landing.jsx
        MetricsCard.jsx
        MonthlyHeatmap.jsx
        ParameterSweep.jsx
        PipelineDashboard.jsx
        ReturnDistribution.jsx
        RiskMetricsGrid.jsx
        StrategyConfig.jsx
        TearsheetGrid.jsx
        TickerInput.jsx
        TradeLog.jsx
        TradeStats.jsx
        TradeTable.jsx
        WalkForward.jsx
      store/
        useBacktestStore.js
      utils/
        performance.js
      api.js
      App.css
      App.jsx
      index.css
      main.jsx
    Dockerfile
    eslint.config.js
    index.html
    package-lock.json
    package.json
    README.md
    vite.config.js
  docs/
  python-engine/
  grafana/
```

Frontend stack:

- Vite + React 19.
- Zustand for backtest state.
- `fetch` for most API calls, plus an unused `axios` wrapper in `src/api.js`.
- Recharts and lightweight-charts for chart rendering.
- Lucide React for icons.
- CSS is held in `src/App.css` and `src/index.css`.

## 2. Component Hierarchy

```text
main.jsx
  App
    Landing
    Dashboard
      MarketClock
      AdminMenu
      Backtest mode:
        ControlBar
          TickerInput
        StrategyConfig
          StrategyParams
          NumField
        TearsheetGrid
          LoadingState
          IdleState
          KpiRibbon
          ErrorBoundary
            EquityChart
            TradeLog
            ChartWidget
            ParameterSweep
            WalkForward
          ExecutionSummary
          DrawdownChart
          RiskMetricsGrid
          MonthlyHeatmap
          ReturnDistribution
      Cross-Asset mode:
        CrossAssetMonitor
          LiveTickerRow
          VIXPanel
          SignalFeed
          PriceChartPanel
          CorrelationMatrixPanel
          RollingCorrPanel
          LeadLagPanel
          DivergencePanel
      Pipeline admin mode:
        PipelineDashboard
      Data quality admin mode:
        DataQualityDashboard
          QualityWarnings
          MedallionHealth
```

Additional component file:

- `CorrelationLab.jsx` contains an older or alternate correlation workspace but is not mounted by `Dashboard`.
- `TradeStats.jsx`, `TradeTable.jsx`, and `MetricsCard.jsx` are present but are not currently mounted in the observed component tree.

## 3. Routing Flow

There is no React Router or URL-based routing. Navigation is state-driven:

- `App` owns `hasEntered`.
- `hasEntered === false` renders `Landing`.
- `Landing` calls `onEnter`, which switches to `Dashboard`.
- `Dashboard` owns local `mode`.
- `mode === "manual"` renders the backtest workbench.
- `mode === "correlation"` renders `CrossAssetMonitor`.
- `mode === "pipeline"` renders `PipelineDashboard`.
- `mode === "data-quality"` renders `DataQualityDashboard`.
- Logo click in `Dashboard` calls `onLogoClick`, returning to `Landing`.

Theme flow is also app-state driven:

- `App` owns `theme`.
- Theme initializes from `localStorage["tr-theme"]`, defaulting to `dark`.
- `App` writes `data-theme` to `document.documentElement`.
- `Dashboard`, `Landing`, and `TearsheetGrid` receive theme through props where needed.

## 4. State Management Architecture

State is split across three levels:

- App-level local state:
  - `hasEntered`
  - `theme`

- Dashboard-level local state:
  - `mode`
  - `MarketClock` time interval state
  - `AdminMenu` open/closed state

- Zustand global backtest state in `useBacktestStore`:
  - Backtest inputs: ticker, dates, capital, costs flag.
  - Strategy inputs: strategy type and strategy-specific parameters.
  - Risk model inputs: enabled flag, risk percent, stop-loss percent.
  - Request lifecycle: loading, error.
  - Result data: result.
  - Run snapshot data: `ranTicker`, `ranRange`, `ranStrategyParams`.

Several feature components also own local async state:

- `TickerInput`: universe list, query, focus state, add/backfill polling state.
- `ParameterSweep`: selected sweep parameters, metric, running/error/result state.
- `WalkForward`: WFA form values, loading/error/result state.
- `CrossAssetMonitor`: panel-specific loading/error/data state across market, correlation, lead-lag, and divergence panels.
- `DataQualityDashboard`: audit, health, universe, loading, and error state.
- `ChartWidget`: chart instance refs, load/error state, series state, overlay state.

The architecture is pragmatic and compact, but not fully centralized. Backtest execution is centralized in the store; other domain workflows call APIs directly inside components.

## 5. API Communication Flow

Base URLs are hardcoded to localhost:

- `http://localhost:8000` for the FastAPI backend.
- `http://localhost:3000` for Grafana in `PipelineDashboard`.

Observed frontend-to-backend flows:

| Frontend area | Component/file | Endpoint(s) |
| --- | --- | --- |
| Main backtest | `store/useBacktestStore.js` | `POST /api/backtest` |
| Legacy/unused backtest wrapper | `src/api.js` | `POST /api/backtest` via axios |
| Price/signals chart | `ChartWidget.jsx` | `GET /api/signals/unified/{ticker}` |
| Universe autocomplete | `TickerInput.jsx` | `GET /api/universe` |
| Add ticker/backfill | `TickerInput.jsx` | `POST /api/universe`, `GET /api/ingest/status/{jobId}` |
| Parameter sweep | `ParameterSweep.jsx` | `POST /api/backtest/sweep` |
| Walk-forward analysis | `WalkForward.jsx` | `POST /api/backtest/wfa` |
| Live quotes | `CrossAssetMonitor.jsx` | `GET /api/live/quotes` |
| VIX | `CrossAssetMonitor.jsx` | `GET /api/live/vix` |
| Live signals | `CrossAssetMonitor.jsx` | `GET /api/live/signals` |
| Live prices | `CrossAssetMonitor.jsx` | `GET /api/live/prices/{symbol}` |
| Correlation matrix | `CrossAssetMonitor.jsx`, `CorrelationLab.jsx` | `GET /api/correlation/matrix` |
| Rolling correlation | `CrossAssetMonitor.jsx`, `CorrelationLab.jsx` | `GET /api/correlation/rolling` |
| Lead-lag | `CrossAssetMonitor.jsx`, `CorrelationLab.jsx` | `GET /api/correlation/leadlag` |
| Divergence | `CrossAssetMonitor.jsx`, `CorrelationLab.jsx` | `GET /api/correlation/divergence` |
| Data quality audit | `DataQualityDashboard.jsx` | `GET /api/quality/audit?recent=false` |
| Pipeline health | `DataQualityDashboard.jsx` | `GET /api/health/pipeline` |
| Universe for data quality | `DataQualityDashboard.jsx` | `GET /api/universe` |
| Pipeline observability | `PipelineDashboard.jsx` | Grafana dashboard URL |

Backend routers present in `python-engine` align with the frontend integration points: health, backtest, signals, auth, ingestion, correlation, universe, live, quality, and reconcile.

## 6. Store Usage

`useBacktestStore` is used by:

- `ControlBar`
  - Reads and writes global run inputs.
  - Calls `runBacktest`.
  - Toggles cost mode.

- `StrategyConfig`
  - Reads and writes strategy/risk inputs.
  - Disables controls during loading.

- `Dashboard`
  - Reads loading to prevent mode switching during backtest execution.

- `TearsheetGrid`
  - Reads `result`, `loading`, `error`, `applyCosts`, and run snapshots.
  - Computes derived analytics with `utils/performance.analyze`.

- `WalkForward`
  - Reads ticker, strategy type, and capital.
  - Maintains its own WFA result state outside the main store.

Store actions:

- `set(patch)` provides broad write access to store fields.
- `toggleCosts()` flips `applyCosts`.
- `runBacktest()` builds the API payload, performs the request, normalizes error messages, and stores result snapshots.

Important detail:

- `runBacktest` converts UI percentage inputs into fractions for the backend risk params.
- `ranTicker`, `ranRange`, and `ranStrategyParams` intentionally preserve the executed configuration so charts do not change when the form is edited before rerunning.

## 7. Reusable Components

Currently reusable or close to reusable:

- `ErrorBoundary`: generic class-based render guard with configurable fallback title/message.
- `TickerInput`: reusable controlled ticker selector with universe autocomplete and add/backfill flow.
- `KpiRibbon`: reusable KPI strip for result metrics.
- `MetricsCard`: generic metric card, currently not mounted.
- `RiskMetricsGrid`: reusable risk analytics panel for computed metrics.
- `TradeLog`: reusable trade list with CSV download behavior.
- `EquityChart`, `DrawdownChart`, `MonthlyHeatmap`, `ReturnDistribution`: reusable chart panels when given normalized data.
- `PipelineDashboard`: isolated Grafana iframe wrapper.

Partially reusable but domain-coupled:

- `ChartWidget`: reusable as a market chart, but coupled to `/api/signals/unified/{ticker}` and strategy overlay query params.
- `ParameterSweep`: generic layout concept, but hardcoded to current strategy param schemas and localhost endpoint.
- `WalkForward`: reusable workflow concept, but hardcoded candidate sets and endpoint.

## 8. Business Components

Business/domain components:

- `Landing`: product entry experience.
- `Dashboard`: shell, mode selection, theme controls, market clock, and admin menu.
- `ControlBar`: main backtest execution inputs.
- `StrategyConfig`: strategy and risk model configuration.
- `TearsheetGrid`: backtest result composition and deep analytics orchestration.
- `ExecutionSummary`: execution, cost, and trade outcome summary.
- `TradeLog`, `TradeStats`, `TradeTable`: trade reporting components.
- `TickerInput`: business workflow for universe membership and on-demand backfill.
- `CrossAssetMonitor`: cross-asset dashboard for quotes, VIX, signals, correlation, lead-lag, and divergence.
- `DataQualityDashboard`: data quality and medallion pipeline status.
- `CorrelationLab`: alternate correlation analysis workspace.
- `ParameterSweep`: strategy robustness scan.
- `WalkForward`: out-of-sample robustness workflow.

## 9. Chart Components

Charting uses two libraries:

- `lightweight-charts`
  - `ChartWidget`
  - Intended for price/candlestick style charting with markers and overlays.

- `recharts`
  - `EquityChart`
  - `DrawdownChart`
  - `ReturnDistribution`
  - `WalkForward`
  - Cross-asset charts inside `CrossAssetMonitor`
  - Correlation charts inside `CorrelationLab`

Chart data sources:

- Backtest response: equity curve, trades, metrics, cost breakdown.
- Client analytics in `utils/performance.js`: drawdown, monthly returns, return histogram, rolling Sharpe, trade analytics.
- Signals endpoint: price bars, overlays, coverage metadata, trade markers.
- Live/correlation endpoints: quotes, prices, matrix, rolling correlation, lead-lag, divergence.

## 10. Utilities

`src/utils/performance.js` provides client-side analytics derived from the backend backtest response:

- Daily returns.
- Standard deviation.
- Drawdown series.
- Max drawdown duration.
- Monthly returns.
- Rolling Sharpe.
- Return histogram and daily VaR estimate.
- Trade analytics: win/loss counts, win rate, profit factor, expectancy, payoff ratio, streaks, average holding period.
- `analyze(result, applyCosts)` as the exported public utility.

`src/store/useBacktestStore.js` also contains helper logic:

- `fetchWithTimeout`.
- `getErrorMessage`.
- `buildParams`, which maps flat UI state to backend strategy params.

## 11. Current Strengths

- The core backtest flow is easy to follow: configure, run, render result.
- Zustand is used simply and avoids excessive provider nesting.
- Snapshot fields prevent stale chart mismatches after form edits.
- Expensive derived analytics are memoized in `TearsheetGrid`.
- `ErrorBoundary` wraps higher-risk visualization blocks.
- The UI has clear separation between manual backtesting, cross-asset monitoring, pipeline status, and data quality.
- Backend endpoints map cleanly to FastAPI routers.
- Strategy configuration is schema-like and easy to extend within the existing component.
- Deep analytics are collapsed by default, reducing initial render complexity.
- The frontend exposes useful robustness tooling: parameter sweep and walk-forward analysis.

## 12. Current Weaknesses

- API base URLs are hardcoded in many files instead of coming from Vite environment config.
- API calls are split across a store, direct component fetches, and an unused axios wrapper.
- Error handling is inconsistent between workflows.
- Request timeout handling exists for the main backtest only.
- Several components are large and contain nested panel components, fetch logic, formatting, rendering, and domain rules in one file.
- There is no URL routing, so current mode cannot be bookmarked or restored on refresh.
- There are currently no frontend tests visible in the project.
- Some files contain mojibake-looking text in comments or labels when read in the current shell encoding, especially rupee symbols, arrows, and dashes.
- `src/api.js` appears stale or unused.
- `CorrelationLab`, `TradeStats`, `TradeTable`, and `MetricsCard` may be dead code or reserved for future use; their current status is not explicit.

## 13. Technical Debt

- Centralize API configuration and request helpers.
- Replace hardcoded localhost URLs with `import.meta.env` values.
- Decide whether `src/api.js` should become the API layer or be removed later.
- Extract API-specific logic from large components into domain service modules.
- Split `CrossAssetMonitor`, `CorrelationLab`, `ChartWidget`, and `DataQualityDashboard` into smaller files if they continue growing.
- Normalize backend response contracts at the API boundary.
- Add frontend tests for the store, analytics utility, and key rendering states.
- Add loading/error/empty-state conventions shared across async panels.
- Document expected backend response shapes for backtest, signals, universe, live, correlation, and quality endpoints.
- Clarify which unmounted components are intentionally retained.
- Add route/state persistence if users need deep links to admin or cross-asset views.

## 14. Components That Should Remain Unchanged

These should remain stable unless a specific feature requires changes:

- `Landing`: isolated entry screen; no direct backend dependency.
- `ErrorBoundary`: small, generic, and useful as-is.
- `KpiRibbon`: focused result summary component.
- `EquityChart`: accepts data through props and has a clear responsibility.
- `DrawdownChart`: accepts precomputed drawdown data and has a clear responsibility.
- `MonthlyHeatmap`: pure visualization of monthly returns.
- `ReturnDistribution`: pure visualization of histogram data.
- `PipelineDashboard`: intentionally thin wrapper around Grafana.
- `utils/performance.js`: should remain behaviorally stable because many result panels depend on it.

## 15. Components That Should Be Refactored

Refactor candidates, when a refactor sprint is approved:

- `CrossAssetMonitor`
  - Large file with multiple panels, repeated fetch patterns, formatting helpers, and chart logic.

- `CorrelationLab`
  - Similar domain to `CrossAssetMonitor`; may overlap conceptually and should be reconciled.

- `ChartWidget`
  - Complex chart lifecycle, API URL construction, overlays, markers, coverage warnings, and theme handling in one file.

- `DataQualityDashboard`
  - Multiple backend calls and several dashboard sections in one component.

- `TearsheetGrid`
  - Main composition is clear, but deep analytics orchestration could be split if more result panels are added.

- `ParameterSweep`
  - Domain schemas, form state, API request, heatmap rendering, and result formatting are tightly coupled.

- `WalkForward`
  - Candidate generation, API request, summary rendering, and chart/table rendering live together.

- `useBacktestStore`
  - Should eventually delegate API calls and payload construction to dedicated modules while preserving the public store shape.

## 16. Components That Should Become Reusable

Good candidates for extraction into reusable components:

- Async panel shell with title, subtitle, badge, actions, loading, error, and empty states.
- Metric tile/card pattern from `RiskMetricsGrid`, `MetricsCard`, and cross-asset panels.
- Data table shell used by trade logs, WFA folds, and correlation/lead-lag tables.
- Heatmap grid used by correlation matrices and parameter sweep.
- API status badge / quality badge pattern from data quality components.
- Date range controls used by backtest and WFA workflows.
- Numeric range control used by parameter sweep.
- Chart panel wrapper shared by Recharts-based charts.
- Ticker universe selector, with `TickerInput` as the foundation.

## 17. Backend Integration Points

Primary backend dependency:

- FastAPI service at `http://localhost:8000`.

Frontend integrations currently rely on:

- Backtest router:
  - `POST /api/backtest`
  - `POST /api/backtest/sweep`
  - `POST /api/backtest/wfa`

- Signals router:
  - `GET /api/signals/unified/{ticker}`

- Universe router:
  - `GET /api/universe`
  - `POST /api/universe`

- Ingestion router:
  - `GET /api/ingest/status/{flow_id}`

- Live router:
  - `GET /api/live/quotes`
  - `GET /api/live/prices/{symbol}`
  - `GET /api/live/vix`
  - `GET /api/live/signals`

- Correlation router:
  - `GET /api/correlation/matrix`
  - `GET /api/correlation/rolling`
  - `GET /api/correlation/leadlag`
  - `GET /api/correlation/divergence`

- Quality and health routers:
  - `GET /api/quality/audit`
  - `GET /api/health/pipeline`

- Grafana:
  - `http://localhost:3000/d/pipeline-health/pipeline-health`

## 18. Future AI Integration Points

Potential AI integration points, without changing current behavior:

- Strategy explanation panel:
  - Explain selected strategy, parameters, and risk model in plain language.

- Backtest result narrative:
  - Summarize return, drawdown, trade quality, costs, and robustness after a run.

- Risk diagnostics:
  - Identify concentration risk, stop-loss sensitivity, drawdown regime changes, and overfit warnings.

- Parameter sweep interpretation:
  - Explain robust parameter regions rather than only the best cell.

- Walk-forward interpretation:
  - Summarize whether in-sample optimization generalized out of sample.

- Data quality triage:
  - Translate audit issues into prioritized ingestion/backfill actions.

- Cross-asset signal assistant:
  - Explain correlation spikes, lead-lag behavior, divergence events, and market context.

- Ticker onboarding assistant:
  - Suggest symbols, validate asset classes, and explain backfill status.

- Natural-language query layer:
  - Ask questions like "show NIFTY peers with rising correlation" or "compare gross vs net performance".

Any AI integration should treat backend data contracts as the source of truth and should not bypass existing API routes.

## 19. Suggested Sprint 1 Roadmap

Sprint 1 should focus on documentation, safety, and low-risk consolidation. No visual redesign is required.

1. Establish frontend API configuration
   - Add a single documented base URL convention using Vite environment variables.
   - Preserve existing endpoint behavior.

2. Create a frontend API map
   - Document request/response contracts for endpoints used by the UI.
   - Mark owning component and backend router for each endpoint.

3. Standardize async request patterns
   - Define a small shared pattern for loading, error, timeout, and JSON parsing.
   - Apply only after tests or careful manual QA are available.

4. Clarify component ownership
   - Mark mounted, unmounted, deprecated, and experimental components.
   - Decide the status of `CorrelationLab`, `TradeStats`, `TradeTable`, `MetricsCard`, and `src/api.js`.

5. Add test coverage around stable logic
   - Unit-test `utils/performance.analyze`.
   - Unit-test `buildParams` behavior after extracting or exporting it.
   - Add smoke tests for `ControlBar`, `StrategyConfig`, and `TearsheetGrid` states.

6. Prepare refactor plan for large components
   - Start with `CrossAssetMonitor` and `ChartWidget`.
   - Extract helpers before changing behavior.

7. Document AI-ready boundaries
   - Define which backend responses are safe to feed into future AI summaries.
   - Identify sensitive/authenticated data boundaries before adding AI features.

