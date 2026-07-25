# Task 4C — Full Application Startup Guide

**Branch:** `feature/ai-copilot`  
**Date:** 2026-07-24

---

## 1. Complete Startup Checklist

### Prerequisites

| Requirement | Status | Notes |
|---|---|---|
| Docker Desktop installed | ✅ Verified | v28.5.1 |
| Docker Desktop running | ✅ Started | Was stopped; launched via `"C:\Program Files\Docker\Docker\Docker Desktop.exe"` |
| Windows Docker service (`com.docker.service`) | ❌ Not startable via CLI | Must be started from Docker Desktop UI |
| Port 5432 free | ✅ Available | Used by TimescaleDB |
| Port 6379 free | ✅ Available | Used by Redis |
| Port 8000 free | ✅ Available | Used by FastAPI backend |
| Port 4200 free | ✅ Available | Used by Prefect server |

### Required Services (in order)

| # | Service | Image | Purpose | Mandatory for AI? |
|---|---|---|---|---|
| 1 | TimescaleDB | `timescale/timescaledb:latest-pg16` | Database + time-series extension | ✅ Yes — `lifespan` calls `init_pool()` |
| 2 | Redis | `redis:7-alpine` | Message broker + tick cache | ✅ Yes — `lifespan` calls `init_redis()` |
| 3 | Prefect Server | `prefecthq/prefect:3-latest` | Workflow orchestration UI/API | ✅ Yes — `api` service depends on `prefect-server` being healthy |
| 4 | FastAPI Backend (api) | Built from `python-engine/Dockerfile` | Unified backend serving all routes | ✅ Yes — hosts AI endpoints |
| 5 | Pipeline Worker | Built from `python-engine/Dockerfile` | Redis Stream consumer (ticks) | ❌ No — optional data pipeline |
| 6 | Grafana | `grafana/grafana:latest` | Observability dashboards | ❌ No — monitoring only |
| 7 | React Frontend (client) | Built from `client/Dockerfile` | Vite dev server | ❌ No — AI works via curl/Swagger |

---

## 2. Dependency Graph

```
Browser / curl / Swagger UI
         │
         ▼
┌──────────────────┐
│  Frontend (:5173) │  (optional — not needed for AI testing)
└──────┬───────────┘
       │  /api/*
       ▼
┌──────────────────────────────────────────────────────┐
│  FastAPI Backend (:8000)  main.py                     │
│  ├── /api/ai/health   (GET)                           │
│  ├── /api/ai/generate (POST) ← AI Copilot endpoint    │
│  └── 28 other routes (backtest, signals, auth, ...)   │
└──────────┬───────────────┬───────────────────────────┘
           │               │
           ▼               ▼
┌──────────────────┐  ┌──────────────────┐
│  TimescaleDB     │  │  Redis (:6379)   │
│  (:5432)         │  │                  │
│  traderetro_raw  │  │  market:ticks    │
└──────────────────┘  │  market:latest   │
                      └──────────────────┘
                               │
                               ▼
                     ┌──────────────────┐
                     │  Prefect Server  │
                     │  (:4200)         │
                     │  (SQLite DB)     │
                     └──────────────────┘
```

---

## 3. Configuration

### Environment files

| File | Present | Used by |
|---|---|---|
| `.env` | ✅ Yes | Docker Compose (`env_file: .env`), `python-engine/config.py` (via `pydantic-settings`) |
| `.env.example` | ✅ Yes | Template only — not consumed by any code |

### Mandatory variables

All variables have defaults in `docker-compose.yml` or `config.py` — the app runs without overrides. None are strictly mandatory for the AI endpoint:

| Variable | Default | Required for AI? |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/traderetro_raw` | ✅ Yes (startup) |
| `POSTGRES_USER` | `postgres` | ✅ Yes (startup) |
| `POSTGRES_PASSWORD` | `postgres` | ✅ Yes (startup) |
| `POSTGRES_DB` | `traderetro_raw` | ✅ Yes (startup) |
| `REDIS_URL` | `redis://localhost:6379` | ✅ Yes (startup) |
| `HOST` | `0.0.0.0` | ❌ No |
| `PORT` | `8000` | ❌ No |
| `UPSTOX_CLIENT_ID` | `""` | ❌ No (only auth flow) |
| `UPSTOX_CLIENT_SECRET` | `""` | ❌ No (only auth flow) |
| `PIPELINE_MODE` | `simulate` | ❌ No |
| `PREFECT_API_URL` | `http://localhost:4200/api` | ❌ No (orchestration only) |
| `GRAFANA_ADMIN_USER` | `admin` | ❌ No |
| `GRAFANA_ADMIN_PASSWORD` | `traderetro` | ❌ No |

