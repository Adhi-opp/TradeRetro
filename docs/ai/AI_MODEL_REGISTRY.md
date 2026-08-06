# AI Model Registry

The model registry in `python-engine/ai/registry.py` maintains a catalog of known LLM models with metadata about their provider backend and whether they run locally.

## ModelInfo

Each model is represented by a `ModelInfo` dataclass:

| Field | Type | Description |
|---|---|---|
| `id` | `str` | Unique identifier (e.g., `"llama3.2"`, `"qwen2.5-coder-1.5b-instruct"`) |
| `display_name` | `str` | Human-readable name for UI display |
| `provider` | `str` | Provider backend identifier (e.g., `"ollama"`, `"mock"`) |
| `local` | `bool` | Whether the model runs locally or requires a cloud API |

## Statically Registered Models

The static registry (`REGISTERED_MODELS`) contains 13 entries:

### Mock

| ID | Display Name | Provider | Local |
|---|---|---|---|
| `mock` | Mock Provider | `mock` | Yes |

### Ollama

| ID | Display Name | Provider | Local |
|---|---|---|---|
| `llama3.2` | Llama 3.2 | `ollama` | Yes |
| `llama3.1` | Llama 3.1 | `ollama` | Yes |
| `mistral` | Mistral | `ollama` | Yes |
| `gemma2` | Gemma 2 | `ollama` | Yes |

### Gemini (Cloud)

| ID | Display Name | Provider | Local |
|---|---|---|---|
| `gemini-pro` | Gemini Pro | `gemini` | No |

### OpenAI (Cloud)

| ID | Display Name | Provider | Local |
|---|---|---|---|
| `gpt-4o-mini` | GPT-4o Mini | `openai` | No |

### OpenAI-Compatible (Local)

| ID | Display Name | Provider | Local |
|---|---|---|---|
| `qwen2.5-coder-1.5b-instruct` | Qwen 2.5 Coder 1.5B Instruct | `openai-compatible` | Yes |
| `qwen2.5-coder-7b-instruct` | Qwen 2.5 Coder 7B Instruct | `openai-compatible` | Yes |
| `deepseek-r1-distill-qwen-7b` | DeepSeek R1 Distill Qwen 7B | `openai-compatible` | Yes |
| `dolphin3.0-llama3.2-3b` | Dolphin 3.0 Llama 3.2 3B | `openai-compatible` | Yes |
| `llama-3.2-3b-instruct` | Llama 3.2 3B Instruct | `openai-compatible` | Yes |
| `mistral-nemo-instruct` | Mistral Nemo Instruct | `openai-compatible` | Yes |

## Dynamic Model Discovery (Ollama)

At query time, `discover_ollama_models()` queries the local Ollama instance:

```
GET http://localhost:11434/api/tags
```

Discovered models are merged into the registry with `provider="ollama"` and `local=True`. Models that already exist in the static registry are not overwritten.

**Failure behavior:** If Ollama is unreachable (not installed, not running, or connection refused), the function logs a debug message and returns only the static registry. No exception is raised to the caller.

## Provider Mapping

The registry's `resolve_model()` function connects model IDs to provider types:

```
Model ID → ModelInfo.provider → AIProviderFactory._provider_classes → Provider instance
```

Example resolution for `"qwen2.5-coder-1.5b-instruct"`:

```
1. registry.resolve_model("qwen2.5-coder-1.5b-instruct")
2. → ModelInfo(provider="openai-compatible", id="qwen2.5-coder-1.5b-instruct", ...)
3. → AIProviderFactory._provider_classes["openai-compatible"]
4. → OpenAICompatibleProvider(model="qwen2.5-coder-1.5b-instruct", ...)
```

## Selection Process

When a user submits a request to `POST /api/ai/generate`, the `provider_name` field determines which model/provider is used:

1. **If `provider_name` matches a model ID** in the registry (e.g., `"qwen2.5-coder-1.5b-instruct"`):
   - The registry returns the corresponding `ModelInfo`
   - The factory uses `ModelInfo.provider` to select the provider class
   - The `provider_name` string is the default value of `GenerateRequest.provider_name`

2. **If `provider_name` matches a provider name** (e.g., `"mock"`):
   - The registry raises `KeyError` (no model with that ID)
   - The factory falls back to treating the input as a provider name directly
   - The provider class is instantiated (with no model-specific config)

3. **If `provider_name` matches neither:**
   - `ValueError` is raised with the list of supported providers

## Model Listing

`GET /api/ai/models` calls `list_models()` which merges static and discovered models and returns them as a list. The response includes both working providers and stubs (OpenAI, Gemini) so clients can see the full intended scope.

## Cloud Model Status

Cloud models (GPT-4o Mini, Gemini Pro) are registered but backed by stub providers that return "not implemented" errors. The registry schema already supports them — when real cloud providers land, only the implementation classes need to change. The `local` flag is already in place for the UI to distinguish local from cloud models.

See [AI_FUTURE_ROADMAP.md](AI_FUTURE_ROADMAP.md) for the cloud provider plan.
