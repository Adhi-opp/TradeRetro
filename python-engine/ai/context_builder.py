"""Context Builder Module for AI Copilot.

This module provides the ContextBuilder class responsible for aggregating and
formatting structured context payloads from market data, strategy settings,
backtest executions, quantitative metrics, and portfolio states before passing
them to an LLM provider.
"""

from typing import Any, Dict, Optional


class ContextBuilder:
    """Aggregates contextual data into structured payloads for LLM processing."""

    def _create_placeholder(
        self,
        source: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Creates a standardized context payload container.

        Args:
            source: Name of the data source service or subsystem.
            data: Structured payload dictionary if available.

        Returns:
            A dictionary containing availability flag, source identifier, and data payload.
        """
        is_available = data is not None and len(data) > 0
        return {
            "available": is_available,
            "source": source if is_available else None,
            "data": data if is_available else None,
        }

    def build_market_context(
        self,
        data: Optional[Dict[str, Any]] = None,
        source: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Builds market context payload.

        Args:
            data: Optional market price series or quotes data.
            source: Optional name of market data provider.

        Returns:
            Structured market context dictionary.
        """
        return self._create_placeholder(source=source, data=data)

    def build_strategy_context(
        self,
        data: Optional[Dict[str, Any]] = None,
        source: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Builds strategy context payload.

        Args:
            data: Optional strategy configuration and parameters.
            source: Optional strategy subsystem identifier.

        Returns:
            Structured strategy context dictionary.
        """
        return self._create_placeholder(source=source, data=data)

    def build_backtest_context(
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
        return self._create_placeholder(source=source, data=data)

    def build_metrics_context(
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
        return self._create_placeholder(source=source, data=data)

    def build_portfolio_context(
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
        return self._create_placeholder(source=source, data=data)

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

        Args:
            market_data: Optional market context input data.
            strategy_data: Optional strategy context input data.
            backtest_data: Optional backtest context input data.
            metrics_data: Optional metrics context input data.
            portfolio_data: Optional portfolio context input data.
            sources: Optional dictionary mapping sub-context names to data source identifiers.

        Returns:
            Combined dictionary containing market, strategy, backtest, metrics,
            and portfolio context domains.
        """
        src_map = sources or {}
        return {
            "market": self.build_market_context(data=market_data, source=src_map.get("market")),
            "strategy": self.build_strategy_context(data=strategy_data, source=src_map.get("strategy")),
            "backtest": self.build_backtest_context(data=backtest_data, source=src_map.get("backtest")),
            "metrics": self.build_metrics_context(data=metrics_data, source=src_map.get("metrics")),
            "portfolio": self.build_portfolio_context(data=portfolio_data, source=src_map.get("portfolio")),
        }

