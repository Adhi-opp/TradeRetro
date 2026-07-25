import { POST } from './apiClient';

export async function generate(userQuery, providerName) {
  return POST('/api/ai/generate', {
    user_query: userQuery,
    provider_name: providerName || 'mock',
  });
}
