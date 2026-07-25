import { POST } from './apiClient';

export async function generate(userQuery, providerName) {
  const body = { user_query: userQuery };
  if (providerName) body.provider_name = providerName;
  return POST('/api/ai/generate', body);
}
