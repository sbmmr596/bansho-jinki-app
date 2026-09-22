/**
 * Live-preview sign-in popup — server-only (NEVER import from the client).
 *
 * The sandbox preview runs the app in a partitioned iframe, so OAuth must happen
 * in a top-level popup (first-party cookies). This handler is the ENTIRE popup
 * document — no React shell:
 *
 *   Phase 1 (`?providerId=…`): start OAuth server-side and 302 straight to the
 *     broker / upstream login page. The popup never paints the app.
 *   Phase 2 (`?done=1`): after the broker round-trip, emit a tiny HTML page that
 *     posts the session token to the opener and closes. No SPA hydrate, no
 *     server-fn round-trip.
 *
 * Wired automatically by the Vite `authPopupPlugin` in `vite.config.ts` during
 * `npm run dev` (live preview). Do NOT create `src/routes/auth/popup.tsx` — a
 * React route here paints the full app shell in the popup. The opener lives in
 * `client.ts` (`signIn` → `openSignInPopup`).
 */
import { auth, SESSION_TOKEN_COOKIE } from "./server";
import {
  isLoopbackHostname,
  loopbackPreviewOauthMessage,
  resolvePublicAuthOrigin,
} from "./public-origin.server";

/** Message shape the popup posts to the opener (must match `client.ts`). */
type PopupMessage = {
  source: "grok-auth-popup";
  token: string | null;
  error?: string;
};

/**
 * Handle `GET /auth/popup`. Invoked by the Vite `authPopupPlugin` (dev / live
 * preview). Do not re-export this from a React route file.
 */
export async function handleAuthPopupRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const done = url.searchParams.get("done") === "1";

  if (done) {
    const errored = url.searchParams.has("error");
    const token = errored ? null : readCookie(request, SESSION_TOKEN_COOKIE);
    const message: PopupMessage = {
      source: "grok-auth-popup",
      token,
      ...(errored ? { error: url.searchParams.get("error") ?? "sign_in_failed" } : {}),
    };
    return new Response(completionHtml(message), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        // Never cache a page that embeds a session token.
        "cache-control": "no-store",
      },
    });
  }

  const providerId = url.searchParams.get("providerId")?.trim();
  if (!providerId) {
    return new Response("Missing providerId", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Public preview origin for redirect_uri — see `public-origin.server.ts`.
  const resolved = resolvePublicAuthOrigin(request, url.searchParams.get("origin"));
  if (!resolved) {
    let requestHost = "";
    try {
      requestHost = new URL(request.url).hostname;
    } catch {
      requestHost = request.headers.get("host") ?? "";
    }
    const hostOnly = requestHost.split(":")[0] ?? requestHost;
    const message = isLoopbackHostname(hostOnly)
      ? loopbackPreviewOauthMessage()
      : "Could not resolve a broker-allowlisted preview origin for OAuth redirect_uri.";
    return completionResponse({
      source: "grok-auth-popup",
      token: null,
      error: message,
    });
  }

  const publicOrigin = resolved.origin;
  // Stay first-party for the callback so the session cookie lands in THIS popup.
  const back = `${publicOrigin}/auth/popup?done=1`;
  try {
    // Rebuild headers so Better Auth's dynamic baseURL uses the public host
    // (not the proxied loopback Host).
    const publicHost = new URL(publicOrigin).host;
    const headers = new Headers(request.headers);
    headers.set("host", publicHost);
    headers.set("x-forwarded-host", publicHost);
    headers.set("x-forwarded-proto", "https");

    const apiRes = await auth.api.signInWithOAuth2({
      body: {
        providerId,
        callbackURL: back,
        errorCallbackURL: `${back}&error=1`,
      },
      headers,
      asResponse: true,
    });

    if (!apiRes.ok) {
      const detail = await apiRes.text().catch(() => "");
      return completionResponse({
        source: "grok-auth-popup",
        token: null,
        error: detail || `oauth_init_failed_${apiRes.status}`,
      });
    }

    const body = (await apiRes.json().catch(() => null)) as {
      url?: string;
    } | null;
    const location = body?.url;
    if (!location) {
      return completionResponse({
        source: "grok-auth-popup",
        token: null,
        error: "oauth_init_missing_url",
      });
    }

    // Guard: never send the user to the broker with a loopback redirect_uri.
    try {
      const brokerUrl = new URL(location);
      const redirectUri = brokerUrl.searchParams.get("redirect_uri") ?? "";
      const redirectHost = redirectUri ? new URL(redirectUri).hostname : "";
      if (redirectHost && isLoopbackHostname(redirectHost)) {
        return completionResponse({
          source: "grok-auth-popup",
          token: null,
          error: loopbackPreviewOauthMessage(),
        });
      }
    } catch {
      /* if we can't parse, still 302 — broker will reject bad URIs */
    }

    // 302 to the broker (which headlessly forwards to Google/X). Forward any
    // Set-Cookie (OAuth state / PKCE) so the callback can complete in this popup.
    const outHeaders = new Headers({ location, "cache-control": "no-store" });
    for (const cookie of apiRes.headers.getSetCookie()) {
      outHeaders.append("set-cookie", cookie);
    }
    return new Response(null, { status: 302, headers: outHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_init_threw";
    return completionResponse({
      source: "grok-auth-popup",
      token: null,
      error: message,
    });
  }
}

function completionResponse(message: PopupMessage): Response {
  return new Response(completionHtml(message), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** Minimal HTML: postMessage the token to the opener and close. No React. */
function completionHtml(message: PopupMessage): string {
  // JSON is safe inside a <script type="application/json"> block; the inline
  // script only reads it. Avoids escaping pitfalls of embedding in JS source.
  const payload = JSON.stringify(message).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Signing in…</title>
<style>
  html,body{margin:0;min-height:100%;background:#0b0b0c;color:#a1a1aa;
    font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  main{min-height:100vh;display:grid;place-items:center;padding:1.5rem;text-align:center}
</style>
</head>
<body>
<main><p>Signing you in…</p></main>
<script type="application/json" id="grok-auth-popup-msg">${payload}</script>
<script>
(function () {
  var el = document.getElementById("grok-auth-popup-msg");
  var msg = { source: "grok-auth-popup", token: null };
  try { if (el && el.textContent) msg = JSON.parse(el.textContent); } catch (e) {}
  // Retry a few times: the opener may still be awaiting pre-sign-in sign-out
  // before its message listener is attached (iPhone Safari + fast SSO).
  var tries = 0;
  function post() {
    tries += 1;
    try {
      if (window.opener) window.opener.postMessage(msg, window.location.origin);
    } catch (e) {}
    if (tries < 5) {
      setTimeout(post, 120);
      return;
    }
    try { window.close(); } catch (e) {}
  }
  post();
})();
</script>
</body>
</html>`;
}

/** Read a single cookie value from the request (handles `=` inside values). */
function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    const raw = trimmed.slice(eq + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}
