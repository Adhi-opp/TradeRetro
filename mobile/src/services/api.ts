const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api";

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status}`,
    );
  }

  return response.json();
}