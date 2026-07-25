# Task 5.2 — Prompt Builder v2

**Branch:** `feature/ai-copilot`  
**Date:** 2026-07-24

---

## 1. Files Changed

| File | Change |
|---|---|
| `python-engine/ai/prompt_builder.py` | Refactored into private builder pattern; added `build_prompt()` as primary API; preserved `build()` as legacy wrapper |

**Files NOT modified:** `service.py`, `context_builder.py`, `llm_provider.py`, `providers/*`, `config.py`, `models/chat.py`, `router.py`.

---

## 2. Design Decisions

### Private builder methods

| Method | Purpose |
|---|---|
| `_build_role()` | Assistant identity, responsibilities, and ethical constraints |
| `_build_system_prompt()` | Wraps `_build_role()` inside a `SYSTEM INSTRUCTION` section header |
| `_build_context(context)` | Renders ContextBuilder v2 dict into readable domain sections (market, strategy, backtest, metrics, portfolio) |
| `_build_output_rules()` | Response formatting rules (markdown, cite sources, no speculation) |
| `_build_user_prompt(context)` | Extracts `user.message` from the context dict and formats it as `USER QUESTION` |

### Prompt structure

```
============================================================
SYSTEM INSTRUCTION
============================================================
[role definition + responsibilities + constraints]

============================================================
CONTEXT DATA
============================================================
[Market Data] / [Strategy Configuration] / ...

============================================================
OUTPUT RULES
============================================================
[formatting rules]

============================================================
USER QUESTION
============================================================
[user query from context["user"]["message"]]
```

### `build_prompt(context)` as primary API
- Accepts the full ContextBuilder v2 dict
- Extracts the user query from `context["user"]["message"]`
- Returns a single assembled string
- Handles None/empty context gracefully

### `build(user_query, context)` as legacy wrapper
- Injects `user_query` into `context["user"]["message"]`
- Delegates to `build_prompt()`
- `service.py` continues to call `build()` unchanged

### Expanded system prompt
The new role definition includes specific responsibilities (explain strategies, backtest results, metrics, concepts) and hard constraints (never fabricate, never guarantee, never trade, always cite data).

### Context rendering
The domain label mapping still reads keys `market`, `strategy`, `backtest`, `metrics`, `portfolio` from the v2 context dict. The `user` and `metadata` keys are ignored (they're not in the label map), which is correct — user context is consumed by `_build_user_prompt()` instead.

---

## 3. Potential Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `build()` mutates caller's context dict by injecting `user.message` | Low | The injected key overwrites any existing `message`; caller owns the dict and can discard after prompt construction |
| Prompt structure change may affect mock provider response parsing | Low | `MockLLMProvider` ignores the prompt entirely (returns static JSON) |
| Section headers use `=` separator instead of `###` markdown | Low | No code depends on exact header format; readability improvement |

---

## 4. Tests Performed

| # | Test | Result |
|---|---|---|
| 1 | `build_prompt()` with no context — all 4 sections present | Pass |
| 2 | `build_prompt(context)` — user query + context domain sections rendered | Pass |
| 3 | `build_prompt(populated context)` — actual data values rendered | Pass |
| 4 | Legacy `build(user_query)` — works without context dict | Pass |
| 5 | Legacy `build(user_query, context)` — works with context dict | Pass |
| 6 | Full pipeline via `AIService.generate_response()` — v2 prompt produced end-to-end | Pass |

---

## 5. Suggested Git Commit Message

```
feat(ai): upgrade prompt builder to v2 with private builder methods

- Refactor into _build_role, _build_system_prompt, _build_context,
  _build_output_rules, _build_user_prompt private methods
- Add build_prompt(context) as the primary public API
- Expand system prompt with role, responsibilities, and constraints
- Add output rules section for response formatting guidance
- Preserve build() as backward-compatible legacy wrapper
- Consume ContextBuilder v2 output; handle missing context gracefully
```
