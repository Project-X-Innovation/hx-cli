import type { HxConfig } from "./config.js";

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 30_000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableResponse(response: Response): boolean {
  return RETRYABLE_STATUS_CODES.has(response.status);
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError) return true; // network failure from fetch
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return true;
  }
  return false;
}

function backoffDelay(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
}

async function buildErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    return `Server returned an HTML error page (HTTP ${response.status}). The request may have timed out or the service may be temporarily unavailable.`;
  }
  const text = await response.text().catch(() => "");
  return `HTTP ${response.status} ${response.statusText}${text ? ` — ${text.slice(0, 500)}` : ""}`;
}

export async function hxFetch(
  config: HxConfig,
  path: string,
  options: { method?: string; body?: Record<string, unknown>; queryParams?: Record<string, string> } = {},
): Promise<unknown> {
  const method = options.method ?? "GET";
  const url = new URL(`${config.url}/api/inspect${path}`);

  if (options.queryParams) {
    for (const [key, value] of Object.entries(options.queryParams)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {};
  if (config.apiKey.startsWith("hxi_")) {
    headers["X-API-Key"] = config.apiKey;
  } else {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  let body: string | undefined;
  if (options.body) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.ok) {
        return response.json();
      }

      // Handle 429 Retry-After
      if (response.status === 429 && attempt < MAX_ATTEMPTS) {
        const retryAfter = response.headers.get("Retry-After");
        const retryMs = retryAfter
          ? Math.min(Number(retryAfter) * 1000, 60_000)
          : backoffDelay(attempt);
        const delay = Number.isFinite(retryMs) && retryMs > 0 ? retryMs : backoffDelay(attempt);
        await sleep(delay);
        continue;
      }

      // Retryable status code — retry if not last attempt
      if (isRetryableResponse(response) && attempt < MAX_ATTEMPTS) {
        await sleep(backoffDelay(attempt));
        continue;
      }

      // Non-retryable or last attempt — throw with clear message
      const message = await buildErrorMessage(response);
      throw new Error(message);
    } catch (error) {
      lastError = error;

      // If it's already our formatted error, don't wrap it again
      if (error instanceof Error && !(error instanceof TypeError) && error.name !== "TimeoutError" && error.name !== "AbortError") {
        // This is our own thrown error from buildErrorMessage, or some other non-network error
        if (attempt === MAX_ATTEMPTS || !isRetryableError(error)) {
          throw error;
        }
      }

      // Network/timeout error — retry if possible
      if (isRetryableError(error) && attempt < MAX_ATTEMPTS) {
        await sleep(backoffDelay(attempt));
        continue;
      }

      // Last attempt or non-retryable
      if (error instanceof Error) {
        if (error.name === "TimeoutError" || error.name === "AbortError") {
          throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds. The server may be unavailable.`);
        }
        throw error;
      }
      throw new Error(String(error));
    }
  }

  // Unreachable, but satisfies TypeScript
  throw lastError;
}
