import { GET, POST } from './apiClient';

export async function fetchModels() {
  return GET('/api/ai/models');
}

export async function generate(userQuery, providerName, contextPayload = {}) {
  const body = { user_query: userQuery, ...contextPayload };
  if (providerName) body.provider_name = providerName;
  return POST('/api/ai/generate', body, { timeoutMs: 60000 });
}
