/**
 * Resolve the public origin Better Auth must use for OAuth `redirect_uri`.
 *
 * Live preview is proxied: the browser is on `https://*.grok-sandbox.com` while
 * Vite often sees `Host: 127.0.0.1:8080`. Without a trustworthy public host,
 * dynamic `baseURL` falls back to `http://localhost:8080`, and the broker's
 * `grok_preview` client rejects that redirect (`Invalid redirect URI`).
 *
 * Prefer (in order):
 *   1. Explicit `origin` query (popup client passes `window.location.origin`)
 *   2. `x-forwarded-host` + `x-forwarded-proto`
 *   3. Request URL / Host (when already the public host)
 *
 * Only HTTPS preview hosts (and loopback for local email/password) are accepted
 * from the query param — never an arbitrary attacker-controlled origin.
 */
import {
  GROK_ISSUER_DEFAULT,
  PREVIEW_ALLOWED_HOSTS,
} from "./preview";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function hostnameOf(hostOrUrl: string): string | null {
  const raw = hostOrUrl.trim();
  if (!raw) return null;
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when hostname matches a `*.grok-sandbox.com` (or exact) allowlist entry. */
export function isPreviewAllowedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return false;
  for (const pattern of PREVIEW_ALLOWED_HOSTS) {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1); // ".grok-sandbox.com"
      if (host.endsWith(suffix) && host.length > suffix.length) return true;
      continue;
    }
    if (host === pattern.toLowerCase()) return true;
  }
  return false;
}

export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return LOOPBACK_HOSTS.has(host) || host.endsWith(".localhost");
}

/**
 * Parse and validate an explicit public origin (from the popup query).
 * Returns a canonical `https://host` (no path/trailing slash) or null.
 */
export function parseTrustedPublicOrigin(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    // Preview OAuth must use the broker-allowlisted sandbox host over HTTPS.
    if (isPreviewAllowedHostname(host)) {
      if (url.protocol !== "https:") return null;
      return `https://${host}`;
    }
    // Loopback is never a valid grok_preview redirect_uri — reject so callers
    // can surface a clear error instead of hitting the broker.
    if (isLoopbackHostname(host)) return null;
    return null;
  } catch {
    return null;
  }
}

export type ResolvedPublicOrigin = {
  /** Canonical origin, e.g. `https://abc.grok-sandbox.com`. */
  origin: string;
  /** How it was derived (for logs / errors). */
  source: "query" | "forwarded" | "request";
};

/**
 * Pick the public origin for OAuth redirect_uri construction.
 * `queryOrigin` is the optional `origin` search param from `/auth/popup`.
 */
export function resolvePublicAuthOrigin(
  request: Request,
  queryOrigin?: string | null,
): ResolvedPublicOrigin | null {
  const fromQuery = parseTrustedPublicOrigin(queryOrigin);
  if (fromQuery) return { origin: fromQuery, source: "query" };

  const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const xfProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (xfHost) {
    const host = hostnameOf(xfHost);
    if (host && isPreviewAllowedHostname(host)) {
      const proto = xfProto === "http" ? "http" : "https";
      // Preview must be https toward the broker allowlist.
      return { origin: `https://${host}`, source: "forwarded" };
    }
  }

  try {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    if (isPreviewAllowedHostname(host)) {
      return { origin: `https://${host}`, source: "request" };
    }
    const headerHost = request.headers.get("host");
    const headerHostname = headerHost ? hostnameOf(headerHost) : null;
    if (headerHostname && isPreviewAllowedHostname(headerHostname)) {
      return { origin: `https://${headerHostname}`, source: "request" };
    }
  } catch {
    /* ignore */
  }

  return null;
}

/** Human-readable hint when OAuth cannot start from loopback with the preview client. */
export function loopbackPreviewOauthMessage(): string {
  return (
    "Google / X sign-in needs the live preview URL (https://*.grok-sandbox.com), " +
    "not http://localhost. Open the app from the Grok live preview, then retry."
  );
}

export { GROK_ISSUER_DEFAULT };
