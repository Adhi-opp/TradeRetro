# Task 4B — Wire Router to AIService Using Mock Provider

**Branch:** `feature/ai-copilot`  
**Date:** 2026-07-24

---

## 1. Files Modified

| File | Change |
|---|---|
| `python-engine/ai/service.py` | Changed `generate_response()` return type from `Dict[str, Any]` to `GenerateResponse`; returns typed Pydantic model instead of raw dict |
| `python-engine/ai/router.py` | Replaced static stub with call to `AIService.generate_response()`; added `AIService` import and module-level instance |

**Files NOT modified:** `config.py`, `context_builder.py`, `prompt_builder.py`, `llm_provider.py`, `providers/*`, `models/chat.py`, `main.py`.

---

## 2. Architecture Explanation

**Before (Task 4A):** Router returned a static `GenerateResponse` with `provider="stub"`. The AIService was never instantiated or called. The entire pipeline was dead code.

**After (Task 4B):** The router delegates to `AIService.generate_response()`, which:
1. Calls `ContextBuilder.build()` to aggregate domain data into a structured context dict
2. Calls `PromptBuilder.build()` to assemble the system instruction + context + user query into a prompt string
3. Calls `LLMProviderFactory.get_provider("mock")` to obtain a `MockLLMProvider` instance
4. Calls `MockLLMProvider.generate_response()` to get a deterministic JSON string
5. Parses the JSON and returns a typed `GenerateResponse` Pydantic model

The only change to `service.py` was making it return `GenerateResponse` instead of a plain dict — this makes the type contract explicit and eliminates ad-hoc dict key lookups in callers.

---

## 3. Request Flow

```
Client
  │
  │ POST /api/ai/generate  { user_query, provider_name, ... }
  ▼
┌──────────────────────────────────────────────────────────┐
│  router.py  POST /api/ai/generate                        │
│  ai_service.generate_response(body.user_query, ...)      │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  AIService.generate_response()                           │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  1. ContextBuilder.build(                        │    │
│  │       market_data, strategy_data,                │    │
│  │       backtest_data, metrics_data,               │    │
│  │       portfolio_data)                            │    │
│  │     → unified context dict                       │    │
│  └──────────────────┬───────────────────────────────┘    │
│                     ▼                                     │
│  ┌──────────────────────────────────────────────────┐    │
│  │  2. PromptBuilder.build(user_query, context)      │    │
│  │     → full prompt string                          │    │
│  └──────────────────┬───────────────────────────────┘    │
│                     ▼                                     │
│  ┌──────────────────────────────────────────────────┐    │
│  │  3. LLMProviderFactory.get_provider("mock")       │    │
│  │     → MockLLMProvider instance                    │    │
│  └──────────────────┬───────────────────────────────┘    │
│                     ▼                                     │
│  ┌──────────────────────────────────────────────────┐    │
│  │  4. MockLLMProvider.generate_response(prompt)     │    │
│  │     → deterministic JSON string                   │    │
│  └──────────────────┬───────────────────────────────┘    │
│                     ▼                                     │
│  ┌──────────────────────────────────────────────────┐    │
│  │  5. json.loads(raw) → parsed dict                │    │
│  │     → GenerateResponse(success=True, ...)         │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  router returns GenerateResponse (HTTP 200)               │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Manual Verification

All components in the chain were verified to execute:

```
GET /api/ai/health → 200  {"module":"ai","status":"initialized"}

