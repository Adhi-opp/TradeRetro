# Frontend Services

This folder contains the frontend service layer for TradeRetro.

The services are intentionally not wired into existing components yet. Current
component imports and request/response contracts remain unchanged.

## Organization

- `apiClient.js`
  - Shared low-level HTTP client.
  - Reads the backend URL from `import.meta.env.VITE_API_URL`.
  - Exposes `GET`, `POST`, `PUT`, and `DELETE`.
  - Handles timeouts, JSON parsing, normalized errors, headers, future auth,
    and future websocket URL compatibility.

- `backtestService.js`
  - Backtest domain endpoints.
  - Wraps standard backtest, parameter sweep, and walk-forward analysis.

- `marketService.js`
  - Market-facing endpoints.
  - Wraps signals, live quotes, prices, VIX, and cross-asset correlation APIs.

- `pipelineService.js`
  - Infrastructure and data operations endpoints.
  - Wraps health, pipeline, quality, universe, ingestion, and reconciliation APIs.

## Adding Future Services

Create one service file per backend domain:

```text
src/services/
  authService.js
  portfolioService.js
  alertsService.js
```

Guidelines:

- Import only from `apiClient.js`.
- Preserve backend request and response shapes.
- Name functions by user intent, not transport detail.
- Keep components unaware of endpoint strings.
- Keep endpoint-specific query/body construction inside service functions.
- Use JSDoc for payloads, options, and return values.

Example:

```js
import { GET } from './apiClient';

/**
 * Fetches a resource by ID.
 *
 * @param {string} id
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getResource(id, options) {
  return GET(`/api/resources/${encodeURIComponent(id)}`, options);
}
```

## Component Consumption

When migration begins, components should call domain services instead of using
`fetch` directly:

```js
import { runBacktest } from '../services/backtestService';

const result = await runBacktest(payload);
```

Migration should be incremental:

1. Move one component or store action at a time.
2. Keep the payload exactly the same.
3. Keep the response handling exactly the same.
4. Verify the screen before moving another endpoint.

## Environment

Set the backend API URL in Vite environment config:

```text
VITE_API_URL=http://localhost:8000
```

`apiClient.js` includes a localhost fallback for local development, but deployed
environments should always provide `VITE_API_URL`.
