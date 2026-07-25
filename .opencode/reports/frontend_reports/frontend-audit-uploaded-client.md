# TradeRetro Uploaded Client Audit

Audit date: 2026-07-12

Source reviewed: `C:\Users\skyha\OneDrive\Desktop\TradeRetro_old\client.zip`

Scope: React frontend contained in the uploaded ZIP. The archive includes source files, `dist/`, and `node_modules/`; this audit focuses on source/config files only.

## 1. Current Folder Structure

```text
client/
  dist/
  node_modules/
  src/
    assets/
      react.svg
    components/
      AiVerifyForm.jsx
      Dashboard.jsx
      EquityChart.jsx
      ErrorBoundary.jsx
      Landing.jsx
      LeftPane.jsx
      MetricsCard.jsx
      RightPane.jsx
      StrategyForm.jsx
      TradeTable.jsx
      VerdictCard.jsx
    api.js
    App.css
    App.jsx
    index.css
    main.jsx
    traderetro.jsx
  eslint.config.js
  index.html
  package-lock.json
  package.json
  README.md
  vite.config.js
```

Key package dependencies:

- React 19.
- Vite 7.
- Recharts.
- Lucide React.
- Axios.
- Tailwind-related packages.

The archive contains `node_modules` and `dist`, which should normally be excluded from source handoff ZIPs.

## 2. Component Hierarchy

Actual mounted app from `src/main.jsx`:

```text
main.jsx
  TradeRetro from traderetro.jsx
    Tooltip_Component
    StatCard
    Recharts AreaChart
    inline sidebar/navigation
    inline strategy form
    inline result KPI cards
    inline equity chart
    inline trade history table
```

Present but not mounted by `main.jsx`:

```text
App.jsx
  Landing
  Dashboard
    LeftPane
      StrategyForm
      AiVerifyForm
    RightPane
      MetricsCard
      EquityChart
      TradeTable
      VerdictCard
      ErrorBoundary
      CostBreakdown
      SimulationMeta
      MonteCarloResults
```

The most important structural finding is that the modular app path exists, but the entry point bypasses it and mounts `traderetro.jsx` directly.

## 3. Routing Flow

There is no React Router.

Actual mounted flow:

- `main.jsx` renders `TradeRetro`.
- `TradeRetro` owns `activeNav`, with values like `dashboard`, `builder`, `data`, and `settings`.
- The sidebar changes `activeNav`, but the inspected JSX primarily renders the strategy builder and results workflow regardless of a full route system.

Disconnected modular flow:

- `App.jsx` owns `hasEntered` and `theme`.
- `Landing` transitions into `Dashboard`.
- `Dashboard` owns `mode`, switching between `manual` and `ai`.
- This flow is not active unless `main.jsx` is changed to render `App`.

## 4. State Management Architecture

No external state management library is used.

Actual mounted `traderetro.jsx` state:

- Navigation: `activeNav`.
- Strategy form: strategy type, selected asset, moving average params, RSI params, capital, fees, dates.
- Asset loading: `availableAssets`, `selectedAsset`.
- Backtest lifecycle: `isBacktesting`, `showResults`, `error`.
- Result state: `metrics`, `equityData`, `tradeHistory`.

Disconnected modular dashboard state:

- `Dashboard` owns all manual and AI workflow state:
  - `mode`
  - `result`
  - `verdictResult`
  - `monteCarloResult`
  - `loading`
  - `error`
  - `applyCosts`
- `StrategyForm` owns its own form state.
- `AiVerifyForm` owns AI strategy verification form state.
- `RightPane` is mostly presentational and renders based on props.

There is no Zustand/Redux store, no Context state layer, and no shared API state abstraction.

## 5. API Communication Flow

Actual mounted API calls in `traderetro.jsx`:

| Purpose | Endpoint |
| --- | --- |
| Load available assets | `GET /api/assets` |
| Run backtest | `POST /api/backtest` |

Disconnected modular dashboard API calls:

| Purpose | Endpoint |
| --- | --- |
| Run backtest | `POST http://localhost:5000/api/backtest` |
| Run Monte Carlo | `POST http://localhost:5000/api/monte-carlo` |
| Verify AI strategy | `POST http://localhost:5000/api/verify-ai-strategy` |

Other API file:

- `src/api.js` exports `executeBacktest(payload)` using axios against `http://localhost:5000/api/backtest`.
- It appears unused by both `traderetro.jsx` and `Dashboard.jsx`.

Important mismatch:

- Mounted `traderetro.jsx` uses relative `/api/...`.
- Modular `Dashboard.jsx` and `api.js` use hardcoded `http://localhost:5000/api/...`.
- The current TradeRetro backend in the main workspace runs on `localhost:8000`, so this uploaded client targets an older backend contract.

