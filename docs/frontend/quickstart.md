# TradeRetro Frontend — Quickstart

This guide gets a local TradeRetro frontend running against the Python engine,
and walks through the first backtest in under ten minutes.

## Prerequisites

- **Node.js ≥ 20** (developed against v22) and npm
- **Python ≥ 3.11** with the `python-engine/` dependencies installed
  (`pip install -r python-engine/requirements.txt`, plus `pymupdf` is only
  needed for PDF generation)
- Ports **5173** (frontend) and **8000** (backend) free

## 1. Start the backend

```bash
cd python-engine
python run_api_with_dummy_redis.py      # standalone mode (no Docker required)
```

For the full-stack experience (Postgres, Redis, TimescaleDB, Grafana, EOD
scheduler), use the Docker Compose stack and `python main.py` instead — see
`../design-decisions.md` and the compose file in the repo root for details.

Expected output:

```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

Practical verification:

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/ai/models
```

## 2. Start the frontend

```bash
cd client
npm install       # first run only
npm run dev
```

`vite` serves the app at `http://localhost:5173`. If the machine resolves
`localhost` to IPv6 first (common on Windows), start Vite with `--host` so it
binds IPv4 as well:

```bash
npm run dev -- --host
```

## 3. Smoketest

Open http://localhost:5173 and verify:

1. **Landing page** ("Look Back. Test Better.") renders with the dark theme by
   default; click **Launch Terminal**.
2. The **Overview** tab shows the control bar (Strategy / Backtest Period /
   Risk & Costs / Asset & Capital) plus idle live-market cards from the
   backend.
3. Run a backtest: change nothing (defaults are `RELIANCE.NS`, Moving Average
   Crossover 20/50, 2024-09-01 → today), click **Execute Backtest**. In a few
   seconds the tearsheet renders: KPI ribbon, Strategy Assessment, Equity
   Curve, Drawdown + Trade Log, and a collapsible **Deep Analytics** section.
4. Open the **Data Quality**, **Data Pipeline**, and **Cross-Asset** tabs —
   each should render its real dashboard (pipeline telemetry depends on the
   backend mode; Grafana panel needs the Compose stack).
5. Toggle the theme via the sun/moon button — the amber accent system and all
   surfaces switch between dark and light.

## 4. If the backend is not running

The UI still boots, but every data call fails and panels render their error or
empty states. The app-bar shows a stale sync indicator; the AI Copilot header
shows **Not Available**. Start the backend (step 1) and refresh.

## 5. Common first-run issues

| Symptom | Fix |
|---|---|
| `ERR_CONNECTION_REFUSED` on localhost:8000 | Backend not running; start it (step 1) |
| Vite binds `::1` only (`http://[::1]:5173`) | `npm run dev -- --host` |
| AI Copilot says **Not Available** | No LM Studio/Ollama server and no API key. Start one, or add a cloud API key in Copilot Settings (memory-only), or select the **Mock Provider** |
| `/api/signals/unified/...` returns 500 | Expected in standalone mode (needs Postgres); full stack via Docker |
| Backtest errors with 400 | The ControlBar validation rejects e.g. `startDate` before 2024-04-18 or non-numeric capital — check the fields are the backend-specified ranges (see `models/requests.py`) |

## 6. Next steps

- **Frontend architecture** → `architecture.md`
- **State management** → `state-management.md`
- **Data flows & API** → `data-flows.md`
- **Design system** → `design-system.md`
- **Quality gates** → `testing.md`
- **Problems & fixes** → `troubleshooting.md`