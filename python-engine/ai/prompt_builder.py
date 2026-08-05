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

    def _build_quantitative_analysis_rules(self) -> str:
        """Returns the reasoning principles for quantitative interpretation.

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