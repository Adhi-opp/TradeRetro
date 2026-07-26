import { POST } from './apiClient';

export async function generate(userQuery, providerName, contextPayload = {}) {
  const body = { user_query: userQuery, ...contextPayload };
  if (providerName) body.provider_name = providerName;
  return POST('/api/ai/generate', body);
}
