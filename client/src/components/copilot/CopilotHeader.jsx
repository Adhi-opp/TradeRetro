import { X, Settings, Trash2 } from 'lucide-react';
import useAIStore from '../../store/useAIStore';

const statusClasses = 'ai-header-status-dot ai-status-ready';

export default function CopilotHeader() {
  const closePanel = useAIStore((s) => s.closePanel);
  const clearConversation = useAIStore((s) => s.clearConversation);
  const hasMessages = useAIStore((s) => s.messages.length > 0);

  return (
    <header className="ai-panel-header" role="banner">
      <div className="ai-header-left">
        <h2 className="ai-header-title">TradeRetro AI Copilot</h2>
        <div className="ai-header-status">
          <span className={statusClasses} aria-hidden="true" />
          <span className="ai-header-status-label">Ready</span>
        </div>
      </div>
      <div className="ai-header-actions">
        <button
          className="ai-header-btn"
          onClick={clearConversation}
          disabled={!hasMessages}
          title="Clear conversation"
          aria-label="Clear conversation"
        >
          <Trash2 size={15} />
        </button>
        <button
          className="ai-header-btn"
          title="Settings"
          aria-label="AI Copilot settings"
          disabled
        >
          <Settings size={15} />
        </button>
        <button
          className="ai-header-btn ai-header-close"
          onClick={closePanel}
          title="Close AI Copilot"
          aria-label="Close AI Copilot panel"
        >
          <X size={15} />
        </button>
      </div>
    </header>
  );
}
