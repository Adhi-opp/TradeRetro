"""Base LLM Provider Interface.

This module defines the abstract base class interface that all concrete LLM
provider implementations must extend.
"""

from abc import ABC, abstractmethod


class BaseLLMProvider(ABC):
    """Abstract Base Class for LLM providers."""

    @abstractmethod
    def generate_response(self, prompt: str) -> str:
        """Generates a text response from the LLM provider for the given prompt.

        Args:
            prompt: The formatted prompt string sent to the provider.

        Returns:
            Provider response string.

        Raises:
            NotImplementedError: If a subclass does not implement this method.
        """
        raise NotImplementedError("Subclasses must implement generate_response().")
