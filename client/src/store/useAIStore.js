import { create } from 'zustand';
import { generate } from '../services/aiService';
import { buildAiContext } from '../services/aiContextBuilder';
import useBacktestStore from './useBacktestStore';

let _nextId = 1;
function nextId() {
  return `msg_${Date.now()}_${_nextId++}`;
}

const useAIStore = create((set) => ({
  panelOpen: false,
  messages: [],
  loading: false,
  error: null,

  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  closePanel: () => set({ panelOpen: false }),

  appendMessage: (role, content) => {
    const message = { id: nextId(), role, content, timestamp: Date.now() };
    set((s) => ({ messages: [...s.messages, message] }));
    return message;
  },

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  clearConversation: () => set({ messages: [], error: null }),

  sendMessage: async (content) => {
    const trimmed = (content || '').trim();
    if (!trimmed) return;

    const userMsg = { id: nextId(), role: 'user', content: trimmed, timestamp: Date.now() };

    set((s) => ({
      messages: [...s.messages, userMsg],
      loading: true,
      error: null,
    }));

    try {
      const backtestState = useBacktestStore.getState();
      const contextPayload = buildAiContext({ backtest: backtestState });
      const data = await generate(trimmed, undefined, contextPayload);

      if (!data?.success) {
        throw new Error(data?.error || 'AI service returned an unsuccessful response.');
      }

      const responsePayload = data?.response;
      let reply = '';

      if (typeof responsePayload === 'string') {
        reply = responsePayload;
      } else if (responsePayload) {
        reply = responsePayload.response
          || responsePayload.raw_response
          || responsePayload.message?.content
          || responsePayload.content
          || responsePayload.text
          || JSON.stringify(responsePayload);
      }

      if (!reply && data?.error) {
        throw new Error(data.error);
      }

      const assistantMsg = {
        id: nextId(),
        role: 'assistant',
        content: reply || '',
        timestamp: Date.now(),
      };

      set((s) => ({
        messages: [...s.messages, assistantMsg],
        loading: false,
      }));
    } catch (err) {
      set({
        error: err?.message || 'Unable to contact AI. Please try again.',
        loading: false,
      });
    }
  },
}));

export default useAIStore;
