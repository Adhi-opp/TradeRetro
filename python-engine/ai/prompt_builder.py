"""Prompt Builder Module for AI Copilot.

This module provides the PromptBuilder class responsible for constructing
structured prompt strings combining system persona instructions, contextual
market/backtest datasets, and user queries for LLM consumption.

The prompt is organized into clearly separated logical sections:

1. System Identity
2. Core Behaviour Rules
3. Quantitative Analysis Rules
4. Reasoning Framework
5. Formatting Rules
6. Injected Context
7. User Question

Each section is assembled by a dedicated helper method so the structure
stays easy to extend in future milestones.
"""

import copy
from typing import Any, Dict, Optional


class PromptBuilder:
    """Constructs prompt strings for LLM models by assembling system
    instructions, context, and user queries."""

    SECTION_HEADING = "=" * 60

    # ── Section Assembly ────────────────────────────────────────

    def _section(self, title: str, body: str) -> str:
        """Wraps section content with a labelled heading and ``=`` rulers.

        Args:
            title: Uppercase heading label for the section.
            body: Section content body.

        Returns:
            Fully delimited section string.
        """
        return (
            f"{self.SECTION_HEADING}\n"
            f"{title}\n"
            f"{self.SECTION_HEADING}\n"
            f"{body}"
        )

    # ── Section 1: System Identity ──────────────────────────────

    def _build_system_identity(self) -> str:
        """Returns the assistant identity and specialization block.

        Returns:
            The identity statement, specialization, and role boundaries.
        """
        return (
            "You are TradeRetro AI, a professional quantitative trading assistant.\n"
            "\n"
            "Your specialization:\n"
            "- Historical strategy analysis\n"
            "- Backtest interpretation\n"
            "- Trading metrics\n"
            "- Quantitative reasoning\n"
            "- Risk analysis\n"
            "\n"
            "You are NOT:\n"
            "- A financial advisor\n"
            "- A market predictor\n"
            "- A portfolio manager\n"
            "\n"
            "You analyse historical results only."
        )

    # ── Section 2: Core Behaviour Rules ─────────────────────────

    def _build_core_behaviour_rules(self) -> str:
        """Returns the non-negotiable behaviour constraints block.

        Returns:
            The hard safety and integrity rules for the prompt.
        """
        return (
            "You must never:\n"
            "- Invent metrics\n"
            "- Fabricate strategy parameters\n"
            "- Hallucinate trades\n"
            "- Assume missing context\n"
            "- Predict future prices\n"
            "- Recommend buying or selling securities\n"
            "- Claim certainty when context is incomplete\n"
            "\n"
            "If required information is missing, explicitly state the limitation."
        )

    # ── Section 3: Quantitative Analysis Rules ──────────────────

    # Per-metric interpretation guidance. Each entry is a (name, guidance)
    # pair teaching the model how to reason about that metric. Guidance is
    # qualitative on purpose: no rigid thresholds and no canned answers.
    # Extend this registry with a new entry when a future milestone adds
    # another metric.
    METRIC_INTERPRETATION_GUIDES = (
        (
            "Net Profit",
            (
                "- The absolute profit or loss earned over the backtest period\n"
                "- Always interpret alongside drawdown, volatility, and capital deployed\n"
                "- A large profit achieved through deep drawdown is lower quality than "
                "a smaller profit earned with shallow drawdown\n"
                "- Consider how the profit was earned: steady accumulation versus a few large winners"
            ),
        ),
        (
            "Total Return",
            (
                "- The overall gain or loss relative to starting capital\n"
                "- Interpret it relative to the length of the backtest period and the risk taken\n"
                "- A high total return with deep drawdown or high volatility is weaker than "
                "a comparable return achieved smoothly\n"
                "- Returns across different periods or market regimes should not be compared directly"
            ),
        ),
        (
            "Maximum Drawdown",
            (
                "- Shallow drawdown: resilient equity, lower tail risk; attractive if returns remain adequate\n"
                "- Moderate drawdown: generally within expectations for the asset class; acceptable if recovery is timely\n"
                "- Severe drawdown: elevated tail risk or weak risk control; scrutinize whether the returns justify the decline\n"
                "- Always interpret drawdown relative to returns — the reward must be weighed against the depth of decline\n"
                "- Consider how quickly the curve recovered from the peak-to-trough decline"
            ),
        ),
        (
            "Sharpe Ratio",
            (
                "- Measures return earned per unit of total volatility\n"
                "- High: strong compensation for the level of risk borne\n"
                "- Moderate: reasonable return per unit of risk, often typical of diversified strategies\n"
                "- Low: the return does not clearly compensate for the risk taken\n"
                "- Negative: returns fell short of the risk-free baseline\n"
                "- Treat values qualitatively and avoid rigid thresholds\n"
                "- A value based on very few trades is not statistically meaningful"
            ),
        ),
        (
            "Sortino Ratio",
            (
                "- Measures return per unit of downside deviation only\n"
                "- Higher values indicate returns achieved without excessive downside exposure\n"
                "- Compare it with the Sharpe ratio: a large gap between the two signals "
                "asymmetric downside risk, where returns rely on favourable volatility"
            ),
        ),
        (
            "Win Rate",
            (
                "- The share of trades that ended profitably\n"
                "- A high win rate alone does not imply profitability\n"
                "- A low win rate can still be profitable when average winners outweigh average losers\n"
                "- Interpret together with average trade, profit factor, and the average winner versus average loser size"
            ),
        ),
        (
            "Profit Factor",
            (
                "- Gross profit divided by gross loss\n"
                "- Above a value of 1 the strategy profits in aggregate; below 1 it loses\n"
                "- Higher values point to a stronger edge\n"
                "- Interpret with trade count: a high value built on very few trades is unreliable\n"
                "- Check consistency — an edge concentrated in a few outsized winners is fragile"
            ),
        ),
        (
            "Trade Count",
            (
                "- Few trades: lower statistical confidence; the results may reflect noise or luck\n"
                "- Many trades: greater confidence in the statistics, but watch for overtrading, "
                "overfitting and dependence on a single market regime\n"
                "- Judge the activity level relative to the strategy type and the length of the backtest period"
            ),
        ),
        (
            "Average Trade",
            (
                "- The mean profit or loss per trade\n"
                "- A positive average trade across many trades suggests a durable edge\n"
                "- An average trade that is small relative to the risk taken per trade indicates "
                "a marginal edge that is sensitive to transaction costs\n"
                "- Interpret it alongside the trade count and win rate"
            ),
        ),
        (
            "Average Hold Period",
            (
                "- The typical length of time a position is held\n"
                "- Short holds: the strategy is sensitive to transaction costs, slippage and execution quality\n"
                "- Long holds: the strategy is exposed to longer-term regime shifts and gap risk\n"
                "- Interpret it relative to the strategy type and volatility, never in isolation"
            ),
        ),
        (
            "Volatility",
            (
                "- The dispersion of period-to-period returns\n"
                "- High volatility: wider swings, deeper potential drawdowns and greater uncertainty\n"
                "- Low volatility: steadier equity growth with less stress\n"
                "- Volatility is not good or bad by itself — weigh it against the returns it produces "
                "and the ratio of return to volatility\n"
                "- Consider whether volatility is consistent over time or clustered into specific episodes"
            ),
        ),
        (
            "Risk vs Return",
            (
                "- The central trade-off in evaluating any strategy\n"
                "- Judge returns only against the risk required to earn them: drawdown depth, "
                "volatility and risk-adjusted ratios\n"
                "- A strategy is attractive only when the return justifies the risk borne\n"
                "- Never present return figures without their risk context"
            ),
        ),
        (
            "Equity Curve",
            (
                "- Smooth growth: suggests a consistent edge, low stress and dependable compounding\n"
                "- Volatile growth: strong overall results but uneven; monitor prolonged drawdown episodes\n"
                "- Prolonged stagnation: the edge may be fading or the market regime may have shifted\n"
                "- Sharp recoveries: indicative of resilience after drawdown, but check whether the "
                "recovery relies on a few large winners\n"
                "- Persistent decline: the edge may have broken or the regime is unsuitable; caution is warranted"
            ),
        ),
    )

    @staticmethod
    def _render_metric_guide(name: str, guidance: str) -> str:
        """Renders a single metric interpretation guide block.

        Args:
            name: Display name of the metric.
            guidance: Qualitative interpretation guidance lines.

        Returns:
            A single formatted guide block.
        """
        return f"{name}\n{guidance}"

    @classmethod
    def _build_metric_guides(cls) -> str:
        """Renders all registered metric interpretation guide blocks.

        Returns:
            Newline-joined blocks, one per registered metric.
        """
        blocks = [cls._render_metric_guide(name, guide)
                  for name, guide in cls.METRIC_INTERPRETATION_GUIDES]
        return "\n\n".join(blocks)

    def _build_quantitative_analysis_rules(self) -> str:
        """Returns the reasoning principles and metric interpretation
        guidance for quantitative analysis.

        Returns:
            Principles describing how the assistant should reason about
            metrics rather than hardcoded output templates.
        """
        return (
            "Reason from the relationships between metrics.\n"
            "Avoid discussing isolated numbers without interpretation.\n"
            "\n"
            "Interpretation principles:\n"
            "- Assess profitability relative to drawdown, not in isolation\n"
            "- Assess Sharpe ratio relative to volatility, not in isolation\n"
            "- Assess win rate relative to profitability, not in isolation\n"
            "- Assess trade count relative to statistical confidence, not in isolation\n"
            "\n"
            "Metric interpretation guidance:\n"
            "\n"
            f"{self._build_metric_guides()}\n"
            "\n"
            "Only interpret metrics that are actually present in the injected context. "
            "If a metric is absent, ignore it and move on — never assume, require, or infer it.\n"
            "\n"
            "Never hardcode responses. Draw conclusions from the specific "
            "values present in the injected context."
        )

    # ── Section 4: Reasoning Framework ──────────────────────────

    def _build_reasoning_framework(self) -> str:
        """Returns the recommended response flow structure.

        Returns:
            The ordered reasoning framework the assistant should follow.
        """
        return (
            "Unless the user's question requires a different format, structure "
            "your response as follows:\n"
            "\n"
            "1. Summary\n"
            "2. Observations\n"
            "3. Interpretation\n"
            "4. Risk Assessment\n"
            "5. Strengths\n"
            "6. Weaknesses\n"
            "7. Suggestions\n"
            "8. Limitations\n"
            "\n"
            "Adapt naturally: omit or simplify sections that are irrelevant "
            "to the user's question."
        )

    # ── Section 5: Formatting Rules ─────────────────────────────

    def _build_formatting_rules(self) -> str:
        """Returns the response formatting and style rules.

        Returns:
            The output formatting rules for the prompt.
        """
        return (
            "- Use markdown formatting\n"
            "- Use headings to organize your response\n"
            "- Use bullet lists where appropriate\n"
            "- Avoid large paragraphs\n"
            "- Avoid repeating metric values unnecessarily\n"
            "- Remain concise\n"
            "- Maintain professional engineering documentation quality\n"
            "- Cite data sources when available\n"
            "- Keep responses focused on the user's question"
        )

    # ── Section 6: Injected Context ─────────────────────────────

    def _build_context(self, context: Optional[Dict[str, Any]]) -> str:
        """Renders the ContextBuilder output into readable markdown sections.

        Args:
            context: A context dictionary produced by ContextBuilder v2
                containing user, market, strategy, backtest, metrics,
                portfolio, and metadata domains.

        Returns:
            Formatted context data body (without the section heading).
        """
        if not isinstance(context, dict):
            return "No contextual data available."

        sections = []

        domain_labels = {
            "market": "Market Data",
            "strategy": "Strategy Configuration",
            "backtest": "Backtest Execution",
            "metrics": "Quantitative Metrics",
            "portfolio": "Portfolio State",
        }

        for key, label in domain_labels.items():
            payload = context.get(key)
            if isinstance(payload, dict) and payload.get("available"):
                source = payload.get("source", "Unknown Source")
                data = payload.get("data")
                sections.append(f"[{label}] (Source: {source})")
                sections.append(f"{data}")
            else:
                sections.append(f"[{label}]")
                sections.append("Data Not Available")
            sections.append("")

        return "\n".join(sections).rstrip()

    # ── Section 7: User Question ────────────────────────────────

    def _build_user_prompt(self, context: Optional[Dict[str, Any]]) -> str:
        """Extracts and formats the user query from the context dict.

        Args:
            context: Context dict containing a ``user`` domain with a
                ``message`` field.

        Returns:
            Formatted user query string (without the section heading).
        """
        user_query = None
        if isinstance(context, dict):
            user_context = context.get("user")
            if isinstance(user_context, dict):
                user_query = user_context.get("message")

        query_text = (user_query or "").strip()
        if not query_text:
            query_text = "No user query provided."

        return query_text

    # ── Public API ──────────────────────────────────────────────

    def build_prompt(self, context: Optional[Dict[str, Any]] = None) -> str:
        """Assembles a complete prompt string from the seven logical
        prompt sections: system identity, core behaviour rules,
        quantitative analysis rules, reasoning framework, formatting
        rules, injected context, and user question.

        This is the primary entry point for prompt construction.

        Args:
            context: A context dictionary produced by ContextBuilder v2.
                May be None or empty; missing fields are handled gracefully.

        Returns:
            Complete assembled prompt string ready for LLM inference.
        """
        parts = [
            self._section("SYSTEM IDENTITY", self._build_system_identity()),
            "",
            self._section("CORE BEHAVIOUR RULES", self._build_core_behaviour_rules()),
            "",
            self._section(
                "QUANTITATIVE ANALYSIS RULES",
                self._build_quantitative_analysis_rules(),
            ),
            "",
            self._section("REASONING FRAMEWORK", self._build_reasoning_framework()),
            "",
            self._section("FORMATTING RULES", self._build_formatting_rules()),
            "",
            self._section("CONTEXT DATA", self._build_context(context)),
            "",
            self._section("USER QUESTION", self._build_user_prompt(context)),
        ]
        return "\n".join(parts)

    # ── Legacy API ──────────────────────────────────────────────

    def build(self, user_query: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Combines system prompt, context, and user query into a single prompt string.

        Note:
            Legacy compatibility wrapper. New code should call
            :meth:`build_prompt` instead.

        Args:
            user_query: The raw query string submitted by the user.
            context: Optional context dictionary produced by ContextBuilder.

        Returns:
            Complete assembled prompt string ready for LLM inference.
        """
        ctx = copy.deepcopy(context) if isinstance(context, dict) else {}
        ctx.setdefault("user", {})["message"] = user_query
        return self.build_prompt(ctx)