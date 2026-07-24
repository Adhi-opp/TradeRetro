"""Context Builder Module for AI Copilot.

This module provides the ContextBuilder class responsible for aggregating and
formatting structured context payloads from user data, market data, strategy
settings, backtest executions, quantitative metrics, and portfolio states
before passing them to an LLM provider.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional


class ContextBuilder:
    """Aggregates contextual data into structured payloads for LLM processing."""

    def _create_envelope(
        self,
        source: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Creates a standardized context payload envelope.

        Args:
            source: Name of the data source service or subsystem.
            data: Structured payload dictionary if available.

        Returns:
            A dictionary containing availability flag, source identifier,
            and data payload.
        """
        is_available = data is not None and len(data) > 0
        return {
            "available": is_available,
            "source": source if is_available else None,
            "data": data if is_available else None,
        }

    def _build_user_context(
        self,
        data: Optional[Dict[str, Any]] = None,
        source: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Builds user or session context payload with a stable schema.

        Args:
            data: Optional dict with keys ``message``, ``conversation_id``,
                and/or ``session_id``.
            source: Optional identifier for the user context provider.

        Returns:
            User context dictionary with guaranteed ``message``,
            ``conversation_id``, and ``session_id`` fields.
        """
        if isinstance(data, dict):
            return {
                "message": data.get("message") or "",
                "conversation_id": data.get("conversation_id"),
                "session_id": data.get("session_id"),
            }
        return {
            "message": "",
            "conversation_id": None,
            "session_id": None,
        }

    def _build_market_context(
        self,
        data: Optional[Dict[str, Any]] = None,
        source: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Builds market data context payload.

        Args:
            data: Optional market price series or quotes data.
            source: Optional name of market data provider.

        Returns:
            Structured market context dictionary.
        """
        return self._create_envelope(source=source, data=data)

    def _build_strategy_context(
        self,
        data: Optional[Dict[str, Any]] = None,
        source: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Builds strategy configuration context payload.

        Args:
            data: Optional strategy configuration and parameters.
            source: Optional strategy subsystem identifier.

        Returns:
            Structured strategy context dictionary.
        """
        return self._create_envelope(source=source, data=data)

    def _build_backtest_context(
        self,
        data: Optional[Dict[str, Any]] = None,
        source: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Builds backtest execution context payload.

        Args:
            data: Optional backtest execution trades and equity curve.
            source: Optional backtest engine identifier.

        Returns:
            Structured backtest context dictionary.
        """
        return self._create_envelope(source=source, data=data)

    def _build_metrics_context(
        self,
        data: Optional[Dict[str, Any]] = None,
        source: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Builds quantitative metrics context payload.

        Args:
            data: Optional computed risk and return metrics.
            source: Optional metrics calculation engine identifier.

        Returns:
            Structured metrics context dictionary.
        """
        return self._create_envelope(source=source, data=data)

    def _build_portfolio_context(
        self,
        data: Optional[Dict[str, Any]] = None,
        source: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Builds portfolio state context payload.

        Args:
            data: Optional portfolio positions and cash balance state.
            source: Optional portfolio management subsystem identifier.

        Returns:
            Structured portfolio context dictionary.
        """
        return self._create_envelope(source=source, data=data)

    def _build_metadata(
        self,
        contexts: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Builds metadata describing the assembled context collection.

        Args:
            contexts: The fully assembled context domain dictionary.

        Returns:
            Metadata dictionary with generation timestamp and population summary.
        """
        populated = [
            name for name, ctx in contexts.items()
            if isinstance(ctx, dict) and ctx.get("available")
        ]
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_domains": len(contexts),
            "populated_domains": len(populated),
            "domains_with_data": populated,
        }

    def build_context(
        self,
        user_data: Optional[Dict[str, Any]] = None,
        market_data: Optional[Dict[str, Any]] = None,
        strategy_data: Optional[Dict[str, Any]] = None,
        backtest_data: Optional[Dict[str, Any]] = None,
        metrics_data: Optional[Dict[str, Any]] = None,
        portfolio_data: Optional[Dict[str, Any]] = None,
        sources: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Assembles a unified context dictionary from all available data domains.

        This is the primary entry point for context construction.

        Args:
            user_data: Optional user profile or session data.
            market_data: Optional market context input data.
            strategy_data: Optional strategy context input data.
            backtest_data: Optional backtest context input data.
            metrics_data: Optional metrics context input data.
            portfolio_data: Optional portfolio context input data.
            sources: Optional mapping of domain names to data source identifiers.

        Returns:
            Combined dictionary containing all context domains plus metadata.
        """
        src = sources or {}
        contexts = {
            "user": self._build_user_context(data=user_data, source=src.get("user")),
            "market": self._build_market_context(data=market_data, source=src.get("market")),
            "strategy": self._build_strategy_context(data=strategy_data, source=src.get("strategy")),
            "backtest": self._build_backtest_context(data=backtest_data, source=src.get("backtest")),
            "metrics": self._build_metrics_context(data=metrics_data, source=src.get("metrics")),
            "portfolio": self._build_portfolio_context(data=portfolio_data, source=src.get("portfolio")),
        }
        contexts["metadata"] = self._build_metadata(contexts)
        return contexts

    def build(
        self,
        market_data: Optional[Dict[str, Any]] = None,
        strategy_data: Optional[Dict[str, Any]] = None,
        backtest_data: Optional[Dict[str, Any]] = None,
        metrics_data: Optional[Dict[str, Any]] = None,
        portfolio_data: Optional[Dict[str, Any]] = None,
        sources: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Combines all sub-contexts into a single unified context object.

        Note:
            Legacy compatibility wrapper. New code should call
            :meth:`build_context` instead.

        Args:
            market_data: Optional market context input data.
            strategy_data: Optional strategy context input data.
            backtest_data: Optional backtest context input data.
            metrics_data: Optional metrics context input data.
            portfolio_data: Optional portfolio context input data.
            sources: Optional mapping of domain names to data source identifiers.

        Returns:
            Combined dictionary containing all context domains plus metadata.
        """
        return self.build_context(
            user_data=None,
            market_data=market_data,
            strategy_data=strategy_data,
            backtest_data=backtest_data,
            metrics_data=metrics_data,
            portfolio_data=portfolio_data,
            sources=sources,
        )
