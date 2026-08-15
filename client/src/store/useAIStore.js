import { create } from 'zustand';
import { generate, fetchModels } from '../services/aiService';
import { buildAiContext } from '../services/aiContextBuilder';
import useBacktestStore from './useBacktestStore';

let _nextId = 1;
function nextId() {
  return `msg_${Date.now()}_${_nextId++}`;
}

// Lightweight provider reachability probes for local engines. These are pure
// frontend checks (opaque CORS fetch) that do NOT touch the provider system:
// they only determine whether the underlying local server is reachable.
const LM_STUDIO_PROBE_URL = 'http://localhost:1234/v1/models';
const OLLAMA_PROBE_URL = 'http://localhost:11434/api/tags';
const PROBE_TIMEOUT_MS = 2500;
const PROBE_CACHE_MS = 8000;

const _probeCache = new Map();
let _probeInFlight = null;

async function probeUrl(url) {
  const cached = _probeCache.get(url);
  if (cached != null && Date.now() - cached.at < PROBE_CACHE_MS) return cached.ok;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    let ok = true;
    try {
      // no-cors returns an opaque response (status 0) whenever the server is
      // actually reachable, regardless of CORS headers; an unreachable or
      // timed-out server rejects with a TypeError.
      await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: controller.signal });
    } catch {
      ok = false;
    } finally {
      clearTimeout(timer);
    }
    _probeCache.set(url, { at: Date.now(), ok });
    return ok;
  } catch {
    return false;
  }
}

// Provider outage message patterns that should flip the header to Not Available.
function isOutageMessage(text) {
  const t = (text || '').toString().toLowerCase();
  return (
    t.includes('unavailable') ||
    t.includes('not reached') ||
    t.includes('connection refused') ||
    t.includes('failed to fetch') ||
    t.includes('could not be reached') ||
    t.includes('cannot connect')
  );
}

function providerProbeUrl(model) {
  if (!model) return null;
  if (model.provider === 'ollama') return OLLAMA_PROBE_URL;
  if (model.provider === 'openai-compatible') return LM_STUDIO_PROBE_URL;
  return null;
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
  inputValue: '',
  focusRequest: 0,

  models: [],
  selectedModel: null,
  userApiKey: '',
  modelsLoading: false,
  modelsLoaded: false,
  modelsError: null,

  // Provider availability state shown in the Copilot header:
  // 'unknown' | 'ready' | 'unavailable'
  providerStatus: 'unknown',

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

  setInputValue: (text) => set({ inputValue: text || '' }),

  setDraftPrompt: (text) =>
    set((s) => ({ inputValue: (text || '').trim(), focusRequest: s.focusRequest + 1 })),

  setSelectedModel: (model) => {
    set({ selectedModel: model });
    get().checkProviderAvailability();
  },

  setUserApiKey: (key) => set({ userApiKey: key || '' }),

  checkProviderAvailability: async () => {
    const state = get();
    if (state.modelsError) {
      set({ providerStatus: 'unavailable' });
      return;
    }
    const models = state.models;
    const active =
      models.find((m) => m.id === state.selectedModel) ||
      models.find((m) => m.id === 'qwen2.5-coder-1.5b-instruct') ||
      models[0] ||
      null;

    if (!active) {
      set({ providerStatus: 'unavailable' });
      return;
    }

    // Cloud providers (gemini/openai) cannot be cheaply verified here; keep
    // the existing request state as the source of truth for them.
    const url = providerProbeUrl(active);
    if (!url) {
      set({ providerStatus: 'unknown' });
      return;
    }

    if (_probeInFlight) return;
    _probeInFlight = true;
    try {
      const ok = await probeUrl(url);
      set({ providerStatus: ok ? 'ready' : 'unavailable' });
    } finally {
      _probeInFlight = null;
    }
  },

  loadModels: async () => {
    if (get().modelsLoading) return;
    set({ modelsLoading: true, modelsError: null });
    try {
      const data = await fetchModels();
      const models = Array.isArray(data)
        ? data.filter(
            (m) => m && typeof m.id === 'string' && typeof m.display_name === 'string',
          )
        : [];
      set({ models, modelsLoading: false, modelsLoaded: true });
      get().checkProviderAvailability();
    } catch (err) {
      set({
        modelsLoading: false,
        modelsLoaded: false,
        modelsError: err?.message || 'Failed to load models',
      });
      setTimeout(() => {
        if (!get().modelsLoaded) get().loadModels();
      }, 3000);
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
      const apiKey = get().userApiKey.trim();
      const data = await generate(trimmed, get().selectedModel || undefined, contextPayload, { apiKey: apiKey || undefined });

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
      set({ providerStatus: 'ready' });
    } catch (err) {
      const message = err?.message || 'Unable to contact AI. Please try again.';
      set({
        error: message,
        loading: false,
        providerStatus: isOutageMessage(message) ? 'unavailable' : get().providerStatus,
      });
    }
  },
}));

useAIStore.getState().loadModels();

export default useAIStore;