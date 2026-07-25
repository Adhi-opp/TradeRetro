import { useState, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import useAIStore from '../../store/useAIStore';

export default function PromptInput() {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const sendMessage = useAIStore((s) => s.sendMessage);
  const loading = useAIStore((s) => s.loading);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setValue('');
    sendMessage(trimmed);
  }, [value, loading, sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setValue(e.target.value);
  };

  return (
    <div className="ai-prompt-input-container">
      <div className="ai-prompt-input-row">
        <textarea
          ref={inputRef}
          className="ai-prompt-input ai-prompt-textarea"
          placeholder="Ask the AI Copilot something..."
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={1}
          aria-label="Chat input"
        />
        <button
          className="ai-prompt-send-btn"
          onClick={handleSend}
          disabled={loading || !value.trim()}
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>
      <p className="ai-prompt-hint">
        AI Copilot can analyze strategies, explain metrics, and suggest improvements.
      </p>
    </div>
  );
}
