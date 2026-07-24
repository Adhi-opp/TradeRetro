"""OpenAI-Compatible LLM Provider (LM Studio, vLLM, etc.).

Calls any OpenAI-compatible /v1/chat/completions endpoint
(e.g. LM Studio, vLLM, TGI, etc.).
"""

import json
import logging
from typing import Optional

import httpx

from ai.providers.base_provider import BaseLLMProvider

logger = logging.getLogger("traderetro.ai.openai_compatible")

DEFAULT_BASE_URL = "http://localhost:1234"
DEFAULT_TIMEOUT = 120


class OpenAICompatibleProvider(BaseLLMProvider):
    """LLM provider for any OpenAI-compatible chat completions API."""

    def __init__(
        self,
        model: str = "qwen2.5-coder-7b-instruct",
        base_url: str = DEFAULT_BASE_URL,
        api_key: str = "not-needed",
        timeout_seconds: int = DEFAULT_TIMEOUT,
    ) -> None:
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout_seconds

    def generate_response(self, prompt: str) -> str:
        url = f"{self.base_url}/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": self.model,
            "messages": [
                {"role": "user", "content": prompt},
            ],
            "stream": False,
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(url, json=payload, headers=headers)

            if resp.status_code == 404:
                body = resp.json()
                return json.dumps({
                    "provider": "openai-compatible",
                    "model": self.model,
                    "success": False,
                    "error": body.get("error", {}).get("message", "Model not found"),
                    "response": None,
                })

            resp.raise_for_status()
            data = resp.json()

            choices = data.get("choices", [])
            if not choices:
                return json.dumps({
                    "provider": "openai-compatible",
                    "model": self.model,
                    "success": False,
                    "error": "No choices returned by the API",
                    "response": None,
                })

            message = choices[0].get("message", {})
            content = (message.get("content") or "").strip()

            if not content:
                return json.dumps({
                    "provider": "openai-compatible",
                    "model": self.model,
                    "success": False,
                    "error": "Empty response content",
                    "response": None,
                })

            usage = data.get("usage")
            tokens_used = None
            if usage:
                tokens_used = {
                    "prompt": usage.get("prompt_tokens"),
                    "completion": usage.get("completion_tokens"),
                    "total": usage.get("total_tokens"),
                }

            return json.dumps({
                "provider": "openai-compatible",
                "model": self.model,
                "success": True,
                "response": content,
                "tokens_used": tokens_used,
            })

        except httpx.ConnectError:
            return json.dumps({
                "provider": "openai-compatible",
                "model": self.model,
                "success": False,
                "error": f"Cannot connect to {self.base_url}. Is the server running?",
                "response": None,
            })

        except httpx.TimeoutException:
            return json.dumps({
                "provider": "openai-compatible",
                "model": self.model,
                "success": False,
                "error": f"Request timed out after {self.timeout}s",
                "response": None,
            })

        except Exception as exc:
            logger.error(f"OpenAICompatibleProvider error: {exc}", exc_info=True)
            return json.dumps({
                "provider": "openai-compatible",
                "model": self.model,
                "success": False,
                "error": str(exc),
                "response": None,
            })
