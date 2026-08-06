"""Report Registry Module for AI Copilot.

Declarative specification for AI-generated backtest reports. This module
is the canonical source of truth for the report's section structure,
binding rules, missing-data guidance, and output style.

It contains configuration only: it performs no prompt generation, makes
no LLM calls, and runs no business logic. Consumers (starting with the
Prompt Builder in a later milestone) read from this registry rather than
embedding report structure in code.
"""

from dataclasses import dataclass
from typing import Dict, Tuple


@dataclass(frozen=True)
class ReportSection:
    """Metadata for a single section of the generated backtest report.

    Attributes:
        order: 1-based position of the section in the canonical report order.
        key: Stable machine-readable identifier for the section.
        title: Human-readable section title.
        purpose: Intended contribution of the section to the report.
        required: Whether the section must always appear in the report.
        description: Concise definition of the section's expected content.
    """

    order: int
    key: str
    title: str
    purpose: str
    required: bool
    description: str


REPORT_SECTIONS: Tuple[ReportSection, ...] = (
    ReportSection(
        order=1,
        key="executive_summary",
        title="Executive Summary",
        purpose="Convey the headline outcome and the most important takeaways at a glance.",
        required=True,
        description="Concise overview of the strategy outcome and its key findings.",
    ),
    ReportSection(
        order=2,
        key="strategy_overview",
        title="Strategy Overview",
        purpose="Establish exactly what was evaluated and how it was configured.",
        required=True,
        description="Describes the strategy type, configuration, and evaluation period.",
    ),
    ReportSection(
        order=3,
        key="performance_overview",
        title="Performance Overview",
        purpose="Present observed performance precisely and without embellishment.",
        required=True,
        description="Summary of returns, trading activity, and risk-adjusted performance.",
    ),
    ReportSection(
        order=4,
        key="risk_analysis",
        title="Risk Analysis",
        purpose="Surface the risk profile and drawdown behaviour.",
        required=True,
        description="Assessment of drawdown, volatility, and downside exposure.",
    ),
    ReportSection(
        order=5,
        key="metric_interpretation",
        title="Metric Interpretation",
        purpose="Explain each observable metric individually against the context.",
        required=True,
        description="Interpretation of each metric that is present in the supplied context.",
    ),
    ReportSection(
        order=6,
        key="cross_metric_analysis",
        title="Cross-Metric Analysis",
        purpose="Explain how the metrics relate to one another.",
        required=True,
        description="Synthesis of metric combinations, consistency, and trade-offs.",
    ),
    ReportSection(
        order=7,
        key="strengths",
        title="Strengths",
        purpose="Present the strategy's context-supported strengths.",
        required=True,
        description="Strengths that follow directly from the supplied evidence.",
    ),
    ReportSection(
        order=8,
        key="weaknesses",
        title="Weaknesses",
        purpose="Present the strategy's context-supported weaknesses.",
        required=True,
        description="Weaknesses and unfavourable patterns indicated by the supplied evidence.",
    ),
    ReportSection(
        order=9,
        key="market_suitability",
        title="Market Suitability",
        purpose="Describe the market conditions in which the strategy fits.",
        required=True,
        description="Assessment of regimes or asset behaviour suited to the strategy.",
    ),
    ReportSection(
        order=10,
        key="limitations",
        title="Limitations",
        purpose="State the boundaries of any conclusions drawn.",
        required=True,
        description="Confidence limits and constraints caused by missing or sparse data.",
    ),
    ReportSection(
        order=11,
        key="recommendations",
        title="Recommendations",
        purpose="Provide follow-up suggestions that the context supports.",
        required=True,
        description="Recommendations that rely strictly on the supplied context.",
    ),
    ReportSection(
        order=12,
        key="conclusion",
        title="Conclusion",
        purpose="Synthesize the report into a final coherent statement.",
        required=True,
        description="Final synthesis of the analysis and its key takeaways.",
    ),
)


@dataclass(frozen=True)
class ReportRule:
    """A binding rule every generated report must follow.

    Attributes:
        id: Stable machine-readable identifier for the rule.
        directive: Imperative statement of the rule.
    """

    id: str
    directive: str


REPORT_RULES: Tuple[ReportRule, ...] = (
    ReportRule("no_invented_metrics", "Never invent metrics."),
    ReportRule("no_invented_strategy_parameters", "Never invent strategy parameters."),
    ReportRule("no_inferred_values", "Never infer values not present in context."),
    ReportRule("no_fabricated_benchmark", "Never fabricate benchmark performance."),
    ReportRule("use_only_injected_context", "Use only injected context."),
    ReportRule("state_unavailable_information", "Clearly state when information is unavailable."),
    ReportRule("preserve_numerical_precision", "Preserve numerical precision."),
    ReportRule("avoid_contradictory_statements", "Avoid contradictory statements."),
)


METRIC_NOT_AVAILABLE_MSG = "Metric not available in supplied context."
BENCHMARK_NOT_AVAILABLE_MSG = "Benchmark comparison unavailable."
INSUFFICIENT_TRADES_MSG = "Insufficient trade count; statistical confidence is limited."

MISSING_DATA_POLICY: Dict[str, str] = {
    "metric": METRIC_NOT_AVAILABLE_MSG,
    "benchmark": BENCHMARK_NOT_AVAILABLE_MSG,
    "insufficient_trades": INSUFFICIENT_TRADES_MSG,
}


@dataclass(frozen=True)
class ReportStyle:
    """Declarative style configuration for generated reports.

    Attributes:
        tone: Register required for all report language.
        institutional: Whether the output must follow institutional style.
        reasoning: Reasoning standard applied to every statement.
        headings: Heading verbosity requirement.
        formatting: Markup language for report output.
        emojis: Whether emoji characters are permitted.
        language: Determinism requirement for phrasing.
    """

    tone: str = "professional"
    institutional: bool = True
    reasoning: str = "evidence-based"
    headings: str = "concise"
    formatting: str = "markdown"
    emojis: bool = False
    language: str = "deterministic"


REPORT_STYLE: ReportStyle = ReportStyle()