# AI API Reference

Base URL: `/api/ai`

All endpoints are mounted under the FastAPI application defined in `python-engine/main.py`.

---

## `GET /api/ai/health`

AI module health check. Returns whether the router is loaded — it does **not** verify the LLM backend is reachable.

### Response Schema

```json
{
    "module": "ai",
    "status": "initialized"
}
```

### Example Request

```
GET /api/ai/health
```

### Example Response

```json
{
    "module": "ai",
    "status": "initialized"
}
```

### Status Codes

| Code | Description |
|---|---|
| 200 | Module is initialized and the router is mounted |

### Notes

- This endpoint does **not** ping the LLM provider. It only confirms the router is loaded.
- If the module fails to initialize (which would prevent the server from starting), this endpoint would not be reachable.

---

## `GET /api/ai/models`

List all available models. Returns static registry entries combined with any Ollama models discovered on the local machine.

### Response Schema

```json
[
    {
        "id": "string",
        "display_name": "string",
        "provider": "string",
        "local": true
    }
]
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique model identifier |
| `display_name` | string | Human-readable name |
| `provider` | string | Provider backend (e.g., `"ollama"`, `"openai-compatible"`) |
| `local` | boolean | Whether the model runs locally |

### Example Request

```
GET /api/ai/models
```

### Example Response

```json
[
    {
        "id": "mock",
        "display_name": "Mock Provider",
        "provider": "mock",
        "local": true
    },
    {
        "id": "qwen2.5-coder-1.5b-instruct",
        "display_name": "Qwen 2.5 Coder 1.5B Instruct",
        "provider": "openai-compatible",
        "local": true
    },
    {
        "id": "llama3.2",
        "display_name": "Llama 3.2",
        "provider": "ollama",
        "local": true
    }
]
```

### Status Codes

| Code | Description |
|---|---|
| 200 | Models returned successfully |

### Notes

- The response includes both statically registered models and any dynamically discovered Ollama models.
- If Ollama is not running or not installed, only static models are returned (no error).
- The `local` field distinguishes between local models (`true`) and cloud API models (`false`, e.g., GPT-4o Mini, Gemini Pro).

---

## `POST /api/ai/generate`

Run the full generation pipeline: assemble context from optional domain data, construct a prompt, call the selected LLM provider, and return the parsed response.

### Request Schema

```json
{
    "user_query": "string",
    "provider_name": "qwen2.5-coder-1.5b-instruct",
    "market_data": {},
    "strategy_data": {},
    "backtest_data": {},
    "metrics_data": {},
    "portfolio_data": {}
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `user_query` | string | **Yes** | — | The user's question or instruction |
| `provider_name` | string | No | `"qwen2.5-coder-1.5b-instruct"` | Model ID or provider name |
| `market_data` | object | No | `null` | Market context data |
| `strategy_data` | object | No | `null` | Strategy context data |
| `backtest_data` | object | No | `null` | Backtest context data |
| `metrics_data` | object | No | `null` | Metrics context data |
| `portfolio_data` | object | No | `null` | Portfolio context data |

### Response Schema

```json
{
    "success": true,
    "provider": "qwen2.5-coder-1.5b-instruct",
    "user_query": "string",
    "prompt": "string",
    "context": {},
    "response": {},
    "error": null
}
```

| Field | Type | Description |
|---|---|---|
| `success` | boolean | Whether the generation succeeded |
| `provider` | string | Provider identifier used |
| `user_query` | string | Original user query |
| `prompt` | string | The full constructed prompt string |
| `context` | object\|null | The assembled context dictionary |
| `response` | object\|null | The parsed LLM response |
| `error` | string\|null | Error message if generation failed |

### Example Request

```json
POST /api/ai/generate
Content-Type: application/json

{
    "user_query": "What was the Sharpe ratio of the last backtest?",
    "provider_name": "mock",
    "metrics_data": {
        "sharpe_ratio": 1.45,
        "max_drawdown": -0.12,
        "win_rate": 0.68
    }
}
```

### Example Response

```json
{
    "success": true,
    "provider": "mock",
    "user_query": "What was the Sharpe ratio of the last backtest?",
    "prompt": "============================================================\nSYSTEM INSTRUCTION\n============================================================\nYou are TradeRetro AI Copilot...\n\n============================================================\nCONTEXT DATA\n============================================================\n[Quantitative Metrics] (Source: None)\n{'sharpe_ratio': 1.45, 'max_drawdown': -0.12, 'win_rate': 0.68}\n\n[Market Data]\nData Not Available\n...\n============================================================\nOUTPUT RULES\n...\n============================================================\nUSER QUESTION\n============================================================\nWhat was the Sharpe ratio of the last backtest?",
    "context": {
        "user": {"message": "What was the Sharpe ratio of the last backtest?", "conversation_id": null, "session_id": null},
        "market": {"available": false, "source": null, "data": null},
        "strategy": {"available": false, "source": null, "data": null},
        "backtest": {"available": false, "source": null, "data": null},
        "metrics": {"available": true, "source": null, "data": {"sharpe_ratio": 1.45, "max_drawdown": -0.12, "win_rate": 0.68}},
        "portfolio": {"available": false, "source": null, "data": null},
        "metadata": {
            "generated_at": "2026-07-25T03:00:00.000000+00:00",
            "total_domains": 6,
            "populated_domains": 2,
            "domains_with_data": ["user", "metrics"]
        }
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

### Status Codes

| Code | Description |
|---|---|
| 200 | Generation completed (check `success` field for LLM result) |
| 422 | Validation error (e.g., missing `user_query`) |

### Notes

- The `provider_name` field accepts either a model ID (e.g., `"qwen2.5-coder-1.5b-instruct"`) or a provider name (e.g., `"mock"`).
- Context fields (`market_data`, `strategy_data`, etc.) are optional. Missing fields result in `"available": false` in the context.
- The `prompt` field in the response contains the full constructed prompt sent to the LLM, useful for debugging.
- The `response` field may contain `"raw_response"` if the LLM output was not valid JSON.
- Generation can fail (e.g., LM Studio not running) and still return HTTP 200 with `success: false` in the response body.
- The mock provider ignores the prompt and returns a deterministic response — useful for testing without a live LLM.
