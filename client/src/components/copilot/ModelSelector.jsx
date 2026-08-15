import { useState } from 'react';
import { ChevronDown, Key, Cpu, Cloud } from 'lucide-react';
import useAIStore from '../../store/useAIStore';

export default function ModelSelector() {
  const models = useAIStore((s) => s.models);
  const selectedModel = useAIStore((s) => s.selectedModel);
  const setSelectedModel = useAIStore((s) => s.setSelectedModel);
  const userApiKey = useAIStore((s) => s.userApiKey);
  const setUserApiKey = useAIStore((s) => s.setUserApiKey);

  const [showKeyInput, setShowKeyInput] = useState(false);
  const hasModels = models.length > 0;

  const handleChange = (e) => {
    setSelectedModel(e.target.value || null);
  };

  const lmStudioModels = models.filter((m) => m.local || m.provider === 'openai-compatible' || m.provider === 'ollama' || m.provider === 'mock');
  const cloudModels = models.filter((m) => !m.local && m.provider !== 'openai-compatible' && m.provider !== 'ollama' && m.provider !== 'mock');

  return (
    <div className="ai-config-card">
      <div className="ai-config-field">
        <label htmlFor="ai-model-select-input" className="ai-config-label">
          AI MODEL
        </label>
        <div className="ai-select-container">
          <select
            id="ai-model-select-input"
            className="ai-model-select"
            value={selectedModel || ''}
            onChange={handleChange}
            disabled={!hasModels}
            aria-label="AI MODEL"
          >
            <option value="">Default: LM Studio — Qwen 2.5 Coder 1.5B</option>
            {lmStudioModels.length > 0 && (
              <optgroup label="LM Studio (Local Models)">
                {lmStudioModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </optgroup>
            )}
            {cloudModels.length > 0 && (
              <optgroup label="Cloud Providers">
                {cloudModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <div className="ai-select-icon-wrap" aria-hidden="true">
            <ChevronDown size={14} />
          </div>
        </div>
      </div>

      <div className="ai-key-section">
        <button
          type="button"
          className={`ai-key-btn ${showKeyInput ? 'is-active' : ''}`}
          onClick={() => setShowKeyInput((v) => !v)}
          aria-expanded={showKeyInput}
        >
          <span className="ai-key-btn-left">
            <Key size={13} />
            <span>Configure Custom API Key</span>
          </span>
          <span className="ai-key-btn-badge">
            {userApiKey ? 'Key Active' : 'Optional'}
          </span>
        </button>

        {showKeyInput && (
          <div className="ai-key-drawer">
            <input
              type="password"
              className="ai-key-input"
              value={userApiKey}
              onChange={(e) => setUserApiKey(e.target.value)}
              placeholder="Paste API key (e.g. Gemini / OpenAI)..."
              aria-label="Custom API Key"
              autoComplete="off"
            />
            <p className="ai-key-hint">
              Transient per-request header · Never saved to disk or logs
            </p>
          </div>
        )}
      </div>
    </div>
  );
}