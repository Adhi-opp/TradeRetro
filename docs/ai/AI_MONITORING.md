# AI Monitoring

## What to Monitor

The AI Copilot is a small system — one HTTP endpoint, one orchestration service, and a set of provider backends. Monitoring focuses on three things: **reachability**, **latency**, and **failure mode**.

## 1. Health Endpoint

```bash
curl http://localhost:8000/api/ai/health
```

Returns the router's liveness status. Use it in smoke scripts and CI gates before the UI-driven checks below.

## 2. Provider Reachability (client-side)

`useAIStore.checkProviderAvailability()` probes local model servers and stores a status:

| Status | Meaning | UI Effect |
|---|---|---|
| `ready` | At least one probed endpoint answered | Models on that backend selectable; chip shows the model |
| `unavailable` | Probes failed / timed out | Models greyed out; Mock Provider still selectable |
| `unknown` | No probe has completed yet | Default until the first probe settles |

- Probes: `http://localhost:1234/v1/models` (LM Studio / OpenAI-compatible), `http://localhost:11434/api/tags` (Ollama) — `no-cors`, with an `AbortController` timeout so a hung server can't wedge the UI.
- The server independently scans upstream availability before resolving a model, so the client status and the served model always agree.

## 3. Request-Level Signals (what to watch in logs)

| Signal | Healthy | Watch | Action |
|---|---|---|---|
| Response latency | < 5 s (local), 2–15 s (cloud) | Steady growth | Model too large for the host; move to smaller model |
| HTTP result | 200 (success: true) | 200 (success: false) / 400 | Provider unreachable / validation failure → check provider & params; check `GEMINI_API_KEY` |
| Timeout | never | browser 30 s abort | See [AI_TROUBLESHOOTING.md](AI_TROUBLESHOOTING.md) |
| Fallbacks | rarely | Mock Provider picked while a local server is running | Server scan disagreed with client probe — check server reachability |

## 4. Smoke Checklist (run before each release candidate)

1. `GET /api/ai/health` → ok.
2. `POST /api/ai/generate` with `model: "mock"` → 200 (`success: true`) + deterministic text (< 1 s).
3. UI: AI panel opens; model chip renders; Mock Provider selected.
4. With context: run a backtest, ask a state-aware question, confirm context bar shows strategy + metrics.
5. Negative test: point the client probe at a dead port → chip shows unavailable, Mock still answers.
6. Unit suite: `python -m pytest tests/test_ai_*.py -q` (run from `python-engine/`) — all green offline.

## Note on Captive/Standalone Mode

In standalone runs (`run_api_with_dummy_redis.py`, no Postgres/Redis) the AI endpoints work fully; unrelated data surfaces (e.g. `/api/signals/unified/*`) return 500 by design there. That is an environment limitation, not an AI failure — see the screenshots README caveats.