# AI Configuration

Configuration for the AI Copilot is largely self-contained within `python-engine/ai/config.py`. There are no central `Settings` class fields for AI — the `AIConfig` dataclass holds everything. The Gemini fields additionally support environment variable overrides (`GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_BASE_URL`), see [Environment Variable Overrides](#why-hardcoded-defaults-with-env-overrides-for-gemini) below.

## AIConfig

`AIConfig` is a plain `@dataclass` with all defaults:

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | `bool` | `True` | Master toggle for the AI Copilot |
| `provider` | `str` | `"openai-compatible"` | Default provider backend identifier |
| `model` | `str` | `"qwen2.5-coder-1.5b-instruct"` | Default model ID sent to the provider |
| `temperature` | `float` | `0.2` | LLM sampling temperature (0.0–2.0); configured default, not yet delivered to providers |
| `max_tokens` | `int` | `1024` | Maximum tokens in the generated response; configured default, not yet delivered to providers |
| `timeout_seconds` | `int` | `30` | Reserved; providers use their own internal timeouts (see below) |
| `debug` | `bool` | `False` | Enable debug-level logging |
| `openai_compatible_base_url` | `str` | `"http://localhost:1234"` | Base URL for openai-compatible provider |
| `openai_compatible_api_key` | `str` | `"not-needed"` | API key for openai-compatible provider |
| `gemini_api_key` | `str` | `""` | Google Gemini API key; defaults to the `GEMINI_API_KEY` env var |
| `gemini_model` | `str` | `"gemini-3.6-flash"` | Gemini model ID; defaults to the `GEMINI_MODEL` env var |
| `gemini_base_url` | `str` | `"https://generativelanguage.googleapis.com"` | Gemini API base URL; defaults to the `GEMINI_BASE_URL` env var |

## AIConfigurationManager

`AIConfigurationManager` wraps `AIConfig` with validated setters:

| Method | Description | Validation |
|---|---|---|
| `get_config()` | Returns current `AIConfig` instance | — |
| `set_provider(name)` | Changes active provider | — |
| `set_temperature(value)` | Sets temperature | Raises `ValueError` if not in `[0.0, 2.0]` |
| `set_max_tokens(value)` | Sets max tokens | Raises `ValueError` if ≤ 0 |
| `reset_defaults()` | Restores factory defaults | — |

## Provider Configuration

The provider is selected at runtime by `AIProviderFactory.get_provider()`. The input can be:

1. **A model ID** (e.g., `"qwen2.5-coder-1.5b-instruct"`) — looked up in the registry to find the provider type
2. **A provider name** (e.g., `"mock"`, `"ollama"`) — used directly if not found in the registry

The `openai-compatible` and `gemini` providers are wired with their connection details from `AIConfig` — the openai-compatible provider receives `model`, `base_url`, and `api_key`; the gemini provider receives `model`, `api_key`, and `base_url`. All other providers are instantiated with no arguments (they use their own hardcoded defaults). This avoids coupling every provider to the same configuration schema — Ollama doesn't need an API key, and the mock provider doesn't need a base URL.

## Model Configuration

Model selection is handled by the registry (`ai/registry.py`). The default model `"qwen2.5-coder-1.5b-instruct"` maps to the `"openai-compatible"` provider. This can be overridden per request via the `provider_name` field in `POST /api/ai/generate`.

## LM Studio Configuration

LM Studio is the primary target for the `openai-compatible` provider:

| Setting | Default | Notes |
|---|---|---|
| Base URL | `http://localhost:1234` | LM Studio's default server port |
| API Key | `"not-needed"` | Local servers typically don't require auth |
| Model | `"qwen2.5-coder-1.5b-instruct"` | Must match the model loaded in LM Studio |
| Timeout | 120s | Set within the provider, not in `AIConfig` |

To use LM Studio:
1. Launch LM Studio and load a model (e.g., `Qwen2.5-Coder-1.5B-Instruct`)
2. Start the local inference server (default: port 1234)
3. Send requests to `POST /api/ai/generate` with `provider_name: "qwen2.5-coder-1.5b-instruct"`

## Tradeoffs

### Why hardcoded defaults, with env overrides for Gemini?

The AI module is a self-contained subsystem. Local providers (openai-compatible, ollama, mock) keep hardcoded defaults:
- No additional environment variables needed in `.env` or deployment configs
- The module works out of the box if LM Studio is running on the same machine
- Configuration changes are explicit code changes (traceable in version control)

The trade-off is that changing settings (e.g., pointing to a different LM Studio port) requires a code change rather than an env var override.

The Gemini provider is different — it is a cloud API requiring a secret. Its three fields (`gemini_api_key`, `gemini_model`, `gemini_base_url`) default to the `GEMINI_API_KEY`, `GEMINI_MODEL`, and `GEMINI_BASE_URL` environment variables (optionally defined in `.env`), falling back to built-in defaults when the variables are unset. This keeps the API key out of source control.

### Why separate timeout values?

`AIConfig.timeout_seconds` (30s) is currently **reserved** — no provider reads it.
`OpenAICompatibleProvider` uses a 120s timeout because local LLMs on consumer
hardware can be slow, especially for longer generations. `OllamaProvider` uses
60s. These are internal defaults in the provider classes, not in `AIConfig`.

Similarly, `AIConfig.temperature` (0.2) and `AIConfig.max_tokens` (1024) are
**configured defaults but are not yet delivered to any provider** — provider
payloads send only `model`, `messages`, and `stream`. Wiring these values
through the provider interface is planned work; until then they serve as the
documented project defaults.

### What's Next

See [AI_FUTURE_ROADMAP.md](AI_FUTURE_ROADMAP.md) for planned configuration improvements including environment variable overrides, per-provider configuration profiles, and a runtime configuration API.
