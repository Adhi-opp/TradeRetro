import useAIStore from '../../store/useAIStore';
import CopilotHeader from './CopilotHeader';
import EmptyState from './EmptyState';
import ConversationList from './ConversationList';
import PromptInput from './PromptInput';

export default function CopilotPanel() {
  const panelOpen = useAIStore((s) => s.panelOpen);
  const messages = useAIStore((s) => s.messages);
  const hasMessages = messages.length > 0;

  return (
    <aside
      className={`ai-panel ${panelOpen ? 'ai-panel-open' : 'ai-panel-closed'}`}
      aria-label="AI Copilot panel"
      aria-hidden={!panelOpen}
    >
      <div className="ai-panel-inner">
        <CopilotHeader />
        <div className="ai-panel-body">
          {hasMessages ? <ConversationList /> : <EmptyState />}
        </div>
        <PromptInput />
      </div>
    </aside>
  );
}
