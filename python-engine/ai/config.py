"""AI Configuration Module.

This module provides the AIConfig dataclass and AIConfigurationManager class
for managing AI Copilot settings.
"""

import os
from dataclasses import dataclass, field

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

DEFAULT_GEMINI_MODEL = "gemini-3.6-flash"
DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com"


@dataclass
class AIConfig:
    """Dataclass holding configuration parameters for AI Copilot."""

    model: str = "qwen2.5-coder-1.5b-instruct"
    temperature: float = 0.2
    max_tokens: int = 1024
    timeout_seconds: int = 30  # reserved; providers use their own internal timeouts
    openai_compatible_base_url: str = "http://localhost:1234"
    openai_compatible_api_key: str = "not-needed"
    gemini_api_key: str = field(
        default_factory=lambda: os.getenv("GEMINI_API_KEY", ""),
    )
    gemini_model: str = field(
        default_factory=lambda: os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL),
    )
    gemini_base_url: str = field(
        default_factory=lambda: os.getenv("GEMINI_BASE_URL", DEFAULT_GEMINI_BASE_URL),
    )


class AIConfigurationManager:
    """Manages reading, updating, and validating AI configuration settings."""

    def __init__(self, config: AIConfig | None = None) -> None:
        """Initializes the AIConfigurationManager instance.

        Args:
            config: Optional AIConfig instance. If None, uses default settings.
        """
        self._config = config or AIConfig()

    def get_config(self) -> AIConfig:
        """Returns the current AIConfig instance.

        Returns:
            Current AIConfig object.
        """
        return self._config

    def set_temperature(self, value: float) -> None:
        """Sets the sampling temperature for LLM generation.

        Args:
            value: Float temperature between 0.0 and 2.0.

        Raises:
            ValueError: If temperature is not within [0.0, 2.0].
        """
        if not (0.0 <= value <= 2.0):
            raise ValueError(f"Temperature must be between 0.0 and 2.0. Got: {value}")
        self._config.temperature = float(value)

    def set_max_tokens(self, value: int) -> None:
        """Sets the maximum tokens limit for LLM generation.

        Args:
            value: Integer token count greater than 0.

        Raises:
            ValueError: If value is less than or equal to 0.
        """
        if value <= 0:
            raise ValueError(f"max_tokens must be greater than 0. Got: {value}")
        self._config.max_tokens = int(value)

    def reset_defaults(self) -> None:
        """Resets the configuration parameters back to default values."""
        self._config = AIConfig()
