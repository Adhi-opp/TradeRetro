import { memo } from 'react';
import { Bot } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

function MessageBubbleInner({ message, isLatest }) {
  const isUser = message.role === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`ai-message ai-message-${isUser ? 'user' : 'assistant'}`}
      role="listitem"
      style={{ '--msg-index': isLatest ? 0 : 1 }}
    >
      {!isUser && (
        <div className="ai-message-avatar" aria-hidden="true">
          <Bot size={14} />
        </div>
      )}
      <div className="ai-message-body">
        <div className="ai-message-header">
          <span className="ai-message-role-label">{isUser ? 'You' : 'AI'}</span>
          <span className="ai-message-time">{time}</span>
        </div>
        <div className="ai-message-content">
          {isUser ? message.content : <MarkdownRenderer content={message.content} />}
        </div>
      </div>
    </div>
  );
}

const MessageBubble = memo(MessageBubbleInner);
export default MessageBubble;
