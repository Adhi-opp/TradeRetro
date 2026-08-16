# TradeRetro Frontend — State Management

State is deliberately split into three tiers. There is no Redux, no
`react-router`, and no persisted server cache on the client.

## 1. Global product state — Zustand stores

### `useBacktestStore` (`src/store/useBacktestStore.js`)

The backtesting command center. All configuration feeds from one place and
the run pipeline owns the full lifecycle.

```js
{
  // Global/ControlBar params
  ticker: 'RELIANCE.NS',          startDate, endDate, capital,
  applyCosts: false,
  // StrategyConfig params
  strategyType: 'MOVING_AVERAGE_CROSSOVER',
  fastSma: 20, slowSma: 50, rsiPeriod: 14, oversold: 30,
  overbought: 70, bbPeriod: 20, bbStdDev: 2.0, dcPeriod: 20,
  // Risk model
  riskEnabled: false, riskPct: 2, stopLossPct: 8,   // %; converted to fractions in payload
  // Run lifecycle
  loading, error, result,
  ranTicker, ranRange, ranStrategyParams,           // snapshot of what produced `result`
  // Actions
  set(patch), toggleCosts(), runBacktest(), resetToDefaults(),
}
```

Key behaviors:

- `runBacktest()` maps flat UI config → per-strategy params via `buildParams()`
  (`initialCapital` is always attached; risk fields only when `riskEnabled`,
  as fractions). It uses a 30 s aborting `fetchWithTimeout` — not `apiClient`.
- On success it stores the **result snapshot** (`ran*` fields). Tearsheet
  charts, overlays, and the AI context builder all read the snapshot, so
  editing the form after a run never corrupts the displayed result.
- `activeTab` (`'overview' | 'cross-asset' | 'pipeline' | 'quality'`) lives
  here too — it drives the Dashboard main area.

### `useAIStore` (`src/store/useAIStore.js`)

Copilot state machine:

```js
{
  panelOpen, messages[], loading, error, inputValue, draftPrompt,
  models[], modelsLoaded, modelsError, selectedModel,
  userApiKey, apiConfigured,
  providerStatus: 'unknown' | 'local' | 'cloud' | 'unavailable',
  availableProvider,
  // actions
  openPanel/closePanel, setDraftPrompt, setInputValue,
  clearConversation, setSelectedModel, setUserApiKey,
  loadModels(), sendMessage(text), …
}
```

- **Provider discovery**: `checkProviderAvailability()` probes
  `http://localhost:1234/v1/models` (LM Studio) and
  `http://localhost:11434/api/tags` (Ollama) with `no-cors` fetches and a
  2.5 s timeout, then falls back to cloud (Gemini) if a user API key exists.
  Results are cached for 8 s.
- **`sendMessage`**: pushes a user message, derives `providerOverride` from
  the **selected model's provider** (`models.find(m => m.id === selectedModel)`),
  builds the AI context via `aiContextBuilder.buildAiContext(backtest)`, and
  calls `aiService.generate(text, providerOverride, contextPayload)`.
  The backend picks the final provider/model and returns
  `{success, provider, model, message|error}`; errors are mapped to friendly
  strings and the header flips to **Not Available** on outage patterns.
- **Draft prompts**: quick actions call `setDraftPrompt`, which fills the
  composer (`PromptInput`) and requests focus via `focusRequest` — actions are
  hydrated with live backtest context (see `promptTemplates.js`).

## 2. Local component state — `useState`/`useRef`

Everything view-local lives in components:

- Dashboard: `feedbackOpen`, `aboutOpen`, `toast`, mobile sidebar, Escape-key
  handling for modals.
- Copilot internals: settings modal open, API-key dialog, model dropdown
  open/close (with outside-mousedown close).
- Tearsheet: `showDeep` toggle (deep analytics render on demand),
  `auditOpen`/`peerOpen` overlays.
- TickerInput: universe dropdown open, add-ticker panel state, ingest-job
  polling (`setInterval` → `/api/ingest/status/{jobId}` with cleanup on
  unmount).

## 3. Persistence — exactly one key

`localStorage["tr-theme"]` → `'dark' | 'light'`, applied as
`data-theme` on `<html>` by `App.jsx`. **Nothing else is persisted** —
API keys live in store memory only (explicitly never written to disk or
storage), and engine config resets on refresh. This is a documented product
decision: the UI is stateless by design; the backend is the system of record.

## Rules of thumb

1. Don't lift state to a store unless ≥ 2 components need it (the two stores
   above are the only ones in the codebase).
2. A store action may own async work (run/send/load) and settle its own
   loading/error fields — components render those states directly.
3. Components must tolerate every store field being in its initial/empty
   state (idle dashboard, empty copilot, model list still loading).