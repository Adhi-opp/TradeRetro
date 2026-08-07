import { create } from 'zustand';
import { generate, fetchModels } from '../services/aiService';
import { buildAiContext } from '../services/aiContextBuilder';
import useBacktestStore from './useBacktestStore';

let _nextId = 1;
function nextId() {
  return `msg_${Date.now()}_${_nextId++}`;
}

function friendlyProviderError(errorText) {
  const text = (errorText || '').toString();
  const t = text.toLowerCase();
  if (!text) return '';
  if (t.includes('localhost:1234') || t.includes('local model') || t.includes('lm studio')) {
    return 'Local model unavailable - start the local model server (e.g. LM Studio) and try again.';
  }
  if (t.includes('api key not valid') || t.includes('authentication failed')) {
    return 'Gemini unavailable - the API key was rejected. Set a valid GEMINI_API_KEY.';
  }
  if (t.includes('no gemini api key configured')) {
    return 'Gemini unavailable - GEMINI_API_KEY is not configured. Set the key and restart the server.';
  }
  if (t.includes('cannot connect to gemini') || t.includes('gemini') && (t.includes('unavailable') || t.includes('network'))) {
    return 'Gemini unavailable - the Gemini service could not be reached. Check your network.';
  }
  if (t.includes('cannot connect') || t.includes('connection refused') || t.includes('connection error')) {
    return 'The model service could not be reached. Check that the provider is running and reachable.';
  }
  return text;
}

const useAIStore = create((set, get) => ({
  panelOpen: false,
  messages: [],
  loading: false,
  error: null,

  models: [],
  selectedModel: null,
  modelsLoading: false,
  modelsLoaded: false,
  modelsError: null,

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

  setSelectedModel: (model) => set({ selectedModel: model }),

  loadModels: async () => {
    if (get().modelsLoading || get().modelsLoaded) return;
    set({ modelsLoading: true, modelsError: null });
    try {
      const data = await fetchModels();
      const models = Array.isArray(data)
        ? data.filter(
            (m) => m && typeof m.id === 'string' && typeof m.display_name === 'string',
          )
        : [];
      set({ models, modelsLoading: false, modelsLoaded: true });
    } catch (err) {
      set({
        modelsLoading: false,
        modelsLoaded: true,
        modelsError: err?.message || 'Failed to load models',
      });
    }
  },

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
      const data = await generate(trimmed, get().selectedModel || undefined, contextPayload);

      if (!data?.success) {
        throw new Error(
          friendlyProviderError(data?.error) || 'The AI service returned an unsuccessful response.',
        );
      }

      const responsePayload = data?.response;

      if (responsePayload && typeof responsePayload === 'object' && responsePayload.success === false) {
        throw new Error(
          friendlyProviderError(responsePayload.error) || 'The selected model could not complete the request.',
        );
      }

      let reply = '';

      if (typeof responsePayload === 'string') {
        reply = responsePayload;
      } else if (responsePayload) {
        reply = responsePayload.response
          || responsePayload.raw_response
          || responsePayload.message?.content
          || responsePayload.content
          || responsePayload.text
          || '';
      }

      if (!reply && data?.error) {
        throw new Error(
          friendlyProviderError(data.error) || 'The AI service returned an unsuccessful response.',
        );
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

useAIStore.getState().loadModels();

export default useAIStore;