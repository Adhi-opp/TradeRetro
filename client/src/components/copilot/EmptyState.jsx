import { Bot } from 'lucide-react';
import QuickActions from './QuickActions';
import ExamplePrompts from './ExamplePrompts';

export default function EmptyState() {
  return (
    <div className="ai-empty-state">
      <div className="ai-empty-icon" aria-hidden="true">
        <Bot size={40} />
      </div>
      <h2 className="ai-empty-title">TradeRetro AI Copilot</h2>
      <p className="ai-empty-subtitle">
        Analyze strategies. Explain metrics. Understand results.
      </p>
      <QuickActions />
      <ExamplePrompts />
    </div>
  );
}
