# Task 4A — Stub POST /api/ai/generate Endpoint

**Branch:** `feature/ai-copilot`  
**Date:** 2026-07-24

---

## 1. Implementation

Added a single POST route handler to `python-engine/ai/router.py`:

```python
@router.post("/generate", response_model=GenerateResponse)
async def generate(body: GenerateRequest) -> GenerateResponse:
    """Stub AI generate endpoint."""
    return GenerateResponse(
        success=True,
        provider="stub",
        user_query=body.user_query,
        prompt="",
        context=None,
        response={"message": "AI endpoint is connected successfully."},
        error=None,
    )
```

The endpoint:
- Accepts `GenerateRequest` via request body
- Returns a static `GenerateResponse` Pydantic model (not a raw dict)
- Echoes `user_query` from the request into the response
- Returns `HTTP 200` in all cases

---

## 2. Files Modified

| File | Change |
|---|---|
| `python-engine/ai/router.py` | Added `GenerateRequest`, `GenerateResponse` to import line; added `generate()` handler function |

**Files explicitly NOT modified:** `service.py`, `llm_provider.py`, `providers/*`, `config.py`, `models/chat.py`, `main.py`.

---

## 3. Verification Results

### Swagger route registration

```python
from ai.router import router
print([r.path for r in router.routes])
# Output: ['/api/ai/health', '/api/ai/generate']
```

### HTTP 200 — Health check

```
GET /api/ai/health → 200
{"module":"ai","status":"initialized"}
```

### HTTP 200 — Generate stub

```
POST /api/ai/generate
Body: {"user_query": "What is my portfolio risk?", ...}
→ 200
```

**Response body:**

```json
{
  "success": true,
  "provider": "stub",
  "user_query": "What is my portfolio risk?",
  "prompt": "",
  "context": null,
  "response": {"message": "AI endpoint is connected successfully."},
  "error": null
}
```

### Verified

- `GenerateRequest` is accepted and validated (Pydantic)
- `GenerateResponse` is returned (Pydantic model, not dict)
- No `AIService`, `ContextBuilder`, `PromptBuilder`, `LLMProviderFactory`, or `MockLLMProvider` was instantiated or called

---

## 4. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| None — this is a stub that returns static data | None | No external dependencies, no state mutation, no database access |

---

## 5. Diff

```diff
--- a/python-engine/ai/router.py
+++ b/python-engine/ai/router.py
@@ -8,9 +8,20 @@

 from fastapi import APIRouter

-from ai.models.chat import AIHealthResponse
+from ai.models.chat import AIHealthResponse, GenerateRequest, GenerateResponse

 router = APIRouter(prefix="/api/ai", tags=["AI"])


 @router.get("/health", response_model=AIHealthResponse)
 async def health() -> AIHealthResponse:
     """AI module health check."""
     return AIHealthResponse(module="ai", status="initialized")
+
+
+@router.post("/generate", response_model=GenerateResponse)
+async def generate(body: GenerateRequest) -> GenerateResponse:
+    """Stub AI generate endpoint."""
+    return GenerateResponse(
+        success=True,
+        provider="stub",
+        user_query=body.user_query,
+        prompt="",
+        context=None,
+        response={"message": "AI endpoint is connected successfully."},
+        error=None,
+    )
```