---

## 4. Startup Commands

### Step-by-step (Windows PowerShell)

```powershell
# ─── 1. Start Docker Desktop ─────────────────────────────────
# (if not already running)
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
# Wait ~30s for Docker to be ready

# ─── 2. Verify Docker is ready ────────────────────────────────
docker info

# ─── 3. Start infrastructure services ─────────────────────────
docker compose up -d timescaledb redis prefect-server

# Wait ~20s for health checks to pass, then:
docker compose ps
# All three should show "(healthy)"

# ─── 4. Build and start the API ───────────────────────────────
docker compose build api
docker compose up -d api

# ─── 5. (Optional) Start remaining services ───────────────────
docker compose up -d pipeline-worker grafana client

# ─── 6. Verify the API is running ─────────────────────────────
docker compose logs api --tail 10
# Should show: "Application startup complete."
#               "Uvicorn running on http://0.0.0.0:8000"

# ─── 7. Test AI endpoints ─────────────────────────────────────
# Health check
Invoke-RestMethod -Uri "http://localhost:8000/api/ai/health" -Method Get

# Generate
$body = @{ user_query = "Analyze my strategy" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8000/api/ai/generate" -Method Post -Body $body -ContentType "application/json" | ConvertTo-Json -Depth 5
```

### Alternative: Quick full stack
```powershell
docker compose up -d --build
```
(This starts all 7 services. First build takes 3-5 minutes.)

---

## 5. Issues Encountered and Resolved

| # | Issue | Root Cause | Resolution |
|---|---|---|---|
| 1 | `ConnectionRefusedError: asyncpg.create_pool(...)` | Docker Desktop was not running. No PostgreSQL instance was available. | Started Docker Desktop, ran `docker compose up -d timescaledb redis` |
| 2 | `GET /api/ai/health` → `404 Not Found` | Docker image was stale (built Jul 11, before AI module was created Jul 23). The running container had old code without the AI router. | Rebuilt with `docker compose build api`, removed old container, recreated with `docker compose up -d api` |
| 3 | `docker compose build api` timed out at 180s | pip dependency resolution for `prefect` takes ~80s during install. | Build completed successfully despite the timeout warning; container started with new image. |

---

## 6. Verification Results

### Swagger route registration

All 30+ routes registered. AI endpoints confirmed:

```
/api/ai/health
/api/ai/generate
```

### AI endpoint tests (live in Docker)

**GET /api/ai/health → 200**
```json
{"module": "ai", "status": "initialized"}
```

**POST /api/ai/generate → 200**
```json
{
  "success": true,
  "provider": "mock",
  "user_query": "What is my portfolio risk?",
  "prompt": "### SYSTEM INSTRUCTION\nYou are TradeRetro AI...",
  "context": {
    "market": {"available": false, "source": null, "data": null},
    "strategy": {"available": false, "source": null, "data": null},
    "backtest": {"available": false, "source": null, "data": null},
    "metrics": {"available": false, "source": null, "data": null},
    "portfolio": {"available": false, "source": null, "data": null}
  },
  "response": {
    "provider": "mock",
    "success": true,
    "response": "Mock response generated successfully.",
    "tokens_used": 0
  },
  "error": null
}
```

**All 5 pipeline components confirmed executing:**
- ✅ ContextBuilder (5 domain contexts in response)
- ✅ PromptBuilder (system instruction in response)
- ✅ LLMProviderFactory → MockLLMProvider (mock response body)
- ✅ AIService.generate_response() (full orchestration)
- ✅ Router → GenerateResponse (typed Pydantic output, HTTP 200)

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Docker Desktop must be started manually on Windows | `com.docker.service` cannot start via `Start-Service`; user must launch Docker Desktop UI first |
| First `docker compose build api` takes 3-5 minutes | Subsequent builds are cached and take <30s |
| `prefect` pip install has slow dependency resolution | This is a one-time cost during image build |
| Port conflicts if PostgreSQL/Redis are running natively on host | Docker Compose binds to host ports 5432 and 6379 — native services must be stopped first |

---

## 8. AI Endpoints Accessibility

**Yes, both AI endpoints are now reachable and functional inside the real application.**

- `http://localhost:8000/api/ai/health` → returns `{"module":"ai","status":"initialized"}`
- `http://localhost:8000/api/ai/generate` → returns full `GenerateResponse` via the ContextBuilder → PromptBuilder → MockLLMProvider pipeline
- Swagger UI: `http://localhost:8000/docs` lists both endpoints under the "AI" tag
- No frontend is required — endpoints are fully testable via curl, PowerShell `Invoke-RestMethod`, or Swagger
