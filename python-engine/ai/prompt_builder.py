"""Prompt Builder Module for AI Copilot.

This module provides the PromptBuilder class responsible for constructing
structured prompt strings combining system persona instructions, contextual
market/backtest datasets, and user queries for LLM consumption.
"""

from typing import Any, Dict, Optional


class PromptBuilder:
    """Constructs prompt strings for LLM models by assembling system instructions, context, and user queries."""

    def build_system_prompt(self) -> str:
        """Returns the permanent TradeRetro AI system instruction prompt.

        Returns:
            The system persona and behavioral instruction string.
        """
        return (
            "You are TradeRetro AI, an elite Quantitative Trading & Risk Analyst Copilot.\n"
            "Your role is to assist traders and quantitative researchers by analyzing market data,\n"
            "evaluating strategy configurations, interpreting backtest performance metrics, and assessing portfolio risk.\n"
            "Provide objective, data-driven analysis with precise financial reasoning."
        )

    def build_user_prompt(self, user_query: str) -> str:
        """Formats the raw user question or prompt query.

        Args:
            user_query: The raw query string submitted by the user.

        Returns:
            Formatted user query section string.
        """
        query_text = user_query.strip() if user_query else "No user query provided."
        return f"### USER QUERY\n{query_text}"

    def build_context_prompt(self, context: Optional[Dict[str, Any]]) -> str:
        """Converts the ContextBuilder output dictionary into readable markdown sections.

        Args:
            context: A context dictionary output by ContextBuilder containing market,
                strategy, backtest, metrics, and portfolio payloads.

        Returns:
            Formatted readable context section string.
        """
        if not context or not isinstance(context, dict):
            return "### CONTEXT\nNo contextual data available."

        sections = ["### CONTEXT"]
        
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
                sections.append(f"#### [{label}] (Source: {source})\n{data}")
            else:
                sections.append(f"#### [{label}]\nData Not Available")

        return "\n\n".join(sections)

    def build(self, user_query: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Combines system prompt, context prompt, and user prompt into a single prompt string.

        Args:
            user_query: The raw query string submitted by the user.
            context: Optional context dictionary produced by ContextBuilder.

        Returns:
            Complete assembled prompt string ready for LLM inference.
        """
        system_section = f"### SYSTEM INSTRUCTION\n{self.build_system_prompt()}"
        context_section = self.build_context_prompt(context)
        user_section = self.build_user_prompt(user_query)

        return f"{system_section}\n\n{context_section}\n\n{user_section}"

