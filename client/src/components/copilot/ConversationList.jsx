import { useEffect, useRef } from 'react';
import useAIStore from '../../store/useAIStore';
import MessageBubble from './MessageBubble';
import LoadingIndicator from './LoadingIndicator';

export default function ConversationList() {
  const messages = useAIStore((s) => s.messages);
  const loading = useAIStore((s) => s.loading);
  const error = useAIStore((s) => s.error);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="ai-conversation-list" role="list" aria-label="Conversation messages">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {loading && (
        <div className="ai-loading-row">
          <div className="ai-message-avatar" aria-hidden="true">AI</div>
          <LoadingIndicator />
        </div>
      )}
      {error && (
        <div className="ai-error-banner" role="alert">
          {error}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
