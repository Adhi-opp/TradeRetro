/**
 * Shared HTTP client for TradeRetro frontend services.
 *
 * This module is intentionally framework-light and uses the browser Fetch API.
 * Existing components are not wired to this client yet; it is the foundation
 * for future API consolidation without changing current request/response
 * contracts.
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const DEFAULT_TIMEOUT_MS = 30000;

let authTokenProvider = null;

/**
 * Normalized API error shape used by service callers.
 */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, statusText?: string, data?: unknown, url?: string, method?: string, code?: string }} details
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = details.status;
    this.statusText = details.statusText;
    this.data = details.data;
    this.url = details.url;
    this.method = details.method;
    this.code = details.code;
  }
}

/**
 * Registers a callback for future authentication support.
 * The callback can return a bearer token synchronously or asynchronously.
 *
 * @param {null | (() => string | Promise<string>)} provider
 */
export function setAuthTokenProvider(provider) {
  authTokenProvider = provider;
}

/**
 * Builds a query string from primitive values and arrays.
 * Null and undefined values are skipped to preserve existing API defaults.
 *
 * @param {Record<string, unknown>} params
 * @returns {string}
 */
export function buildQueryString(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item != null && item !== '') query.append(key, item);
      });
      return;
    }
    query.set(key, value);
  });

  return query.toString();
}

/**
 * Resolves relative API paths against the configured API base URL.
 *
 * @param {string} path
 * @param {Record<string, unknown>} [query]
 * @returns {string}
 */
export function buildUrl(path, query) {
  const base = API_BASE_URL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const qs = query ? buildQueryString(query) : '';
  return `${base}${normalizedPath}${qs ? `?${qs}` : ''}`;
}

/**
 * Future websocket compatibility helper. This does not open a connection; it
 * only converts the configured HTTP API URL into a ws/wss URL for callers.
 *
 * @param {string} path
 * @param {Record<string, unknown>} [query]
 * @returns {string}
 */
export function buildWebSocketUrl(path, query) {
  const url = new URL(buildUrl(path, query));
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      throw new ApiError('Backend returned invalid JSON', {
        status: response.status,
        statusText: response.statusText,
        data: text,
        code: 'INVALID_JSON',
      });
    }
  }

  return text;
}

function getErrorMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.detail?.message === 'string') return data.detail.message;
  return fallback;
}

async function buildHeaders(headers, body) {
  const finalHeaders = new Headers(headers || {});

  if (body !== undefined && !(body instanceof FormData) && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  if (!finalHeaders.has('Accept')) {
    finalHeaders.set('Accept', 'application/json');
  }

  if (authTokenProvider) {
    const token = await authTokenProvider();
    if (token && !finalHeaders.has('Authorization')) {
      finalHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  return finalHeaders;
}

/**
 * Executes an HTTP request with timeout, JSON parsing, normalized errors, and
 * future auth header support.
 *
 * @template T
 * @param {string} method
 * @param {string} path
 * @param {{ query?: Record<string, unknown>, body?: unknown, headers?: HeadersInit, timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<T>}
 */
export async function request(method, path, options = {}) {
  const { query, body, headers, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
  const url = buildUrl(path, query);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const fetchBody = body instanceof FormData || typeof body === 'string'
    ? body
    : body === undefined
      ? undefined
      : JSON.stringify(body);

  try {
    const response = await fetch(url, {
      method,
      headers: await buildHeaders(headers, body),
      body: fetchBody,
      signal: controller.signal,
    });

    const data = await parseResponse(response);

    if (!response.ok) {
      throw new ApiError(getErrorMessage(data, `HTTP ${response.status}`), {
        status: response.status,
        statusText: response.statusText,
        data,
        url,
        method,
        code: 'HTTP_ERROR',
      });
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out - the server took too long to respond', {
        url,
        method,
        code: 'TIMEOUT',
      });
    }

    throw new ApiError(error.message || 'Failed to connect to the server', {
      url,
      method,
      code: 'NETWORK_ERROR',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * @template T
 * @param {string} path
 * @param {{ query?: Record<string, unknown>, headers?: HeadersInit, timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<T>}
 */
export function GET(path, options) {
  return request('GET', path, options);
}

/**
 * @template T
 * @param {string} path
 * @param {unknown} [body]
 * @param {{ query?: Record<string, unknown>, headers?: HeadersInit, timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<T>}
 */
export function POST(path, body, options = {}) {
  return request('POST', path, { ...options, body });
}

/**
 * @template T
 * @param {string} path
 * @param {unknown} [body]
 * @param {{ query?: Record<string, unknown>, headers?: HeadersInit, timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<T>}
 */
export function PUT(path, body, options = {}) {
  return request('PUT', path, { ...options, body });
}

/**
 * @template T
 * @param {string} path
 * @param {{ query?: Record<string, unknown>, headers?: HeadersInit, timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<T>}
 */
export function DELETE(path, options) {
  return request('DELETE', path, options);
}