## 6. Store Usage

There is no store directory and no global store usage.

State is held in component-local `useState` hooks. This keeps the old client easy to read at small scale, but creates duplication:

- `traderetro.jsx` has its own backtest payload builder.
- `Dashboard.jsx` has a separate `buildParams`.
- `StrategyForm.jsx` has another form-state-to-payload mapping.
- `api.js` has a separate axios wrapper that is not used.

## 7. Reusable Components

Reusable components in the modular path:

- `ErrorBoundary`: generic render guard.
- `MetricsCard`: metric display card.
- `EquityChart`: chart component fed by equity curve data.
- `TradeTable`: ledger/table component with CSV export.
- `VerdictCard`: AI verification result display.
- `StrategyForm`: reusable manual strategy form.
- `AiVerifyForm`: reusable AI verification form.

Less reusable / inline pieces:

- `Tooltip_Component` and `StatCard` are defined inside `traderetro.jsx`.
- `CostBreakdown`, `SimulationMeta`, and `MonteCarloResults` are defined inside `RightPane.jsx`.
- `traderetro.jsx` contains many reusable UI ideas, but they are not extracted into components.

## 8. Business Components

Business components:

- `TradeRetro`: mounted all-in-one trading/backtest interface.
- `Dashboard`: unmounted modular shell for manual and AI modes.
- `LeftPane`: control panel shell.
- `RightPane`: output monitor shell.
- `StrategyForm`: stock/strategy/date/capital configuration.
- `AiVerifyForm`: Python condition input and claim verification form.
- `VerdictCard`: AI claim truth/verification output.
- `TradeTable`: trade ledger with export.

## 9. Chart Components

Charting library:

- Recharts only.

Chart usage:

- `traderetro.jsx`
  - Uses `AreaChart` directly for strategy vs buy-and-hold equity.
  - Generates chart-ready equity data after backtest response.

- `EquityChart.jsx`
  - Modular chart component used by the unmounted `RightPane`.

- `RightPane.jsx`
  - Monte Carlo result histogram is hand-rendered using div bars, not a chart library component.

No `lightweight-charts` dependency exists in this uploaded client.

## 10. Utilities

There is no `utils/` folder.

Utility logic is embedded in components:

- `fetchWithTimeout` in `Dashboard.jsx`.
- `buildParams` in `Dashboard.jsx`.
- CSV export logic in `TradeTable.jsx`.
- Monte Carlo histogram bucket creation in `RightPane.jsx`.
- Mock equity generation in `traderetro.jsx`.
- Date/currency/axis formatting in chart/table components.

## 11. Current Strengths

- Small source footprint and easy initial onboarding.
- Modular component path exists and is a good foundation.
- `Dashboard.jsx` already supports manual backtest, Monte Carlo, and AI verification workflows.
- `ErrorBoundary` is present around result rendering in the modular path.
- Manual workflow has request timeouts in `Dashboard.jsx`.
- `TradeTable` includes CSV export.
- `RightPane` clearly separates idle, loading, manual result, Monte Carlo result, and AI verdict states.
- The UI already anticipates Indian transaction costs and AI strategy verification.

## 12. Current Weaknesses

- `main.jsx` mounts `traderetro.jsx`, so the better modular `App.jsx`/`Dashboard.jsx` path is not active.
- `traderetro.jsx` is a large single-file app with layout, API calls, forms, charting, result mapping, styles, and mock data in one file.
- API contracts are inconsistent: relative `/api` in the mounted app versus `localhost:5000` in other files.
- The target backend appears older than the current main TradeRetro backend, which uses `localhost:8000`.
- `src/api.js` is unused and references an Express-style port comment.
- No global state architecture exists.
- No tests are visible.
- `dist/` and `node_modules/` are included in the uploaded ZIP, increasing size and audit noise.
- Some JSX text appears mojibake-encoded when read in the current environment, especially rupee symbols, arrows, and dashes.
- Theme handling exists only in the disconnected `App.jsx` path.
- Mounted `traderetro.jsx` uses inline `<style>` and many utility classes, while the modular path uses external CSS conventions.

## 13. Technical Debt

- Decide which app path is canonical: `traderetro.jsx` or `App.jsx`.
- Remove or archive the non-canonical path after migration.
- Centralize backend base URL and request helpers.
- Align backend endpoint ports and paths with the current FastAPI service.
- Extract `traderetro.jsx` into components if it remains the active UI.
- Move utility functions out of components.
- Remove generated artifacts from source handoff archives.
- Add tests for payload building, result rendering states, and table/chart formatting.
- Normalize currency handling: the mounted UI uses USD labels in places, while modular components use INR.
- Document expected backend response shapes for backtest, Monte Carlo, assets, and AI verification.

