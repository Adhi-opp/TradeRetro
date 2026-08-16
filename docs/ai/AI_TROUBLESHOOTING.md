# AI Troubleshooting

## Symptom → Cause → Fix

### 1. "I get the mock response all the time"

- **Cause:** The Mock Provider is selected (or the default of the local model is unreachable and the server fell back).
- **Fix:** Start your local server (LM Studio `http://localhost:1234`, or Ollama `http://localhost:11434`), open AI Settings, select the model, wait for the reachability probe, then re-ask. If the chip never turns green, see #2.

### 2. Model chip shows a provider as unavailable / greyed out

- **Cause 1:** Local server not running. Check: `curl http://localhost:1234/v1/models` or `curl http://localhost:11434/api/tags`.
- **Cause 2:** Server bound to a different port/host than the probe URL. The probe and the server scan must agree — align the URL in `python-engine/ai/config.py` (`openai_compatible_base_url`) with the client probe target.
- **Fix:** Start the server first, then reopen AI Settings; run the curl checks to confirm reachability before retrying.

### 3. Generate failure / banner "provider unavailable"

- **Cause:** The requested provider refused or never answered; `AIService` returns a structured error (`success: false`) with a human-readable message.
- **Fix:** Verify the provider endpoint + key (Gemini: `GEMINI_API_KEY` in `.env`; restart the API). For local providers, see #2. The Mock Provider never fails — use it to prove the app plumbing works.

### 4. Browser times out (30 s AbortController)

- **Cause:** Slow or hung model host; oversized model on a small machine; cloud endpoint latency spike.
- **Fix:** Use a smaller model (e.g. `qwen2.5-coder-1.5b-instruct` over a 7B); keep models quantized appropriately for RAM; retry; watch server logs for the request actually landing.

### 5. Model not listed in AI Settings

- **Cause:** The registry is static (13 entries across 5 backends) — the app does not auto-discover arbitrary models.
- **Fix:** Pick a registered model, or add yours to `python-engine/ai/registry.py` `REGISTERED_MODELS` (id, display name, provider, local flag) — and add a matching provider implementation if the backend is new.

### 6. Chat error, but Mock Provider works

- **Cause:** The failure is provider-specific (auth, unsupported format, route name).
- **Fix:** Test the provider directly with a raw request (see #8). Verify the model id in the request matches the registry exactly (`GenerateRequest` in `python-engine/ai/models/chat.py` → `registry.REGISTERED_MODELS`).

### 7. No response / panel stuck at "…"

- **Cause:** Aborted fetch or an unhandled error left the panel in a loading state.
- **Fix:** Reload the panel state (close/reopen the AI panel); check the browser console for the exact HTTP code; check API logs. Then apply #3/#4.

### 8. Raw provider diagnostics

```bash
# LM Studio (OpenAI-compatible)
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "qwen2.5-coder-1.5b-instruct", "messages": [{"role": "user", "content": "ping"}]}'

# Ollama
curl http://localhost:11434/api/generate -d '{"model": "llama3.2", "prompt": "ping"}'

# Gemini (uses REST generateContent; model id must exist for the account)
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" -d '{"contents": [{"parts": [{"text": "ping"}]}]}'
```

## Golden Rules

1. **Mock first** — if Mock works, the app plumbing is fine; the problem is provider-side.
2. **Probe before you blame the UI** — the chip state mirrors reachability; `curl` the endpoint.
3. **Logs speak** — `AIService` logs the selected provider and prompt size per request; error logs name the failing provider.
4. **Registry over magic** — models must be registered; the UI cannot conjure unregistered ids.

Still stuck after the relevant checklist? File the issue with: provider, model id, endpoint reachability output, exact HTTP code, and server log excerpt — that is enough to isolate any failure in this module.