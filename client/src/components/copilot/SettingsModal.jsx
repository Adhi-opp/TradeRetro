import { useState } from 'react';
import { X, ChevronDown, Key, Cpu, Cloud, Check, Lock, ShieldCheck } from 'lucide-react';
import useAIStore from '../../store/useAIStore';

export default function SettingsModal({ isOpen, onClose }) {
  const models = useAIStore((s) => s.models);
  const selectedModel = useAIStore((s) => s.selectedModel);
  const setSelectedModel = useAIStore((s) => s.setSelectedModel);
  const userApiKey = useAIStore((s) => s.userApiKey);
  const setUserApiKey = useAIStore((s) => s.setUserApiKey);

  const [showApiDialog, setShowApiDialog] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(userApiKey || '');
  const [configuredFeedback, setConfiguredFeedback] = useState(false);

  if (!isOpen) return null;

  // Group models into LM Studio (local) vs Cloud
  const lmStudioModels = models.filter((m) => m.local || m.provider === 'openai-compatible' || m.provider === 'ollama' || m.provider === 'mock');
  const cloudModels = models.filter((m) => !m.local && m.provider !== 'openai-compatible' && m.provider !== 'ollama' && m.provider !== 'mock');

  // Selected model info
  const activeModelObj = models.find((m) => m.id === selectedModel);

  const handleSelectModel = (modelId) => {
    setSelectedModel(modelId || null);
  };

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    setUserApiKey(tempApiKey.trim());
    setShowApiDialog(false);
    setConfiguredFeedback(true);
    setTimeout(() => setConfiguredFeedback(false), 3000);
  };

  const handleClearApiKey = () => {
    setTempApiKey('');
    setUserApiKey('');
    setShowApiDialog(false);
  };

  return (
    <div className="ai-settings-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="AI Copilot Settings">
      <div className="ai-settings-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="ai-settings-header">
          <div>
            <h3 className="ai-settings-title">AI Copilot Settings</h3>
            <p className="ai-settings-subtitle">Configure model provider, parameters, and custom credentials</p>
          </div>
          <button type="button" className="ai-settings-close-btn" onClick={onClose} aria-label="Close settings">
            <X size={16} />
          </button>
        </div>

        <div className="ai-settings-body">
          {/* SECTION 1: MODEL SELECTION WITH PROVIDER GROUPING */}
          <div className="ai-settings-section">
            <label htmlFor="ai-settings-model-select" className="ai-settings-label">
              MODEL PROVIDER &amp; SELECTION
            </label>

            <div className="ai-select-container">
              <select
                id="ai-settings-model-select"
                className="ai-model-select"
                value={selectedModel || ''}
                onChange={(e) => handleSelectModel(e.target.value)}
                aria-label="Select AI Model"
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

            <div className="ai-model-badge-row">
              <span className="ai-model-type-badge">
                {activeModelObj?.local ? <Cpu size={12} /> : <Cloud size={12} />}
                <span>{activeModelObj ? (activeModelObj.local ? 'Local LLM (LM Studio)' : 'Cloud API') : 'Default Local Engine'}</span>
              </span>
            </div>
          </div>

          {/* SECTION 2: CUSTOM API KEY CONFIGURATION */}
          <div className="ai-settings-section">
            <label className="ai-settings-label">CUSTOM API CONFIGURATION</label>
            <div className="ai-key-card-container">
              <div className="ai-key-status-row">
                <div className="ai-key-status-left">
                  <Key size={16} className="ai-key-icon" />
                  <div>
                    <div className="ai-key-title">Custom API Key</div>
                    <div className="ai-key-subtitle">
                      {userApiKey ? (
                        <span className="ai-key-configured-text">
                          <Check size={12} /> Custom API — Configured
                        </span>
                      ) : (
                        'Optional transient header for OpenAI / Gemini providers'
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className={`ai-configure-key-btn ${userApiKey ? 'is-configured' : ''}`}
                  onClick={() => {
                    setTempApiKey(userApiKey || '');
                    setShowApiDialog(true);
                  }}
                >
                  {userApiKey ? 'Edit API Key' : 'Configure Custom API'}
                </button>
              </div>

              {configuredFeedback && (
                <div className="ai-key-success-toast">
                  <ShieldCheck size={14} />
                  <span>Custom API Key successfully updated.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ai-settings-footer">
          <button type="button" className="ai-settings-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      {/* DIALOG FOR API KEY INSERTION */}
      {showApiDialog && (
        <div className="ai-api-dialog-overlay" onClick={() => setShowApiDialog(false)}>
          <div className="ai-api-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Configure API Key">
            <div className="ai-api-dialog-header">
              <div className="ai-api-dialog-title-wrap">
                <Lock size={16} />
                <h4>Configure Custom API Key</h4>
              </div>
              <button type="button" className="ai-settings-close-btn" onClick={() => setShowApiDialog(false)} aria-label="Close API Dialog">
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveApiKey} className="ai-api-dialog-form">
              <p className="ai-api-dialog-desc">
                Enter your secret API key below. Keys are sent directly as per-request transient headers and are never stored in disk, logs, or local storage.
              </p>

              <div className="ai-api-input-wrap">
                <input
                  type="password"
                  className="ai-api-key-input-masked"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="Paste API Key (e.g. AIzaSy... / sk-...)"
                  autoFocus
                  autoComplete="off"
                  aria-label="API Key Input"
                />
              </div>

              <div className="ai-api-dialog-actions">
                {userApiKey && (
                  <button type="button" className="ai-api-clear-btn" onClick={handleClearApiKey}>
                    Remove Key
                  </button>
                )}
                <div className="ai-api-dialog-right-actions">
                  <button type="button" className="ai-api-cancel-btn" onClick={() => setShowApiDialog(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="ai-api-save-btn">
                    Save Key
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
