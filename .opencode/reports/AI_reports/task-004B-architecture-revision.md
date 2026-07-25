# Task 4B — Architecture Revision: Keep AIService Framework-Agnostic

**Branch:** `feature/ai-copilot`  
**Date:** 2026-07-24

---

## 1. Files Modified

| File | Change |
|---|---|
| `python-engine/ai/service.py` | Removed `GenerateResponse` import; return type back to `Dict[str, Any]`; returns plain dicts instead of Pydantic models |
| `python-engine/ai/router.py` | Captures `AIService` dict result, unpacks into `GenerateResponse(**result)` |

**Files NOT modified:** `context_builder.py`, `prompt_builder.py`, `llm_provider.py`, `providers/*`, `config.py`, `models/chat.py`, `main.py`.

---

## 2. Exact Architectural Change

**Problem:** `AIService` was coupled to `GenerateResponse` (a FastAPI/Pydantic HTTP response model), violating the principle that business/domain logic should not depend on the presentation layer.

**Solution:** Move the `GenerateResponse` construction from the service up to the router, which is the correct layer to handle HTTP response serialization.

**Before (Task 4B):**

```
Router  ──▶  AIService.generate_response()
                              │
                              ▼
                     returns GenerateResponse
                     (coupled to HTTP layer)
```

**After (revision):**

```
Router  ──▶  AIService.generate_response()
                              │
                              ▼
                     returns plain dict
                              │
                              ▼
              Router: GenerateResponse(**result)
              (HTTP concern isolated in router)
```

---

## 3. Diff

### `service.py`

```diff
--- a/python-engine/ai/service.py
+++ b/python-engine/ai/service.py
@@ -13,7 +13,6 @@

 from ai.context_builder import ContextBuilder
 from ai.llm_provider import LLMProviderFactory
-from ai.models.chat import GenerateResponse
 from ai.prompt_builder import PromptBuilder

@@ -49,7 +48,7 @@ class AIService:
         portfolio_data: Optional[Dict[str, Any]] = None,
-    ) -> GenerateResponse:
+    ) -> Dict[str, Any]:
         """Generates an AI response ...

         Returns:
-            GenerateResponse ...
+            Dictionary ...
         """
         ...

-            return GenerateResponse(
-                success=True,
-                provider=provider_name,
-                ...
-            )
+            return {
+                "success": True,
+                "provider": provider_name,
+                ...
+                "error": None,
+            }

         except Exception as exc:
-            return GenerateResponse(
-                success=False,
-                provider=provider_name,
-                ...
-            )
+            return {
+                "success": False,
+                "provider": provider_name,
+                ...
+            }
```

### `router.py`

```diff
--- a/python-engine/ai/router.py
+++ b/python-engine/ai/router.py
@@ -24,10 +24,11 @@ async def health() -> AIHealthResponse:

 @router.post("/generate", response_model=GenerateResponse)
 async def generate(body: GenerateRequest) -> GenerateResponse:
-    return ai_service.generate_response(
+    result = ai_service.generate_response(
         user_query=body.user_query,
         ...
     )
+    return GenerateResponse(**result)
```

---

## 4. Manual Verification

```
GET  /api/ai/health      → 200  module=ai, status=initialized
POST /api/ai/generate     → 200

  success:        true
  provider:       mock
  prompt length:  643
  context keys:   ['market', 'strategy', 'backtest', 'metrics', 'portfolio']
  response keys:  ['provider', 'success', 'response', 'tokens_used']
  error:          null
```

All assertions passed — pipeline executes, `GenerateResponse` shape returned, Swagger schema unchanged.

---

## 5. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `GenerateResponse(**result)` could fail if dict keys don't match model fields | Low | The dict keys are explicitly written and match `GenerateResponse` fields exactly. Adding/removing a field in one place without the other would be caught at compile/test time. |
