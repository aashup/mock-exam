import axios from 'axios';

/**
 * Dev-only logging for AI provider calls. Logs the outgoing request and the
 * incoming response/error to the Metro console so you can debug generation
 * issues. No-op in release builds. API keys are NEVER logged — URLs are
 * redacted and auth headers stripped before printing.
 */

/** Strips a `key=...` query param and truncates long bodies for readability. */
function redactUrl(url: string): string {
  return url.replace(/([?&]key=)[^&]+/i, '$1***REDACTED***');
}

function preview(value: unknown, max = 4000): string {
  let str: string;
  try {
    str = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch {
    str = String(value);
  }
  return str.length > max ? `${str.slice(0, max)}… [truncated ${str.length - max} chars]` : str;
}

export const aiLogger = {
  request(provider: string, url: string, body: unknown): void {
    if (!__DEV__) {
      return;
    }
    console.log(
      `[AI:${provider}] → request\n  url: ${redactUrl(url)}\n  body: ${preview(body)}`,
    );
  },

  response(provider: string, status: number, data: unknown): void {
    if (!__DEV__) {
      return;
    }
    console.log(`[AI:${provider}] ← response ${status}\n  data: ${preview(data)}`);
  },

  /** Logs a failed call, surfacing the HTTP status + response body when present. */
  error(provider: string, err: unknown): void {
    if (!__DEV__) {
      return;
    }
    if (axios.isAxiosError(err)) {
      console.log(
        `[AI:${provider}] ✗ error ${err.response?.status ?? '(no status)'}\n` +
          `  message: ${err.message}\n` +
          `  body: ${preview(err.response?.data)}`,
      );
    } else {
      console.log(`[AI:${provider}] ✗ error\n  ${preview(err)}`);
    }
  },
};
