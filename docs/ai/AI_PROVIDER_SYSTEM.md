# AI Provider System

The provider system uses a combination of the **Factory** and **Registry** patterns to abstract LLM backend selection and instantiation.

## Architecture

```
                    ┌──────────────────────────────┐
                    │    AIProviderFactory         │
                    │  (ai/provider_factory.py)    │
                    │                              │
                    │  get_provider(model_or_prov) │
                    │         → BaseLLMProvider    │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────▼───────────────────┐
                    │     Model Registry           │
                    │  (ai/registry.py)            │
                    │                              │
                    │  resolve_model(id) → ModelInfo│
                    │  {id, provider, local, name}  │
                    └──────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  MockLLMProvider │  │ OllamaProvider  │  │ OpenAICompat...  │
│  (deterministic) │  │ (Ollama API)    │  │ (LM Studio/     │
│                  │  │                 │  │  vLLM/TGI)      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
          ▲                    ▲                    ▲
          └────────────────────┼────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  BaseLLMProvider    │
                    │  (abstract)         │
                    │                     │
                    │  generate_response  │
                    │  (prompt) → str     │
                    └────────────────────┘
```

## Base Provider Interface

```python
# ai/providers/base_provider.py
class BaseLLMProvider(ABC):
    @abstractmethod
    def generate_response(self, prompt: str) -> str:
        """Returns a JSON string."""
```

Every provider must implement `generate_response(prompt)` returning a JSON string. The JSON carries `provider` and `success`; success responses include `response` (plus `model` and `tokens_used` where the provider tracks them), and failure responses carry `error`.

## Concrete Providers

### MockLLMProvider (`ai/providers/mock_provider.py`)

Working. Produces deterministic output for offline testing. The prompt is ignored — the same JSON is returned every call. No constructor arguments.

```python
provider = MockLLMProvider()
result = provider.generate_response("any prompt")
# → {"provider": "mock", "success": true, "response": "Mock response generated successfully.", "tokens_used": 0}
```

### OpenAICompatibleProvider (`ai/providers/openai_compatible_provider.py`)

Working — the primary provider. Talks to any OpenAI-compatible `/v1/chat/completions` endpoint (LM Studio, vLLM, TGI).

| Constructor param | Default | Note |
|---|---|---|
| `model` | `"qwen2.5-coder-7b-instruct"` | Overridden by `AIProviderFactory` with the resolved model ID |
| `base_url` | `"http://localhost:1234"` | LM Studio's default |
| `api_key` | `"not-needed"` | Local servers rarely require auth |
| `timeout_seconds` | `120` | Generous for local LLMs on consumer hardware |

```python
provider = OpenAICompatibleProvider(
    model="qwen2.5-coder-1.5b-instruct",
    base_url="http://localhost:1234",
    api_key="not-needed",
)
```

**Error handling:** 404 (model not loaded), `ConnectError` (server not running), `TimeoutException` (slow generation), empty content, no choices in API response. Each returns a structured JSON error.

**Token tracking:** If the API response includes a `usage` object, the provider extracts `prompt_tokens`, `completion_tokens`, and `total_tokens`.

### OllamaProvider (`ai/ollama_provider.py`)

Working. Calls `POST {base_url}/api/generate` on a local Ollama instance. Constructor accepts `model` (default `"llama3.2"`), `base_url` (default `"http://localhost:11434"`), and `timeout_seconds` (default `60`).

```python
provider = OllamaProvider(model="llama3.2")
```

**Error handling:** 404 (model not pulled — includes `ollama pull` instruction), `ConnectError` (Ollama not running), `TimeoutException`, empty response.

### OpenAIProvider (`ai/providers/openai_provider.py`)

Stub. Returns `{"provider": "openai", "success": false, "error": "OpenAI provider is not yet implemented", "response": null}` on every call.

### GeminiProvider (`ai/providers/gemini_provider.py`)

Working. Calls Google's Gemini `generateContent` REST API, targeting the Gemini Flash model family (default `"gemini-3.6-flash"`).

