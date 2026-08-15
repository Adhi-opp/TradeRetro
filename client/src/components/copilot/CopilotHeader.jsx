import { useState } from 'react';
import { X, Settings, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import useAIStore from '../../store/useAIStore';
import SettingsModal from './SettingsModal';

export default function CopilotHeader() {
  const closePanel = useAIStore((s) => s.closePanel);
  const clearConversation = useAIStore((s) => s.clearConversation);
  const hasMessages = useAIStore((s) => s.messages.length > 0);
  const models = useAIStore((s) => s.models);
  const selectedModel = useAIStore((s) => s.selectedModel);
  const error = useAIStore((s) => s.error);
  const providerStatus = useAIStore((s) => s.providerStatus);

  const [settingsOpen, setSettingsOpen] = useState(false);

  // Active model label
  const activeModelObj = models.find((m) => m.id === selectedModel);
  const currentModelName = activeModelObj ? activeModelObj.display_name : 'Qwen 2.5 Coder 1.5B';

  // Availability calculation: a probe result of "unavailable", or a request
  // error matching an outage pattern, flips the header to Not Available.
  const isErrorState = !!error && (
    error.toLowerCase().includes('unavailable') ||
    error.toLowerCase().includes('not reached') ||
    error.toLowerCase().includes('connection refused') ||
    error.toLowerCase().includes('failed to fetch')
  );

  const isAvailable = providerStatus !== 'unavailable' && !isErrorState;

  return (
    <>
      <header className="ai-panel-header" role="banner">
        <div className="ai-header-top">
          <div className="ai-header-left">
            <h2 className="ai-header-title">TradeRetro AI Copilot</h2>
            <div className={`ai-header-status ${isAvailable ? 'is-ready' : 'is-unavailable'}`}>
              <span
                className={`ai-header-status-dot ${isAvailable ? 'ai-status-ready' : 'ai-status-unavailable'}`}
                aria-hidden="true"
              />
              <span className="ai-header-status-label">{isAvailable ? 'Ready' : 'Not Available'}</span>
            </div>
          </div>

          <div className="ai-header-actions">
            <button
              type="button"
              className="ai-header-btn"
              onClick={clearConversation}
              disabled={!hasMessages}
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <Trash2 size={15} />
            </button>
            <button
              type="button"
              className="ai-header-btn"
              onClick={() => setSettingsOpen(true)}
              title="AI Settings"
              aria-label="AI Copilot settings"
            >
              <Settings size={15} />
            </button>
            <button
              type="button"
              className="ai-header-btn ai-header-close"
              onClick={closePanel}
              title="Close AI Copilot"
              aria-label="Close AI Copilot panel"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Clean Model Header Bar */}
        <div className="ai-header-model-subbar">
          <span className="ai-header-using-label">Using:</span>
          <span className="ai-header-model-chip">{currentModelName}</span>
        </div>
      </header>

      {/* Dedicated Settings Surface */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}