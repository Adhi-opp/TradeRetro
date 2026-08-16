# TradeRetro Frontend — Architecture

The frontend is a **React 19 single-page application** (Vite 7, no SSR) that
talks to a single FastAPI backend (`http://localhost:8000`) over JSON REST.
There is no routing library: view switching is state-driven inside one root
component.

```
┌────────────────────────────────────────────────────────────────┐
│  client/src                                                  │
│                                                              │
│  main.jsx ──▶ App.jsx                                        │
│                ├─ Landing (marketing entry, theme toggle)     │
│                └─ Dashboard (the product shell)               │
│                     ├─ Sidebar (tabs, AI Copilot, Feedback,   │
│                     │   About, Capstone badge, pin, footer)   │
│                     ├─ App bar (page title, sync indicator,   │
│                     │   MarketClock, theme toggle)            │
│                     └─ Main content (per active tab)          │
│                          ├─ overview: ControlBar +            │
│                          │   (IdleOverview | TearsheetGrid)   │
│                          ├─ cross-asset: CrossAssetMonitor    │
│                          ├─ pipeline:   PipelineDashboard     │
│                          └─ quality:    DataQualityDashboard  │
│                     └─ Overlays: CopilotPanel (right rail),   │
│                        FeedbackModal, AboutModal              │
└────────────────────────────────────────────────────────────────┘
```

## Tech stack

| Concern | Choice | Why (see ADRs in `../design-decisions.md`) |
|---|---|---|
| Framework | React 19 | Component model, ecosystem |
| Build / dev server | Vite 7 | Fast HMR; `@tailwindcss/vite` plugin |
| Styling | Tailwind CSS 4.1 + custom CSS (`index.css`) | Design-token theming via CSS custom properties |
| State | Zustand 5 | Minimal boilerplate, store colocated with components |
| Charts | Recharts 3.7, lightweight-charts 5.1 | Time series + candlestick depth |
| Markdown (AI output) | react-markdown 10 + remark-gfm | Renders Copilot responses |
| HTTP | axios (api client) + raw `fetch` where timeouts are custom-tuned | See `data-flows.md` |
| Icons | lucide-react | Lightweight, tree-shaken |
| Class helpers | clsx + tailwind-merge (`ui/styles.js`) | Conditional class composition |

## Module map (`client/src`)

```
src/
├─ main.jsx                  entry; React root; theme bootstrap
├─ App.jsx                   Landing ⇄ Dashboard switch; theme state
├─ index.css                 ALL styling + design tokens (both themes)
├─ constants/
│  ├─ product.js             PRODUCT: capstone version/branding strings
│  └─ colors.js              raw theme hexes + semantic token names (charts)
├─ services/
│  ├─ apiClient.js           axios instance, API_BASE_URL, ApiError, auth hook
│  ├─ aiService.js           /api/ai/models + /api/ai/generate (chat/report)
│  ├─ aiContextBuilder.js    backtest context → structured AI context payloads
│  ├─ promptTemplates.js     quick actions + strategy param labels
│  ├─ marketService.js       /api/live/* + /api/signals/unified
│  ├─ pipelineService.js     /api/health*, /api/quality/audit, /api/universe
│  ├─ backtestService.js     /api/backtest, /sweep, /wfa (contract reference)
│  └─ feedbackService.js     /api/feedback submit
├─ store/
│  ├─ useBacktestStore.js    config, run action, result, tabs
│  └─ useAIStore.js          copilot state, provider probing, sendMessage
└─ components/
   ├─ Landing.jsx            landing page
   ├─ Dashboard.jsx          shell + tab routing + modals + MarketClock
   ├─ ControlBar.jsx         global params + execute + execution status
   ├─ StrategyConfig.jsx     strategy select, per-strategy params, risk model
   ├─ TickerInput.jsx        universe search + Add ticker ingestion flow
   ├─ TearsheetGrid.jsx      results: KPI, assessment, charts, deep analytics
   ├─ KpiRibbon.jsx          KPI tiles + idle live-market strip
   ├─ StrategyAssessment.jsx automated verdict cards
   ├─ EquityChart.jsx / DrawdownChart.jsx / TradeLog.jsx / RiskMetricsGrid.jsx
   ├─ ChartWidget.jsx        lightweight-charts candlesticks + sweep/WFA overlays
   ├─ ParameterSweep.jsx     param heatmap
   ├─ WalkForward.jsx        WFA splitting + report
   ├─ MonthlyHeatmap.jsx / ReturnDistribution.jsx
   ├─ CrossAssetMonitor.jsx  correlation analytics
   ├─ PipelineDashboard.jsx  infra health + Grafana embed
   ├─ DataQualityDashboard.jsx audit dashboard
   ├─ copilot/               CopilotPanel, Header, EmptyState, QuickActions,
   │                         ExamplePrompts, ConversationList, MessageBubble,
   │                         PromptInput, SettingsModal, ModelPickerDropdown,
   │                         modelGroups, LoadingIndicator
   ├─ feedback/FeedbackModal.jsx
   ├─ about/AboutModal.jsx
   └─ ui/                    Modal, TradeRetroLogo, styles (cx)
```

## Key flows

1. **Boot** — `main.jsx` reads `localStorage["tr-theme"]` (default `dark`),
   applies `data-theme` on `<html>`; `App.jsx` renders `Landing`.
2. **Enter** → `Dashboard` mounts; `useBacktestStore` and `useAIStore` are
   fresh (stores live in component memory, not persisted).
3. **Run backtest** — `ControlBar`/`StrategyConfig` write config; the store's
   `runBacktest` POSTs, stores `result` + a snapshot (`ranTicker`,
   `ranRange`, `ranStrategyParams`) so downstream charts never change when the
   form is edited post-run.
4. **Tab switch** — `activeTab` in `useBacktestStore` swaps the main content;
   each dashboard mounts its own fetchers.
5. **AI Copilot** — `useAIStore.openPanel()` reveals the right rail; the store
   probes LM Studio (:1234) and Ollama (:11434), falls back to cloud status;
   `sendMessage` builds a context payload via `buildAiContext` and calls
   `/api/ai/generate`.

## Conventions

- One default export per feature component; shared presentational components
  live in `ui/`.
- CSS is **class-driven** (`index.css`), tokenized via CSS custom properties
  — components never hardcode colors; charts import the token names from
  `constants/colors.js`.
- No comments in components by convention unless non-obvious logic (see e.g.
  the two-shot `useBacktestStore` result snapshot).
- Defensive rendering: every panel can render loading / error / empty states;
  results panels are wrapped in `ErrorBoundary` so one failure never blanks
  the whole tearsheet.