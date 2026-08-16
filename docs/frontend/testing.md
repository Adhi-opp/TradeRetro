# TradeRetro Frontend — Testing

The React client currently ships **no unit-test harness** (no Vitest/Jest
scripts). Quality is enforced by the gates below, in dependency order:
**lint → build → API-contract tests (backend) → E2E capture verification**.

> Honest scope: `client/package.json` defines `dev`, `build`, `lint`,
> `preview` only. Frontend correctness is validated by static analysis +
> deterministic E2E state capture against the real dev stack.

## 1. Lint — the mandatory gate

```bash
cd client
npm run lint          # eslint .
```

ESLint runs over the whole client with React hooks + JSX rules. CI runs it on
every push (`.github/workflows/ci.yml`).

## 2. Production build — smoke

```bash
npm run build         # vite build (also type-checks none; JS only)
npm run preview       # serve the built bundle locally
```

Catches import cycles, unresolved modules, and Tailwind class emission
failures.

## 3. Backend contract tests — what the UI depends on

The frontend has no separate mock server; its contract is exercised by the
backend suite (pytest, 300+ tests):

```bash
cd python-engine
pytest -q              # runs in CI
```

Covered contracts the UI relies on: request validation
(`models/requests.py` — required params, ranges), response shapes
(`models/responses.py`), `/api/ai/*`, `/api/health*`, `/api/quality/audit`,
`/api/live/*`, `/api/universe`, `/api/ingest` status machine.

## 4. Deterministic E2E capture (release evidence)

Screenshots in `docs/assets/screenshots/` are produced by a Playwright script
that drives the **real app** (Vite + FastAPI) through every product state —
landing, configuration toggles, running/loading, results, deep analytics,
cross-asset, data quality, AI conversation (with provider selection
verified in the header chip), feedback, about, pipeline. The script:

- asserts key selectors before each capture and logs state transitions;
- records console/page errors per theme (release report tracks them);
- verifies the AI response text arrives before capturing the conversation;
- runs the same suite in **dark and light**.

```bash
node .opencode/reports/documentation-release/capture-final-screenshots.js
```

Recommended manual smoke checklist (also used for the release):

1. Landing → Launch Terminal renders dashboard.
2. Backtest with defaults → tearsheet with KPI ribbon, assessment, charts.
3. Deep Analytics expands (sweep + WFA panels populated).
4. All four sidebar tabs render their dashboards without console errors.
5. Copilot: settings → model picker → select provider → quick action →
   response rendered as Markdown.
6. Feedback + About modals open/close via Escape.
7. Theme toggle switches both palettes; charts re-color via tokens.
8. Add-ticker flow shows ingest polling then refreshes the universe.

## Known coverage gaps (tracked)

- No FE unit tests for store reducers/actions (`useBacktestStore.buildParams`,
  `useAIStore` provider fallback logic) — regression risk is low (pure
  functions, small surface) but a Vitest setup would close it.
- No browser automation in CI; the capture script runs locally on demand.
- The `backtestService.js` reference client is not exercised (store uses its
  own fetch path) — contract drift is mitigated by backend contract tests.