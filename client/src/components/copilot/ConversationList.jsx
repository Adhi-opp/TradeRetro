import { useEffect, useRef, useState, useCallback } from 'react';
import useAIStore from '../../store/useAIStore';
import MessageBubble from './MessageBubble';
import LoadingIndicator from './LoadingIndicator';

export default function ConversationList() {
  const messages = useAIStore((s) => s.messages);
  const loading = useAIStore((s) => s.loading);
  const error = useAIStore((s) => s.error);
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  const isNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const scrollToBottom = useCallback((smooth) => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'nearest',
      });
    }
  }, []);

  useEffect(() => {
    if (!userScrolledUp) {
      scrollToBottom(true);
    }
  }, [messages.length, userScrolledUp, scrollToBottom]);

  useEffect(() => {
    if (loading && !userScrolledUp) {
      scrollToBottom(true);
    }
  }, [loading, userScrolledUp, scrollToBottom]);

  const handleScroll = useCallback(() => {
    setUserScrolledUp(!isNearBottom());
  }, [isNearBottom]);

  return (
    <div
      className="ai-conversation-list"
      ref={containerRef}
      onScroll={handleScroll}
      role="log"
      aria-label="Conversation messages"
      aria-live="polite"
    >
      {messages.map((msg, i) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isLatest={i === messages.length - 1}
        />
      ))}
      {loading && (
        <div className="ai-loading-row" role="status" aria-label="AI is thinking">
          <LoadingIndicator />
        </div>
      )}
      {error && (
        <div className="ai-error-banner" role="alert">
          <span className="ai-error-icon" aria-hidden="true">!</span>
          {error}
        </div>
      )}
      <div ref={bottomRef} className="ai-scroll-anchor" />
    </div>
  );
}
