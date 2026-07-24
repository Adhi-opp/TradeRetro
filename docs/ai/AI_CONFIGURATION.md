# AI Configuration

Configuration for the AI Copilot is entirely self-contained within `python-engine/ai/config.py`. There are no environment variables and no central `Settings` class fields for AI — the `AIConfig` dataclass holds everything.

## AIConfig

`AIConfig` is a plain `@dataclass` with all defaults:

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | `bool` | `True` | Master toggle for the AI Copilot |
| `provider` | `str` | `"openai-compatible"` | Default provider backend identifier |
| `model` | `str` | `"qwen2.5-coder-1.5b-instruct"` | Default model ID sent to the provider |
| `temperature` | `float` | `0.2` | LLM sampling temperature (0.0–2.0) |
| `max_tokens` | `int` | `1024` | Maximum tokens in the generated response |
| `timeout_seconds` | `int` | `30` | HTTP request timeout for providers |
| `debug` | `bool` | `False` | Enable debug-level logging |
| `openai_compatible_base_url` | `str` | `"http://localhost:1234"` | Base URL for openai-compatible provider |
| `openai_compatible_api_key` | `str` | `"not-needed"` | API key for openai-compatible provider |

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

The `openai-compatible` provider is special — it receives `model`, `base_url`, and `api_key` from `AIConfig`. All other providers are instantiated with no arguments (they use their own hardcoded defaults). This avoids coupling every provider to the same configuration schema — Ollama doesn't need an API key, and the mock provider doesn't need a base URL.

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

### Why hardcoded defaults instead of environment variables?

The AI module is a self-contained subsystem. Hardcoded defaults mean:
- No additional environment variables needed in `.env` or deployment configs
- The module works out of the box if LM Studio is running on the same machine
- Configuration changes are explicit code changes (traceable in version control)

The trade-off is that changing settings (e.g., pointing to a different LM Studio port) requires a code change rather than an env var override.

### Why separate timeout values?

`AIConfig.timeout_seconds` (30s) is the general default. `OpenAICompatibleProvider` uses a 120s timeout because local LLMs on consumer hardware can be slow, especially for longer generations. `OllamaProvider` uses 60s. These are internal defaults in the provider classes, not in `AIConfig`.

### What's Next

See [AI_FUTURE_ROADMAP.md](AI_FUTURE_ROADMAP.md) for planned configuration improvements including environment variable overrides, YAML/JSON config files, per-provider profiles, and a runtime configuration API.
