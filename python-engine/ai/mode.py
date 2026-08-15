"""AI Analysis Mode Enum.

Defines the supported analysis modes for the AI Copilot pipeline.
"""

from enum import Enum


class AnalysisMode(Enum):
    """Supported AI Copilot analysis modes.

    Values:
        CHAT: Interactive chat prompt pipeline (default, backward compatible).
        REPORT: Structured report-mode pipeline (infrastructure only; report
            prompting is implemented in a later milestone).
    """

    CHAT = "chat"
    REPORT = "report"