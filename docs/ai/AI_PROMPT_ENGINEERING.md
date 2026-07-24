# AI Prompt Engineering

The `PromptBuilder` class in `python-engine/ai/prompt_builder.py` constructs all prompts sent to the LLM. The prompt follows a fixed four-section structure with consistent delimiters.

## Prompt Structure

Each prompt is assembled from four sections separated by `=` dividers (60 characters):

```
============================================================
SYSTEM INSTRUCTION
============================================================
[Persona definition + behavioral rules]

============================================================
CONTEXT DATA
============================================================
[Market Data] (Source: ...)
{...}

[Strategy Configuration] (Source: ...)
{...}

[Backtest Execution]
Data Not Available

...

============================================================
OUTPUT RULES
============================================================
[Formatting + citation + safety rules]

============================================================
USER QUESTION
============================================================
[User's actual query]
```

## System Prompt (Persona)

The system prompt defines the AI as "TradeRetro AI Copilot, an automated quantitative trading assistant."

**Responsibilities:**
- Explain trading strategies and configurations
- Explain backtest results including equity curves and trade logs
- Explain trading metrics such as Sharpe ratio, drawdown, and win rate
- Help users understand trading concepts in clear, simple terms

**Mandatory restrictions:**
- Never fabricate results or data
- Never provide financial guarantees or investment advice
- Never execute trades or modify trading systems
- Always base answers on provided context data
- If data is unavailable, state that clearly instead of guessing

## Context Rendering

The context section renders each of the 5 primary domains (market, strategy, backtest, metrics, portfolio) as labelled blocks:

```
[Domain Label] (Source: SourceName)
{data_dictionary}
```

If a domain has no data, it renders as:

```
[Domain Label]
Data Not Available
```

This approach was chosen over omitting empty domains because:
1. The prompt structure remains fixed, so the LLM learns a consistent format
2. The LLM can explicitly see that certain data was not provided, reducing hallucination risk
3. Output rules instruct the model to state when information is missing

## Output Rules

The output rules section reinforces formatting and safety:

- Respond in clear, concise language
- Use markdown formatting for readability
- Cite data sources when available
- If information is missing, state it explicitly
- Do not speculate beyond the provided data
- Keep responses focused on the user's question

## Safety Design

Safety is enforced at the prompt level (not via model fine-tuning):

| Risk | Mitigation |
|---|---|
| Fabrication | "Never fabricate results or data" + "Always base answers on provided context data" |
| Hallucination | "If data is unavailable, state that clearly" + "Do not speculate beyond the provided data" |
| Financial advice | "Never provide financial guarantees or investment advice" |
| Unauthorized actions | "Never execute trades or modify trading systems" |
| Missing citations | "Cite data sources when available" |

Prompt-level safety was chosen over model-level fine-tuning because Qwen2.5-Coder-1.5B is a general-purpose code model, not a safety-tuned chat model. Explicit instructions in the system prompt are the most reliable constraint mechanism for locally hosted models.

## Hallucination Reduction

Three techniques are used:

1. **Context gating** — The prompt explicitly marks unavailable domains as "Data Not Available", so the LLM knows the absence of information is real, not just missing from context
2. **Source attribution** — Each domain includes a `(Source: ...)` label, conditioning the LLM to reference where data came from
3. **Behavioral constraints** — "Never fabricate results", "If information is missing, state it explicitly", "Do not speculate beyond the provided data"

## Temperature Selection

`temperature = 0.2` (low) is the default:

- **Why low?** Trading analysis requires precision, consistency, and factual accuracy — not creative writing. Low temperature reduces the probability of hallucination and produces more deterministic outputs.
- **Range allowed:** 0.0–2.0, validated by `AIConfigurationManager.set_temperature()`.

## Prompt Flow

```
                    ┌──────────────┐
                    │  User Query  │
                    │  + Domain    │
                    │  Data        │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ ContextBuilder│
                    │  .build()    │
                    │              │
                    │  → context    │
                    │    dict with  │
                    │    6 domains  │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ PromptBuilder │
                    │               │
                    │ 1. System     │
                    │    Instruction│
                    │ 2. Context    │
                    │    Data       │
                    │ 3. Output     │
                    │    Rules      │
                    │ 4. User       │
                    │    Question   │
                    │               │
                    │  → full       │
                    │    prompt str │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    LLM       │
                    │  Provider    │
                    └──────────────┘
```

## Example Generated Prompt

```text
============================================================
SYSTEM INSTRUCTION
============================================================
You are TradeRetro AI Copilot, an automated quantitative trading assistant.

Your responsibilities:
- Explain trading strategies and their configurations
- Explain backtest results including equity curves and trade logs
- Explain trading metrics such as Sharpe ratio, drawdown, and win rate
- Help users understand trading concepts in clear, simple terms

You must follow these rules:
- Never fabricate results or data
- Never provide financial guarantees or investment advice
- Never execute trades or modify trading systems
- Always base your answers on the provided context data
- If data is unavailable, state that clearly instead of guessing

============================================================
CONTEXT DATA
============================================================
[Market Data] (Source: yahoo-finance)
{'symbol': 'RELIANCE.NS', 'close': 2850.0, 'volume': 12500000}

[Strategy Configuration]
Data Not Available

[Backtest Execution]
Data Not Available

[Quantitative Metrics] (Source: backtest-engine)
{'sharpe_ratio': 1.82, 'max_drawdown': -0.08, 'win_rate': 0.65}

[Portfolio State]
Data Not Available

============================================================
OUTPUT RULES
============================================================
- Respond in clear, concise language
- Use markdown formatting for readability
- Cite data sources when available
- If information is missing, state it explicitly
- Do not speculate beyond the provided data
- Keep responses focused on the user's question

============================================================
USER QUESTION
============================================================
What was the Sharpe ratio of the last backtest?
```

## Compatibility Wrapper

`PromptBuilder.build(user_query, context)` injects the query into the context's `user.message` field then calls `build_prompt(context)`. Prefer `build_prompt(context)` directly with a fully populated context dict.
