"""Model Registry Module for AI Copilot.

This module defines the available LLM model registry with metadata
for each model (id, display name, provider type, local flag). It can
optionally discover locally installed Ollama models at runtime.
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, List

logger = logging.getLogger("traderetro.ai.registry")

OLLAMA_TAGS_URL = "http://localhost:11434/api/tags"


@dataclass
class ModelInfo:
    """Metadata for a registered LLM model.

    Attributes:
        id: Unique model identifier (e.g. ``"llama3.2"``).
        display_name: Human-readable name for UI display.
        provider: Provider backend identifier (e.g. ``"ollama"``, ``"mock"``).
        local: Whether the model runs locally (``True``) or requires a remote API.
    """

    id: str
    display_name: str
    provider: str
    local: bool = False


REGISTERED_MODELS: Dict[str, ModelInfo] = {
    "mock": ModelInfo(id="mock", display_name="Mock Provider", provider="mock", local=True),
    "llama3.2": ModelInfo(id="llama3.2", display_name="Llama 3.2", provider="ollama", local=True),
    "llama3.1": ModelInfo(id="llama3.1", display_name="Llama 3.1", provider="ollama", local=True),
    "mistral": ModelInfo(id="mistral", display_name="Mistral", provider="ollama", local=True),
    "gemma2": ModelInfo(id="gemma2", display_name="Gemma 2", provider="ollama", local=True),
    "gemini-pro": ModelInfo(id="gemini-pro", display_name="Gemini Pro", provider="gemini", local=False),
    "gpt-4o-mini": ModelInfo(id="gpt-4o-mini", display_name="GPT-4o Mini", provider="openai", local=False),
    "qwen2.5-coder-1.5b-instruct": ModelInfo(
        id="qwen2.5-coder-1.5b-instruct",
        display_name="Qwen 2.5 Coder 1.5B Instruct",
        provider="openai-compatible",
        local=True,
    ),
    "qwen2.5-coder-7b-instruct": ModelInfo(
        id="qwen2.5-coder-7b-instruct",
        display_name="Qwen 2.5 Coder 7B Instruct",
        provider="openai-compatible",
        local=True,
    ),
    "deepseek-r1-distill-qwen-7b": ModelInfo(
        id="deepseek-r1-distill-qwen-7b",
        display_name="DeepSeek R1 Distill Qwen 7B",
        provider="openai-compatible",
        local=True,
    ),
    "dolphin3.0-llama3.2-3b": ModelInfo(
        id="dolphin3.0-llama3.2-3b",
        display_name="Dolphin 3.0 Llama 3.2 3B",
        provider="openai-compatible",
        local=True,
    ),
    "llama-3.2-3b-instruct": ModelInfo(
        id="llama-3.2-3b-instruct",
        display_name="Llama 3.2 3B Instruct",
        provider="openai-compatible",
        local=True,
    ),
    "mistral-nemo-instruct": ModelInfo(
        id="mistral-nemo-instruct",
        display_name="Mistral Nemo Instruct",
        provider="openai-compatible",
        local=True,
    ),
}


def _fetch_ollama_tags() -> List[Dict]:
    """Attempts to fetch installed models from the local Ollama instance.

    Returns:
        A list of model tag dicts, or an empty list on failure.
    """
    try:
        import httpx
        resp = httpx.get(OLLAMA_TAGS_URL, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        return data.get("models", [])
    except Exception as exc:
        logger.debug("Ollama not available (%s); using static registry", exc)
        return []


def discover_ollama_models() -> Dict[str, ModelInfo]:
    """Queries the local Ollama instance and merges discovered models
    into a dynamic registry dict.

    Falls back to static ``REGISTERED_MODELS`` if Ollama is unreachable.

    Returns:
        Dict of model ID to :class:`ModelInfo`, including any Ollama models
        found on the local machine.
    """
    models = dict(REGISTERED_MODELS)
    tags = _fetch_ollama_tags()
    for tag in tags:
        name = tag.get("name", "")
        if not name:
            continue
        model_id = name.replace(":latest", "")
        if model_id not in models:
            models[model_id] = ModelInfo(
                id=model_id,
                display_name=name,
                provider="ollama",
                local=True,
            )
            logger.info("Discovered local Ollama model: %s", model_id)
    return models


def list_models() -> List[ModelInfo]:
    """Returns all registered models as a list, including any
    locally discovered Ollama models.

    Returns:
        List of :class:`ModelInfo` entries.
    """
    return list(discover_ollama_models().values())


def resolve_model(model_id: str) -> ModelInfo:
    """Looks up a model by its identifier.

    Includes dynamic Ollama discovery as a fallback.

    Args:
        model_id: The model identifier string.

    Returns:
        The matching :class:`ModelInfo`.

    Raises:
        KeyError: If the model ID is not found in registry or Ollama.
    """
    models = discover_ollama_models()
    if model_id in models:
        return models[model_id]
    raise KeyError(f"Model '{model_id}' not found in registry")
