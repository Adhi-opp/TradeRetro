# AI Quickstart

## Fastest Path: Run With the Mock Provider (no LLM, no keys)

The Mock Provider is always available and needs nothing installed. This is how the app works out of the box in simulator/standalone mode.

1. Start the app (any mode — Docker Compose or local dev).
2. Open the terminal, click the **AI Copilot** button in the sidebar.
3. If the model chip doesn't already say **Mock Provider**: open AI Settings (header button) → Models → select **Mock Provider** → Done.
4. Ask anything — e.g. *"What can you help me with?"* or, after running a backtest, *"Explain the strategy assessment"*.
5. Expected result: a deterministic markdown answer (`Mock response generated successfully.`), rendered in the chat panel.

**Verify it works:**
```bash
curl http://localhost:8000/api/ai/health
# {"status": "ok", ...}
curl -X POST http://localhost:8000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"model": "mock", "prompt": "Hello"}'
```

## Step 2: Attach the Live Backtest Context

1. Configure a strategy (e.g. MA Crossover, RELIANCE.NS) and run the backtest.
2. Open the Copilot and ask a state-aware question — the context bar in the panel shows exactly what will be attached (strategy, metrics, risk, trades).
3. The backend combines your question with the state it received; you never have to paste numbers manually.

## Step 3: Switch to a Local Model (optional)

**Option A — LM Studio (default config):**

1. Install LM Studio, download a model (e.g. `qwen2.5-coder-1.5b-instruct`), and start its local server (default: `http://localhost:1234`).
2. Nothing else to configure — `openai_compatible_base_url` defaults to `http://localhost:1234`.
3. In the app: AI Settings → select the model → Done. The header chip now shows the model name, and the availability probe marks it reachable.

**Option B — Ollama:**

1. `ollama pull llama3.2` (or llama3.1 / mistral / gemma2).
2. The registry detects it via `http://localhost:11434`; select it in AI Settings like above.

## Step 4: Cloud Provider (optional)

- Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL` / `GEMINI_BASE_URL`) in `.env`.
- Select **Gemini Flash** in AI Settings. Requires outbound internet access.

## Configuration Summary

| Setting | Default | Where |
|---|---|---|
| Default model | `qwen2.5-coder-1.5b-instruct` | `python-engine/ai/config.py` |
| OpenAI-compatible base URL | `http://localhost:1234` | `python-engine/ai/config.py` |
| Ollama endpoint | `http://localhost:11434` | client probe + server scan |
| Gemini key/model | env `GEMINI_API_KEY` / `GEMINI_MODEL` | `.env` |
| Timeout | 30 s (fetch wrapper); provider-internal timeouts | client + providers |

Full details: [AI_CONFIGURATION.md](AI_CONFIGURATION.md).

## Common Checks

- Panel empty → see [AI_TROUBLESHOOTING.md](AI_TROUBLESHOOTING.md).
- All endpoints offline-friendly: tests never require an LLM ([AI_TESTING.md](AI_TESTING.md)).