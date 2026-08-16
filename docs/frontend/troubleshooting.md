# TradeRetro Frontend — Troubleshooting

Operational playbook for the React client + FastAPI backend pair. Match the
symptom, apply the fix.

## Boot & connectivity

| Symptom | Likely cause | Fix |
|---|---|---|
| `ERR_CONNECTION_REFUSED` on `localhost:5173` | Vite not running | `cd client && npm run dev` |
| Vite serves only at `http://[::1]:5173` | Bound to IPv6 (Windows) | `npm run dev -- --host` (binds `::` + LAN) |
| `ERR_CONNECTION_REFUSED` on `localhost:8000` | Backend down | `cd python-engine && python run_api_with_dummy_redis.py` (standalone) or Compose stack |
| Frontend boots but every panel empty/error | Backend unreachable | Start backend; refresh. App degrades gracefully (never white-screens) |
| Landing renders but Launch Terminal dead-ends | Dev server mid-restart | Refresh; check Vite terminal for errors |
| White screen, console shows module errors | Stale Vite transform cache / partial dependency graph | Stop Vite, delete `node_modules/.vite`, restart |

## Backtest-specific

| Symptom | Likely cause | Fix |
|---|---|---|
| `Execution failed` + "Backend rejected the request" | 400 validation | Read the `details` in the browser console: required params (`initialCapital`, `shortPeriod`, …), ranges (`startDate ≥ 2024-04-18`, capital 100–100M) |
| "Request timed out — the server took too long to respond" | Engine > 30 s (sweep/WFA load, cold market-data cache) | Re-run when stack is idle; in standalone mode the first run warms the file cache |
| Results render but KPI/assessment inconsistent with form | Form edited **after** the run | Expected: tearsheet shows the `ran*` snapshot; re-run to refresh |
| `POST /api/backtest` 500 in console | Engine exception (log in backend terminal) | Check `python-engine` output; often missing symbol data — run Add-ticker first |

## AI Copilot

| Symptom | Likely cause | Fix |
|---|---|---|
| Header **Not Available** | No LM Studio/Ollama reachable, no API key | Start LM Studio (`localhost:1234`) or Ollama (`:11434`); or add cloud key in Settings (memory-only); or pick **Mock Provider** for offline demo |
| "Thinking…" for > 30 s | Provider connect timeout (cloud/local engine hung) | Select a reachable model in Settings; check backend log for provider error |
| Response is deterministic text | Mock Provider selected | Expected — designed for offline/test |
| Model dropdown empty | `/api/ai/models` failed | Verify `curl localhost:8000/api/ai/models`; restart backend if needed |
| Error mentions `connection refused` | Provider port mismatch | LM Studio must expose OpenAI-compatible API on 1234 |

## Data quality / pipeline tabs

| Symptom | Likely cause | Fix |
|---|---|---|
| Data Quality cards show degraded states | Backend in standalone mode w/o Postgres | Full stack via Docker Compose (`docker compose up -d`) |
| `/api/signals/unified/...` 500 in console | `NoneType: acquire` — DB pool absent in standalone mode | Run the Compose stack; or ignore (signals overlay only) |
| Pipeline Dashboard shows no telemetry | `/api/health/pipeline` degraded w/o workers | Start the scheduler/workers (`DISABLE_EOD_SCHEDULER` unset) or run stack |
| Grafana frame empty | Grafana service not running (port 3000) | `docker compose up -d grafana` |

## Theme & visuals

| Symptom | Likely cause | Fix |
|---|---|---|
| Theme change not applied | `localStorage["tr-theme"]` stale / manual-tampered | Set `localStorage.tr-theme = 'dark'`/`'light'` and reload; theme applies via `data-theme` on `<html>` |
| Charts colored wrong after theme switch | Chart component cached palette | Charts read `constants/colors.js` tokens on render — re-run or remount the tab |
| Chart colors (teal) differ from buttons (amber) | `colors.js` `rawColors` stale mirror vs `index.css` | Known divergence: `index.css` is authoritative (amber primary); see `design-system.md` |

## Build & deploy

| Symptom | Fix |
|---|---|
| `npm run build` fails on import | Fix the module path (Vite resolves case-sensitively) |
| `npm run lint` errors | Fix per eslint rule; `npm run lint -- --fix` for auto-fixable |
| API URL hardcoded in prod build | Set `VITE_API_URL` at build time (`apiClient.js` honors it; raw-fetch components hardcode `localhost:8000` — deploy the API on 8000 or patch those two call sites) |

## Still stuck?

Check the backend terminal log first (every UI failure mirrors an engine
message). Then the ADR log in `docs/design-decisions.md` for stack rationale,
and `docs/ai/AI_LIMITATIONS.md` for Copilot constraints.