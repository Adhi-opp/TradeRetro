export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`ai-message ai-message-${isUser ? 'user' : 'assistant'}`} role="listitem">
      <div className="ai-message-avatar" aria-hidden="true">
        {isUser ? 'U' : 'AI'}
      </div>
      <div className="ai-message-body">
        <div className="ai-message-content">{message.content}</div>
        <span className="ai-message-time">{time}</span>
      </div>
    </div>
  );
}
