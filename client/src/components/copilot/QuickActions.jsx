import { useCallback } from 'react';
import useAIStore from '../../store/useAIStore';
import useBacktestStore from '../../store/useBacktestStore';
import { QUICK_ACTIONS, buildQuickActionPrompt } from '../../services/promptTemplates';

export default function QuickActions() {
  const setDraftPrompt = useAIStore((s) => s.setDraftPrompt);

  const handleAction = useCallback(
    (action) => {
      const backtestState = useBacktestStore.getState();
      setDraftPrompt(buildQuickActionPrompt(action, backtestState));
    },
    [setDraftPrompt],
  );

  return (
    <section className="ai-quick-actions" aria-label="Quick actions">
      <div className="ai-qa-grid">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            className="ai-qa-card"
            onClick={() => handleAction(action)}
            title={action.description}
            aria-label={action.description}
          >
            <span className="ai-qa-label">{action.label}</span>
            <span className="ai-qa-desc">{action.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}