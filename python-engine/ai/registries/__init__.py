"""AI Registries Package
=======================
Contains declarative registry modules used as configuration sources of truth.
"""

from ai.registries.report_registry import (
    BENCHMARK_NOT_AVAILABLE_MSG,
    INSUFFICIENT_TRADES_MSG,
    METRIC_NOT_AVAILABLE_MSG,
    MISSING_DATA_POLICY,
    REPORT_RULES,
    REPORT_SECTIONS,
    REPORT_STYLE,
    STRATEGY_PARAMETERS_NOT_AVAILABLE_MSG,
    ReportRule,
    ReportSection,
    ReportStyle,
)

__all__ = [
    "REPORT_SECTIONS",
    "REPORT_RULES",
    "MISSING_DATA_POLICY",
    "REPORT_STYLE",
    "METRIC_NOT_AVAILABLE_MSG",
    "BENCHMARK_NOT_AVAILABLE_MSG",
    "INSUFFICIENT_TRADES_MSG",
    "STRATEGY_PARAMETERS_NOT_AVAILABLE_MSG",
    "ReportSection",
    "ReportRule",
    "ReportStyle",
]