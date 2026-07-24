"""Prompt Builder Module for AI Copilot.

This module provides the PromptBuilder class responsible for constructing
structured prompt strings combining system persona instructions, contextual
market/backtest datasets, and user queries for LLM consumption.
"""

import copy
from typing import Any, Dict, Optional


class PromptBuilder:
    """Constructs prompt strings for LLM models by assembling system
    instructions, context, and user queries."""

    SECTION_HEADING = "=" * 60

    # ── Private Builders ──────────────────────────────────────────

    def _build_role(self) -> str:
        """Returns the assistant role definition and constraints.

        Returns:
            The role and responsibility block for the prompt.
        """
        return (
            "You are TradeRetro AI Copilot, an automated quantitative trading assistant.\n"
            "\n"
            "Your responsibilities:\n"
            "- Explain trading strategies and their configurations\n"
            "- Explain backtest results including equity curves and trade logs\n"
            "- Explain trading metrics such as Sharpe ratio, drawdown, and win rate\n"
            "- Help users understand trading concepts in clear, simple terms\n"
            "\n"
            "You must follow these rules:\n"
            "- Never fabricate results or data\n"
            "- Never provide financial guarantees or investment advice\n"
            "- Never execute trades or modify trading systems\n"
            "- Always base your answers on the provided context data\n"
            "- If data is unavailable, state that clearly instead of guessing"
        )

    def _build_system_prompt(self) -> str:
        """Returns the full system instruction block.

        Returns:
            The complete system instruction string.
        """
        return (
            f"{self.SECTION_HEADING}\n"
            "SYSTEM INSTRUCTION\n"
            f"{self.SECTION_HEADING}\n"
            f"{self._build_role()}"
        )

    def _build_context(self, context: Optional[Dict[str, Any]]) -> str:
        """Renders the ContextBuilder output into readable markdown sections.

        Args:
            context: A context dictionary produced by ContextBuilder v2
                containing user, market, strategy, backtest, metrics,
                portfolio, and metadata domains.

        Returns:
            Formatted context section string.
        """
        sections = [
            f"{self.SECTION_HEADING}",
            "CONTEXT DATA",
            f"{self.SECTION_HEADING}",
        ]

        if not isinstance(context, dict):
            sections.append("No contextual data available.")
            return "\n".join(sections)

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

    def _build_output_rules(self) -> str:
        """Returns the response formatting rules for the assistant.

        Returns:
            The output rules block for the prompt.
        """
        return (
            f"{self.SECTION_HEADING}\n"
            "OUTPUT RULES\n"
            f"{self.SECTION_HEADING}\n"
            "- Respond in clear, concise language\n"
            "- Use markdown formatting for readability\n"
            "- Cite data sources when available\n"
            "- If information is missing, state it explicitly\n"
            "- Do not speculate beyond the provided data\n"
            "- Keep responses focused on the user's question"
        )

    def _build_user_prompt(self, context: Optional[Dict[str, Any]]) -> str:
        """Extracts and formats the user query from the context dict.

        Args:
            context: Context dict containing a ``user`` domain with a
                ``message`` field.

        Returns:
            Formatted user query section string.
        """
        user_query = None
        if isinstance(context, dict):
            user_context = context.get("user")
            if isinstance(user_context, dict):
                user_query = user_context.get("message")

        query_text = (user_query or "").strip()
        if not query_text:
            query_text = "No user query provided."

        return (
            f"{self.SECTION_HEADING}\n"
            "USER QUESTION\n"
            f"{self.SECTION_HEADING}\n"
            f"{query_text}"
        )

    # ── Public API ────────────────────────────────────────────────

    def build_prompt(self, context: Optional[Dict[str, Any]] = None) -> str:
        """Assembles a complete prompt string from system instruction,
        context data, output rules, and user query.

        This is the primary entry point for prompt construction.

        Args:
            context: A context dictionary produced by ContextBuilder v2.
                May be None or empty; missing fields are handled gracefully.

        Returns:
            Complete assembled prompt string ready for LLM inference.
        """
        parts = [
            self._build_system_prompt(),
            "",
            self._build_context(context),
            "",
            self._build_output_rules(),
            "",
            self._build_user_prompt(context),
        ]
        return "\n".join(parts)

    # ── Legacy API ────────────────────────────────────────────────

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
