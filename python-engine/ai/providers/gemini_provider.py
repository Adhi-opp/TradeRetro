"""Gemini LLM Provider Implementation.

This module provides the GeminiProvider class that calls Google's
Gemini generateContent REST API (currently targeting the Gemini Flash
model family) to generate LLM responses.
"""

import json
import logging
from typing import Optional

import httpx

from ai.providers.base_provider import BaseLLMProvider

logger = logging.getLogger("traderetro.ai.gemini")

DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com"
DEFAULT_MODEL = "gemini-3.6-flash"
DEFAULT_TIMEOUT = 60


class GeminiProvider(BaseLLMProvider):
    """LLM provider implementation that calls the Gemini generateContent API."""

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        api_key: str = "",
        base_url: str = DEFAULT_BASE_URL,
        timeout_seconds: int = DEFAULT_TIMEOUT,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> None:
        """Initializes the GeminiProvider.

        Args:
            model: Gemini model identifier (default ``"gemini-3.6-flash"``).
            api_key: Google AI Studio API key used for authentication.
            base_url: Base URL of the Gemini API.
            timeout_seconds: Request timeout in seconds.
            temperature: Sampling temperature via ``generationConfig``.
                ``None`` (default) omits the field and lets the API default apply.
            max_tokens: Maximum output tokens via
                ``generationConfig.maxOutputTokens``. ``None`` (default) omits
                the field and lets the API default apply.
        """
        self.model = model
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout_seconds
        self.temperature = temperature
        self.max_tokens = max_tokens

    def generate_response(self, prompt: str) -> str:
        """Generates a response via the Gemini generateContent API.

        Args:
            prompt: The formatted prompt string.

        Returns:
            A JSON string containing the provider response.
        """
        if not self.api_key:
            return self._error("No Gemini API key configured. Set GEMINI_API_KEY and restart the server.")

        url = f"{self.base_url}/v1beta/models/{self.model}:generateContent"
        headers = {"Content-Type": "application/json"}

        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": prompt}]},
            ],
        }
        generation_config = {}
        if self.temperature is not None:
            generation_config["temperature"] = self.temperature
        if self.max_tokens is not None:
            generation_config["maxOutputTokens"] = self.max_tokens
        if generation_config:
            payload["generationConfig"] = generation_config

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(
                    url,
                    params={"key": self.api_key},
                    json=payload,
                    headers=headers,
                )

            if resp.status_code in (400, 404):
                message = self._api_error_message(resp)
                return self._error(message or "Gemini rejected the request. Check the model name and payload.")

            if resp.status_code in (401, 403):
                message = self._api_error_message(resp)
                return self._error(message or "Invalid or missing Gemini API key (authentication failed).")

            resp.raise_for_status()
            data = resp.json()

            candidates = data.get("candidates") or []
            if not candidates:
                return self._error("Gemini returned no candidates (malformed response)")

            parts = (candidates[0].get("content", {}).get("parts") or [])
            text = "".join((part.get("text") or "") for part in parts).strip()

            if not text:
                return self._error("Gemini returned an empty response")

            usage = data.get("usageMetadata") or {}
            tokens_used = None
            if usage:
                tokens_used = {
                    "prompt": usage.get("promptTokenCount"),
                    "completion": usage.get("candidatesTokenCount"),
                    "total": usage.get("totalTokenCount"),
                }

            return json.dumps({
                "provider": "gemini",
                "model": self.model,
                "success": True,
                "response": text,
                "tokens_used": tokens_used,
            })

        except httpx.ConnectError:
            return self._error(f"Cannot connect to Gemini at {self.base_url}. Is the network reachable?")

        except httpx.TimeoutException:
            return self._error(f"Gemini request timed out after {self.timeout}s")

        except Exception as exc:
            logger.error(f"GeminiProvider error: {exc}", exc_info=True)
            return self._error(str(exc))

    @staticmethod
    def _api_error_message(resp: httpx.Response) -> Optional[str]:
        """Extracts the human-readable error message from a Gemini error body."""
        try:
            body = resp.json()
            return body.get("error", {}).get("message")
        except Exception:
            return None

    @staticmethod
    def _error(error: str) -> str:
        return json.dumps({
            "provider": "gemini",
            "success": False,
            "error": error,
            "response": None,
        })