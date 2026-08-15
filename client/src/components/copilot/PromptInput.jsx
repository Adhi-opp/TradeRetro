import { useRef, useCallback, useEffect } from 'react';
import { Send } from 'lucide-react';
import useAIStore from '../../store/useAIStore';

export default function PromptInput() {
  const textareaRef = useRef(null);
  const value = useAIStore((s) => s.inputValue);
  const setInputValue = useAIStore((s) => s.setInputValue);
  const focusRequest = useAIStore((s) => s.focusRequest);
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
    setInputValue('');
    sendMessage(trimmed);
  }, [value, loading, setInputValue, sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e) => {
    setInputValue(e.target.value);
    autoResize();
  };

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  useEffect(() => {
    if (focusRequest === 0) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [focusRequest]);

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