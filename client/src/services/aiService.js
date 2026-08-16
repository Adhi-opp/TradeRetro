import { GET, POST } from './apiClient';

const MODE_CHAT = 'chat';
const MODE_REPORT = 'report';

// Lightweight style guidance prepended to CHAT-mode queries only. Encourages
// concise, conversational answers without touching the backend prompt
// builder. REPORT-mode queries are sent verbatim.
const CHAT_STYLE_GUIDANCE = [
  'Answer directly and concisely, leading with the answer.',
  'Use a conversational tone, like a helpful analyst — not a report.',
  'Do not restate context, metrics, or UI information the user can already see.',
  'Skip introductions, summaries of what you will do, and filler text.',
  'Expand with details, examples, or breakdowns only when the user asks.',
].join(' ');

function composeChatQuery(userQuery) {
  const trimmed = (userQuery || '').trim();
  if (!trimmed) return '';
  return `${CHAT_STYLE_GUIDANCE}\n\n${trimmed}`;
}

export async function fetchModels() {
  return GET('/api/ai/models');
}

export async function generate(userQuery, providerName, contextPayload = {}, options = {}) {
  const mode = options.mode || MODE_CHAT;
  const body = {
    user_query: mode === MODE_CHAT ? composeChatQuery(userQuery) : userQuery,
    mode,
    ...contextPayload,
  };
  if (providerName) body.provider_name = providerName;
  if (options.apiKey) body.api_key = options.apiKey;
  return POST('/api/ai/generate', body, { timeoutMs: 60000 });
}

export { MODE_CHAT, MODE_REPORT };