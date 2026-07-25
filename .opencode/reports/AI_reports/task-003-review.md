# Task Summary

Introduce typed Pydantic request and response models for the AI API.

## Objective

Replace unstructured dict returns with typed Pydantic models to improve Swagger documentation, enable IDE autocompletion, and provide a formal API contract — without changing business logic or API behavior.

## Files Changed

1. **`python-engine/ai/models/chat.py`** — Added `GenerateRequest`, `GenerateResponse`, and `AIHealthResponse` Pydantic models. Updated module docstring.
2. **`python-engine/ai/router.py`** — Imported `AIHealthResponse`, added `response_model=AIHealthResponse` to the health endpoint, and typed the return annotation.

## Architecture Impact

Minimal. Models follow the existing `pydantic.BaseModel` + `Field(..., description=...)` pattern already established by the placeholder `Message`, `ChatRequest`, and `ChatResponse` classes. The router is still thin — no business logic was moved or duplicated.

## Why the change is safe

- The health endpoint returns the exact same data (module="ai", status="initialized").
- `AIHealthResponse` uses `default` values matching the original inline dict, so the response is identical.
- The `response_model` parameter is additive — FastAPI uses it for schema generation and response validation, but does not change the serialized output when the returned object matches.
- `GenerateRequest` and `GenerateResponse` map 1:1 to `AIService.generate_response()` parameters and return dict, but are not yet wired to any endpoint (available for the next task).
- No imports changed outside the AI module.
- App loads successfully.

## Unified Diff

```diff
diff --git a/python-engine/ai/models/chat.py b/python-engine/ai/models/chat.py
index 77f291a..bf3083c 100644
--- a/python-engine/ai/models/chat.py
+++ b/python-engine/ai/models/chat.py
@@ -1,7 +1,7 @@
 """
 AI Chat Models
 ==============
-Placeholder Pydantic models for AI conversation interface.
+Pydantic models for AI Copilot request/response interface.
 """
 
 from typing import List, Optional
@@ -21,3 +21,29 @@ class ChatRequest(BaseModel):
 class ChatResponse(BaseModel):
     message: Message = Field(..., description="Assistant response message")
     usage: Optional[dict] = Field(default=None, description="Token usage stats if available")
+
+
+class GenerateRequest(BaseModel):
+    user_query: str = Field(..., description="User query text")
+    provider_name: str = Field(default="mock", description="LLM provider identifier")
+    market_data: Optional[dict] = Field(default=None, description="Market context data")
+    strategy_data: Optional[dict] = Field(default=None, description="Strategy context data")
+    backtest_data: Optional[dict] = Field(default=None, description="Backtest context data")
+    metrics_data: Optional[dict] = Field(default=None, description="Metrics context data")
+    portfolio_data: Optional[dict] = Field(default=None, description="Portfolio context data")
+
+
+class GenerateResponse(BaseModel):
+    success: bool = Field(..., description="Whether the generation succeeded")
+    provider: str = Field(..., description="Provider identifier used")
+    user_query: str = Field(..., description="Original user query")
+    prompt: str = Field(default="", description="Constructed prompt string")
+    context: Optional[dict] = Field(default=None, description="Context dictionary")
+    response: Optional[dict] = Field(default=None, description="Parsed LLM response")
+    error: Optional[str] = Field(default=None, description="Error message if generation failed")
+
+
+class AIHealthResponse(BaseModel):
+    module: str = Field(default="ai", description="Module identifier")
+    status: str = Field(default="initialized", description="Current module status")
+
diff --git a/python-engine/ai/router.py b/python-engine/ai/router.py
index 1064038..bac695c 100644
--- a/python-engine/ai/router.py
+++ b/python-engine/ai/router.py
@@ -7,13 +7,12 @@ Tag: AI
 
 from fastapi import APIRouter
 
+from ai.models.chat import AIHealthResponse
+
 router = APIRouter(prefix="/api/ai", tags=["AI"])
 
 
-@router.get("/health")
-async def health():
+@router.get("/health", response_model=AIHealthResponse)
+async def health() -> AIHealthResponse:
     """AI module health check."""
-    return {
-        "module": "ai",
-        "status": "initialized",
-    }
+    return AIHealthResponse(module="ai", status="initialized")
```

## Acceptance Criteria Checklist

| Criterion | Status |
|---|---|
| Typed request models | ✅ `GenerateRequest`, `ChatRequest` |
| Typed response models | ✅ `GenerateResponse`, `AIHealthResponse`, `ChatResponse` |
| Same API behavior | ✅ Health endpoint returns identical values |
| Better Swagger documentation | ✅ `response_model` and `Field(description=...)` populate OpenAPI schema |
| No business logic changes | ✅ Router still returns static data |
| Smallest possible diff | ✅ +28 lines in chat.py, -3/+3 lines in router.py |

## Risks

- **Unused models**: `GenerateRequest` and `GenerateResponse` are defined but not wired to any endpoint yet. They impose no runtime cost but could be seen as dead code until the generate endpoint is added. Acceptable — they are the API contract for the next task.

## Recommended Commit Message

```
feat(ai): add typed Pydantic request/response models for AI API
```

## Next Suggested Atomic Task

Wire the `POST /api/ai/generate` endpoint using `GenerateRequest`/`GenerateResponse` models and the `AIService.generate_response()` method.
