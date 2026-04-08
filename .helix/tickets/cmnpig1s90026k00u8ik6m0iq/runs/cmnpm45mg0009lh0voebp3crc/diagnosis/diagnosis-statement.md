# Diagnosis Statement — hx-cli

## Problem Summary

The hx-cli is the interface agents use to execute runtime inspection queries. The **deployed npm package** `@projectxinnovation/helix-cli@1.2.0` contains the **pre-hardening code** — no retry, no timeout, `process.exit(1)` on any error. The hardened version with full retry logic exists in the source repository but was never published.

## Root Cause Analysis

### CLI hardening never published

The source code at `src/lib/http.ts` has comprehensive hardening:
- `MAX_ATTEMPTS = 3` with exponential backoff + jitter
- `REQUEST_TIMEOUT_MS = 30_000` via `AbortSignal.timeout`
- `RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504]`
- HTML error page detection with user-friendly messages
- 429 Retry-After header support

But the deployed binary at `node_modules/@projectxinnovation/helix-cli/dist/lib/http.js` has:
```javascript
const response = await fetch(url.toString(), { method, headers, body });
if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`Error: HTTP ${response.status} ${response.statusText}${text ? ` — ${text.slice(0, 500)}` : ""}`);
    process.exit(1);
}
```

Both `package.json` files show version `1.2.0` — the version was bumped in source but the package was never rebuilt and republished.

### Dependency on server fix

Even if the CLI retry logic were deployed, the server's error handling bug (see helix-global-server diagnosis) means all query errors produce opaque HTML 502/504 responses. The CLI would retry these 3 times, waiting ~7 seconds total, and still get the same error. The server must be fixed first to return proper JSON error responses.

## Evidence Summary

| Evidence | Finding |
|----------|---------|
| Deployed `dist/lib/http.js` | Single fetch(), process.exit(1), no retry, no timeout |
| Source `src/lib/http.ts` | Full retry logic with 3 attempts, 30s timeout, backoff |
| Package version | Both show 1.2.0 — source bumped but never published |
| `hlx inspect db` timing | 310ms total (250ms Node startup + 80ms single request) |
| Direct curl timing | 80ms for 504 response — confirms no retry happening |

## Success Criteria

1. The deployed CLI package contains the hardened `http.ts` with retry logic
2. CLI properly retries on 429/500/502/503/504 with exponential backoff
3. CLI has 30s per-request timeout via AbortSignal.timeout
4. CLI shows meaningful error messages (not raw HTML)
5. **Prerequisite**: Server must return JSON errors (not 502) for CLI retries to be useful

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| scout/reference-map.json (hx-cli) | Source code architecture | Source has retry but deployed doesn't |
| scout/scout-summary.md (hx-cli) | Full CLI analysis | Version 1.2.0 in both source and deployed |
| Deployed dist/lib/http.js | Actual running code | No retry, no timeout, process.exit(1) |
| Source src/lib/http.ts | Intended code | Full retry logic present |
| Runtime: hlx timing analysis | Prove no retry | 310ms total = single request + Node startup |
| Runtime: curl timing | Baseline | 80ms for single 504 response |
| helix-global-server diagnosis | Cross-repo dependency | Server must be fixed first for CLI retries to help |
