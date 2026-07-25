import { useState, useRef, useCallback, useEffect } from 'react';
import { Send } from 'lucide-react';
import useAIStore from '../../store/useAIStore';

export default function PromptInput() {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);
  const sendMessage = useAIStore((s) => s.sendMessage);
  const loading = useAIStore((s) => s.loading);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setValue('');
    sendMessage(trimmed);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, loading, sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e) => {
    setValue(e.target.value);
    autoResize();
  };

  useEffect(() => {
    if (!loading && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [loading]);

  return (
    <div className="ai-prompt-input-container">
      <div className="ai-prompt-input-row">
        <textarea
          ref={textareaRef}
          className="ai-prompt-input"
          placeholder="Ask about strategies, metrics, or results..."
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={1}
          aria-label="Chat input"
        />
        <button
          className={`ai-prompt-send-btn ${value.trim() && !loading ? 'ai-prompt-send-active' : ''}`}
          onClick={handleSend}
          disabled={loading || !value.trim()}
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