POST /api/ai/generate → 200
{
  "success": true,
  "provider": "mock",
  "user_query": "What is my portfolio risk?",
  "prompt": "### SYSTEM INSTRUCTION\nYou are TradeRetro AI, an elite Quant...",
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

**Chain confirmation:**

| Component | Evidence in response |
|---|---|
| ✅ Router | `POST /api/ai/generate` returns 200 |
| ✅ AIService | `success: true`, `provider: mock` |
| ✅ ContextBuilder | `context` dict with all 5 domain keys |
| ✅ PromptBuilder | `prompt` starts with `### SYSTEM INSTRUCTION` |
| ✅ MockLLMProvider | `response.provider: "mock"` and `response.response: "Mock response generated successfully."` |
| ✅ GenerateResponse | Full Pydantic model with all fields |

---

## 5. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `AIService` instance is module-level singleton in router | Low | Stateless service with no DB connections; safe for concurrency. Can be moved to dependency injection later. |
| `generate_response()` is synchronous, handler is async | Low | `MockLLMProvider` is instant; real providers will need async conversion later. Non-blocking for current usage. |

---

## 6. Diff

### `service.py`

```diff
--- a/python-engine/ai/service.py
+++ b/python-engine/ai/service.py
@@ -11,6 +11,7 @@

 from ai.context_builder import ContextBuilder
 from ai.llm_provider import LLMProviderFactory
+from ai.models.chat import GenerateResponse
 from ai.prompt_builder import PromptBuilder

@@ -49,7 +50,7 @@ class AIService:
         portfolio_data: Optional[Dict[str, Any]] = None,
-    ) -> Dict[str, Any]:
+    ) -> GenerateResponse:
         """Generates an AI response ...

         Returns:
-            Structured response dictionary ...
+            GenerateResponse ...
         """
         try:
-            # 1. Build context dictionary
             context = self.context_builder.build(
                 ...
             )
-            # 2. Construct final LLM prompt string
             prompt = self.prompt_builder.build(user_query=user_query, context=context)
-            # 3. Retrieve LLM provider instance from factory
             provider = self.provider_factory.get_provider(provider_name)
-            # 4. Generate raw response string from provider
             raw_response_str = provider.generate_response(prompt)
-            # 5. Parse/Deserialize response payload
             try:
                 parsed_response = json.loads(raw_response_str)
             except (json.JSONDecodeError, TypeError):
                 parsed_response = {"raw_response": raw_response_str}

-            return {
-                "success": True,
-                "provider": provider_name,
-                "user_query": user_query,
-                "prompt": prompt,
-                "context": context,
-                "response": parsed_response,
-            }
+            return GenerateResponse(
+                success=True,
+                provider=provider_name,
+                user_query=user_query,
+                prompt=prompt,
+                context=context,
+                response=parsed_response,
+                error=None,
+            )

         except Exception as exc:
             logger.error(f"Error in AIService.generate_response: {exc}", exc_info=True)
-            return {
-                "success": False,
-                "provider": provider_name,
-                "user_query": user_query,
-                "error": str(exc),
-            }
+            return GenerateResponse(
+                success=False,
+                provider=provider_name,
+                user_query=user_query,
+                error=str(exc),
+            )
```

### `router.py`

```diff
--- a/python-engine/ai/router.py
+++ b/python-engine/ai/router.py
@@ -9,8 +9,12 @@

 from fastapi import APIRouter

 from ai.models.chat import AIHealthResponse, GenerateRequest, GenerateResponse
+from ai.service import AIService

 router = APIRouter(prefix="/api/ai", tags=["AI"])

+ai_service = AIService()
+

 @router.get("/health", response_model=AIHealthResponse)
 async def health() -> AIHealthResponse:
@@ -20,12 +24,13 @@ async def health() -> AIHealthResponse:

 @router.post("/generate", response_model=GenerateResponse)
 async def generate(body: GenerateRequest) -> GenerateResponse:
-    """Stub AI generate endpoint."""
-    return GenerateResponse(
-        success=True,
-        provider="stub",
-        user_query=body.user_query,
-        prompt="",
-        context=None,
-        response={"message": "AI endpoint is connected successfully."},
-        error=None,
+    """Generate an AI Copilot response using the full pipeline."""
+    return ai_service.generate_response(
+        user_query=body.user_query,
+        provider_name=body.provider_name,
+        market_data=body.market_data,
+        strategy_data=body.strategy_data,
+        backtest_data=body.backtest_data,
+        metrics_data=body.metrics_data,
+        portfolio_data=body.portfolio_data,
     )
```