## 14. Components That Should Remain Unchanged

These are useful and should remain behaviorally stable unless the canonical app path changes:

- `ErrorBoundary`
- `MetricsCard`
- `EquityChart`
- `TradeTable`
- `VerdictCard`
- `AiVerifyForm`

These components are already reasonably scoped and can survive a larger cleanup.

## 15. Components That Should Be Refactored

Highest priority:

- `traderetro.jsx`
  - Large mounted app file.
  - Contains mock data, API calls, layout, state, styling, charts, and result transforms.

- `Dashboard.jsx`
  - Good orchestrator, but API calls and payload building should eventually move out.

- `RightPane.jsx`
  - Contains nested display components and Monte Carlo transformation logic.

- `StrategyForm.jsx`
  - Hardcoded stock universe and strategy schemas should be moved to configuration if retained.

Medium priority:

- `TradeTable.jsx`
  - CSV export should be safer around commas and null values if trade data grows richer.

- `api.js`
  - Either make it the real API client or remove it later.

## 16. Components That Should Become Reusable

Reusable extraction candidates:

- `StatCard` from `traderetro.jsx`.
- `Tooltip_Component` from `traderetro.jsx`.
- Sidebar/navigation shell from `traderetro.jsx`.
- Strategy parameter field groups from `StrategyForm.jsx` and `traderetro.jsx`.
- `CostBreakdown` from `RightPane.jsx`.
- `SimulationMeta` from `RightPane.jsx`.
- `MonteCarloResults` from `RightPane.jsx`.
- Shared loading/idle/error panel components.
- Shared endpoint request helper with timeout and error normalization.

## 17. Backend Integration Points

Uploaded client expects these backend surfaces:

- `GET /api/assets`
  - Used by mounted `traderetro.jsx`.
  - Expected response includes `assets`, each with `symbol` and `recordCount`.

- `POST /api/backtest`
  - Used by mounted `traderetro.jsx`, modular `Dashboard.jsx`, and unused `api.js`.
  - Expected response includes `metrics`, optional `grossMetrics`, `equityCurve`, `trades`, optional `costBreakdown`, and optional `simulationMeta`.

- `POST /api/monte-carlo`
  - Used by modular `Dashboard.jsx`.
  - Expected response includes `distribution`, `runs`, and `executionTimeMs`.

- `POST /api/verify-ai-strategy`
  - Used by modular `Dashboard.jsx`.
  - Expected response includes `verdict`, `actual_results`, `stock`, and optional `data_range`.

Backend compatibility risk:

- The uploaded client targets `localhost:5000` in modular files.
- Current main project backend routers are FastAPI under `localhost:8000` and do not expose all old endpoints under the same names.

## 18. Future AI Integration Points

This uploaded client already has an AI verification concept:

- `AiVerifyForm` collects Python entry/exit bodies and claimed metrics.
- `Dashboard.handleVerify` posts to `/api/verify-ai-strategy`.
- `VerdictCard` displays verdict label, truth score, claim comparisons, and actual metrics.

Future AI integration opportunities:

- Safer AI strategy sandboxing status and diagnostics.
- Natural-language explanation of verdict results.
- Claim extraction from pasted AI-generated strategy text.
- Suggested corrected entry/exit logic after a failed or exaggerated claim.
- Risk narrative for backtest and Monte Carlo outputs.
- Strategy code linting before backend submission.

Any AI workflow must be careful because the form submits Python-like code. Backend sandboxing, timeouts, and validation should remain the primary safety boundary.

## 19. Suggested Sprint 1 Roadmap

1. Choose the canonical entry path
   - Decide whether to mount `App.jsx` or keep `traderetro.jsx`.
   - Document the decision before refactoring.

2. Align backend contracts
   - Update endpoint documentation for `/api/assets`, `/api/backtest`, `/api/monte-carlo`, and `/api/verify-ai-strategy`.
   - Compare those endpoints against the current FastAPI backend.

3. Centralize API config
   - Replace hardcoded `localhost:5000` and relative `/api` split with one API base strategy.

4. Preserve useful modular components
   - Keep `StrategyForm`, `AiVerifyForm`, `RightPane`, `TradeTable`, `EquityChart`, and `VerdictCard` as migration assets.

5. Split the mounted monolith if retained
   - Extract sidebar, strategy builder, result cards, equity chart, and trade history.

6. Remove archive noise from future handoffs
   - Do not include `node_modules` or `dist` in uploaded source ZIPs unless specifically needed.

7. Add basic tests
   - Payload building.
   - Idle/loading/error/result rendering.
   - CSV export formatting.
   - AI verdict rendering.

