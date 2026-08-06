"""
Tests for ai/config.py — AIConfig defaults and AIConfigurationManager.

Locks the runtime cleanup contract:

  * Default configuration values.
  * Dead configuration fields (enabled, provider, debug) are gone.
  * temperature / max_tokens setters validate their bounds.
  * reset_defaults() restores the factory state.
"""

import pytest

from ai.config import AIConfig, AIConfigurationManager


# ── AIConfig defaults ─────────────────────────────────────────────────────────


class TestAIConfig:
    def test_default_values(self):
        cfg = AIConfig()
        assert cfg.model == "qwen2.5-coder-1.5b-instruct"
        assert cfg.temperature == 0.2
        assert cfg.max_tokens == 1024
        assert cfg.timeout_seconds == 30
        assert cfg.openai_compatible_base_url == "http://localhost:1234"
        assert cfg.openai_compatible_api_key == "not-needed"

    def test_no_dead_configuration_fields(self):
        """Fields removed during runtime cleanup must not exist."""
        cfg = AIConfig()
        for removed in ("enabled", "provider", "debug"):
            assert not hasattr(cfg, removed)

    def test_configured_fields_are_mutatable(self):
        cfg = AIConfig(temperature=0.5, max_tokens=512)
        assert cfg.temperature == 0.5
        assert cfg.max_tokens == 512


# ── AIConfigurationManager ─────────────────────────────────────────────────────


class TestAIConfigurationManager:
    def test_manager_exposes_injected_config(self):
        manager = AIConfigurationManager(AIConfig(model="custom-model"))
        assert manager.get_config().model == "custom-model"

    def test_manager_defaults_to_factory_config(self):
        assert AIConfigurationManager().get_config() == AIConfig()

    def test_set_temperature_updates_value(self):
        manager = AIConfigurationManager()
        manager.set_temperature(0.5)
        assert manager.get_config().temperature == 0.5

    def test_set_temperature_out_of_range_raises(self):
        manager = AIConfigurationManager()
        for bad in (-0.1, 2.1):
            with pytest.raises(ValueError):
                manager.set_temperature(bad)

    def test_set_max_tokens_updates_value(self):
        manager = AIConfigurationManager()
        manager.set_max_tokens(512)
        assert manager.get_config().max_tokens == 512

    def test_set_max_tokens_non_positive_raises(self):
        manager = AIConfigurationManager()
        for bad in (0, -5):
            with pytest.raises(ValueError):
                manager.set_max_tokens(bad)

    def test_reset_defaults_restores_factory_state(self):
        manager = AIConfigurationManager()
        manager.set_temperature(1.5)
        manager.set_max_tokens(2048)
        manager.reset_defaults()
        assert manager.get_config() == AIConfig()