| Constructor param | Default | Note |
|---|---|---|
| `model` | `"gemini-3.6-flash"` | Overridden by `AIProviderFactory` with the resolved model ID |
| `api_key` | `""` | Google AI Studio API key; wired from `AIConfig.gemini_api_key` |
| `base_url` | `"https://generativelanguage.googleapis.com"` | Overridden by `AIConfig.gemini_base_url` |
| `timeout_seconds` | `60` | Request timeout |
| `temperature` | `None` | Sent via `generationConfig.temperature` when set |
| `max_tokens` | `None` | Sent via `generationConfig.maxOutputTokens` when set |

```python
provider = GeminiProvider(
    model="gemini-3.6-flash",
    api_key="YOUR_KEY",
)
```

**Request:** `POST {base_url}/v1beta/models/{model}:generateContent?key={api_key}` with body `{"contents": [{"role": "user", "parts": [{"text": prompt}]}]}` plus `generationConfig` when temperature/max_tokens are set.

**Error handling:** missing API key, authentication failure (HTTP 401/403), model not found (HTTP 400/404), `ConnectError`, `TimeoutException`, no candidates, empty text. Each returns a structured JSON error.

**Token tracking:** Extracts `usageMetadata.promptTokenCount`, `candidatesTokenCount`, and `totalTokenCount` when present.

## Factory Pattern

`AIProviderFactory` maps provider type strings to concrete classes:

```python
class AIProviderFactory:
    _provider_classes = {
        "mock": MockLLMProvider,
        "ollama": OllamaProvider,
        "gemini": GeminiProvider,
        "openai": OpenAIProvider,
        "openai-compatible": OpenAICompatibleProvider,
    }

    def get_provider(self, model_or_provider: str) -> BaseLLMProvider:
        key = model_or_provider.lower().strip()
        try:
            info = resolve_model(key)          # ← registry lookup
            provider_type = info.provider      # e.g., "ollama"
        except KeyError:
            provider_type = key                # treat as provider name

        cls = self._provider_classes.get(provider_type)
        if cls is None:
            raise ValueError(...)

        if provider_type == "openai-compatible":
            return cls(model=..., base_url=..., api_key=...)
        if provider_type == "gemini":
            return cls(model=..., api_key=..., base_url=...)
        return cls()
```

The factory is **not** a plugin system — new providers require adding a class to `_provider_classes` and to the registry. This is intentional: the set of supported providers is finite and known at compile time.

## Registry Pattern

```python
# ai/registry.py
REGISTERED_MODELS = {
    "mock": ModelInfo(provider="mock", local=True),
    "qwen2.5-coder-1.5b-instruct": ModelInfo(provider="openai-compatible", local=True),
    "llama3.2": ModelInfo(provider="ollama", local=True),
    "gpt-4o-mini": ModelInfo(provider="openai", local=False),
    # ... 9 more entries (13 total)
}
```

The registry serves two purposes:
1. **Model discovery** — clients can list all available models via `GET /api/ai/models`
2. **Provider resolution** — the factory uses the registry to determine which provider class to instantiate for a given model ID

Ollama models are discovered dynamically at query time (not at startup) and merged into the registry.

## Provider Selection Flow

```
User specifies "qwen2.5-coder-1.5b-instruct"
                    │
                    ▼
Factory.get_provider("qwen2.5-coder-1.5b-instruct")
                    │
                    ▼
Registry.resolve_model("qwen2.5-coder-1.5b-instruct")
                    │
                    ▼
→ ModelInfo(provider="openai-compatible", id="qwen2.5-coder-1.5b-instruct")
                    │
                    ▼
_provider_classes["openai-compatible"] → OpenAICompatibleProvider
                    │
                    ▼
Instantiate with model, base_url, api_key from AIConfig
```

## Why This Design

| Benefit | Explanation |
|---|---|
| **Separation of concerns** | Router, service, factory, registry, and providers each have one job |
| **Testability** | Mock provider can be injected in tests without touching the network |
| **Extensibility** | Adding a new provider requires: (1) a new class in `providers/`, (2) an entry in `_provider_classes`, (3) an entry in the registry (if you want model ID → provider mapping) |
| **Graceful degradation** | If Ollama is down, static models still work. If a provider fails, the error is returned as structured JSON |
| **Discovery** | `GET /api/ai/models` returns everything available without hardcoding model lists per environment |

## Planned Providers

See [AI_FUTURE_ROADMAP.md](AI_FUTURE_ROADMAP.md) for the cloud provider plan — the Gemini provider is implemented; the OpenAI stub is the next implementation on the horizon.
