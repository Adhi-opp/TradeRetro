"""Ollama LLM Provider Implementation.

This module provides the OllamaProvider class that calls the local
Ollama HTTP API to generate LLM responses.
"""

import json
import logging
from typing import Optional

import httpx

from ai.providers.base_provider import BaseLLMProvider

logger = logging.getLogger("traderetro.ai.ollama")

DEFAULT_BASE_URL = "http://localhost:11434"
DEFAULT_TIMEOUT = 60


class OllamaProvider(BaseLLMProvider):
    """LLM provider implementation that calls a local Ollama instance."""

    def __init__(
        self,
        model: str = "llama3.2",
        base_url: str = DEFAULT_BASE_URL,
        timeout_seconds: int = DEFAULT_TIMEOUT,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> None:
        """Initializes the OllamaProvider.

        Args:
            model: The Ollama model name to use (default ``"llama3.2"``).
            base_url: Base URL of the Ollama HTTP API.
            timeout_seconds: Request timeout in seconds.
            temperature: Sampling temperature forwarded via ``options``.
                ``None`` (default) omits the option.
            max_tokens: Maximum tokens forwarded via ``options.num_predict``.
                ``None`` (default) omits the option.
        """
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout_seconds
        self.temperature = temperature
        self.max_tokens = max_tokens

    def generate_response(self, prompt: str) -> str:
        """Generates a response via the local Ollama API.

        Args:
            prompt: The formatted prompt string.

        Returns:
            A JSON string containing the provider response.
        """
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }
        options = {}
        if self.temperature is not None:
            options["temperature"] = self.temperature
        if self.max_tokens is not None:
            options["num_predict"] = self.max_tokens
        if options:
            payload["options"] = options

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(url, json=payload)

            if resp.status_code == 404:
                return json.dumps({
                    "provider": "ollama",
                    "model": self.model,
                    "success": False,
                    "error": f"Model '{self.model}' not found. Pull it with: ollama pull {self.model}",
                    "response": None,
                })

            resp.raise_for_status()
            data = resp.json()
            response_text = (data.get("response") or "").strip()

            if not response_text:
                return json.dumps({
                    "provider": "ollama",
                    "model": self.model,
                    "success": False,
                    "error": "Ollama returned an empty response",
                    "response": None,
                })

            return json.dumps({
                "provider": "ollama",
                "model": self.model,
                "success": True,
                "response": response_text,
                "tokens_used": None,
            })

        except httpx.ConnectError:
            return json.dumps({
                "provider": "ollama",
                "model": self.model,
                "success": False,
                "error": f"Cannot connect to Ollama at {self.base_url}. Is Ollama running?",
                "response": None,
            })

        except httpx.TimeoutException:
            return json.dumps({
                "provider": "ollama",
                "model": self.model,
                "success": False,
                "error": f"Ollama request timed out after {self.timeout}s",
                "response": None,
            })

        except Exception as exc:
            logger.error(f"OllamaProvider error: {exc}", exc_info=True)
            return json.dumps({
                "provider": "ollama",
                "model": self.model,
                "success": False,
                "error": str(exc),
                "response": None,
            })
