import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { runPreSignInSignOut, runSignOut } from "../../../scripts/sign-out-plan.mjs";
import { GROK_PROVIDERS } from "./providers";
import { PREVIEW_BEARER_STORAGE_KEY } from "./preview-bearer";
import { SESSION_REFETCH_TIMEOUT_MS, withTimeout } from "./session-resolve";

/**
 * Better Auth client for this React SPA (browser-side).
 *
 * Talks to this app's OWN Better Auth at same-origin `/api/auth/*`. In the live
 * preview the app is an embedded iframe with PARTITIONED cookies, so after a
 * popup sign-in it can't read the session cookie — it authenticates with a
 * bearer token instead (captured from the popup, see `signIn`). The `onRequest`
 * hook attaches that token when present; when deployed (cookie auth) no token
 * is stored, so nothing changes.
 *
 * To sign out call `signOut()` below, NOT `authClient.signOut()`: the raw call
 * leaves the bearer token in place, and `onRequest` keeps re-attaching it, so
 * the visitor stays signed in.
 */
export const authClient = createAuthClient({
  plugins: [genericOAuthClient()],
  fetchOptions: {
    onRequest(ctx) {
      const token = getBearerToken();
      if (token) ctx.headers.set("Authorization", `Bearer ${token}`);
      return ctx;
    },
  },
});

/**
 * True when sign-in UI should be shown — i.e. whenever `VITE_AUTH_ENABLED` is
 * not `"false"`. The shipped template sets it to `"false"`
 * (`.grok/app-env.json`), which selects the dev user (see `use-current-user`);
 * with the key removed, sign-in is real in preview (baked preview client) and
 * when deployed (injected per-app client).
 */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

/** The upstream providers to render sign-in buttons for. */
export { GROK_PROVIDERS };

// ── Live-preview bearer token ────────────────────────────────────────────────
// The embedded preview iframe has partitioned cookies, so we keep the session's
// bearer token in memory AND sessionStorage, then attach it to every Better Auth
// request (and to server functions, via `@/lib/auth/middleware`). Memory covers
// iPhone Safari / ITP cases where sessionStorage throws or is ephemeral inside
// a cross-site iframe; storage survives same-tab reloads when it works. Empty
// everywhere except the preview after a popup sign-in, so the cookie path is
// untouched elsewhere.
const BEARER_KEY = PREVIEW_BEARER_STORAGE_KEY;

/** In-memory copy — `undefined` means "not hydrated from storage yet". */
let bearerMemory: string | null | undefined;

/** Epoch ms when a non-null bearer was last applied (gate grace). */
let bearerAppliedAt: number | null = null;

const bearerListeners = new Set<() => void>();

function notifyBearerListeners(): void {
  for (const listener of bearerListeners) listener();
}

/** Subscribe to preview-bearer apply/clear (for gate grace UI). */
export function subscribePreviewBearer(listener: () => void): () => void {
  bearerListeners.add(listener);
  return () => {
    bearerListeners.delete(listener);
  };
}

/** Snapshot for gates: token present + when it was applied. */
export function getPreviewBearerMeta(): {
  hasBearer: boolean;
  appliedAt: number | null;
} {
  return {
    hasBearer: Boolean(getBearerToken()),
    appliedAt: bearerAppliedAt,
  };
}

function readBearerFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(BEARER_KEY);
  } catch {
    return null;
  }
}

/**
 * Re-read sessionStorage into memory. Needed when the popup completion page
 * writes the opener's sessionStorage directly after we cleared memory to null.
 */
export function syncBearerFromStorage(): string | null {
  const token = readBearerFromStorage();
  if (token) {
    bearerMemory = token;
    if (bearerAppliedAt == null) bearerAppliedAt = Date.now();
  } else if (bearerMemory) {
    // Storage empty but memory still has a token (ITP wiped storage) — keep memory.
    return bearerMemory;
  } else {
    bearerMemory = null;
  }
  return bearerMemory ?? null;
}

/** The stored preview bearer token, or null. */
export function getBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  if (bearerMemory !== undefined) return bearerMemory;
  try {
    bearerMemory = window.sessionStorage.getItem(BEARER_KEY);
  } catch {
    bearerMemory = null;
  }
  return bearerMemory;
}

function setBearerToken(token: string | null): void {
  bearerMemory = token;
  if (token) bearerAppliedAt = Date.now();
  else bearerAppliedAt = null;
  if (typeof window === "undefined") {
    notifyBearerListeners();
    return;
  }
  try {
    if (token) window.sessionStorage.setItem(BEARER_KEY, token);
    else window.sessionStorage.removeItem(BEARER_KEY);
  } catch {
    /* storage unavailable — memory still holds the token for this page life */
  }
  notifyBearerListeners();
}

/**
 * Refresh the Better Auth `useSession()` atom after a popup sets the bearer.
 * Plain `getSession()` does NOT notify `$sessionSignal` (matcher skips
 * `/get-session`), so without this the UI can stay signed-out until a flaky
 * focus refetch — common when the OAuth popup closes over an iframe on iOS.
 */
async function refreshSessionAtom(): Promise<void> {
  const sessionAtom = authClient.$store.atoms.session;
  const refetch = sessionAtom?.get()?.refetch as
    | ((queryParams?: { query?: Record<string, string> }) => Promise<void>)
    | undefined;
  const run =
    typeof refetch === "function"
      ? () => refetch()
      : async () => {
          authClient.$store.notify("$sessionSignal");
          await authClient.getSession();
        };
  // Bound the wait: a hung /get-session after popup would leave signIn()
  // awaiting forever while the card editor stays on 「セッションを確認…」.
  // Bearer is already stored; the UI timeout in useCurrentUserState also
  // falls back to the gate if the atom never clears pending.
  await withTimeout(run(), SESSION_REFETCH_TIMEOUT_MS, "session refetch");
}

/**
 * When the app becomes visible again after OAuth (popup close / WebView sheet
 * dismiss / bfcache restore), re-sync any bearer the completion page stashed
 * and refetch the session atom. Without this, iPhone often returns to
 * Continue with Google even though auth completed on auth.grok.me.
 */
let resumeInstalled = false;
let resumeInFlight: Promise<void> | null = null;

async function resumePreviewSessionFromBearer(): Promise<void> {
  if (!inLivePreview()) return;
  const token = syncBearerFromStorage();
  if (!token) return;
  notifyBearerListeners();
  if (resumeInFlight) return resumeInFlight;
  resumeInFlight = (async () => {
    try {
      await refreshSessionAtom();
    } catch {
      /* keep bearer; next visibility retries */
    } finally {
      resumeInFlight = null;
    }
  })();
  return resumeInFlight;
}

function installPreviewAuthResume(): void {
  if (resumeInstalled || typeof window === "undefined") return;
  if (!inLivePreview()) return;
  resumeInstalled = true;
  const onReturn = () => {
    void resumePreviewSessionFromBearer();
  };
  window.addEventListener("pageshow", onReturn);
  window.addEventListener("focus", onReturn);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") onReturn();
  });
  // Cold load after same-window OAuth redirect home with token in sessionStorage.
  void resumePreviewSessionFromBearer();
}

/**
 * The sandbox live preview runs this app inside an iframe on a `*.grok-sandbox.com`
 * host, where a full-page redirect to the broker can't work — so sign-in uses a
 * popup there and a normal redirect everywhere else.
 */
function inLivePreview(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".grok-sandbox.com")
  );
}

/** Message the popup posts back to the opener once sign-in completes. */
type PopupMessage = { source: "grok-auth-popup"; token: string | null; error?: string };

/**
 * Start sign-in with one upstream provider (`providerId` from `GROK_PROVIDERS`),
 * federating through the Grok auth broker.
 *
 * - **Live preview** (`*.grok-sandbox.com` iframe): opens a POPUP to
 *   `/auth/popup`, served by the template Vite plugin (see `vite.config.ts` +
 *   `popup.server.ts`) — 302s to the broker/upstream login (no app chrome) and,
 *   on return, posts the session bearer token back. We store it and refresh the
 *   session; no top-level navigation of the iframe to the broker.
 * - **Deployed** (and local non-iframe): a normal full-page redirect into the broker.
 *
 * Either way it clears any existing local session FIRST so switching providers
 * actually switches identity.
 */
export async function signIn(
  providerId: string,
  opts: { callbackURL?: string; errorCallbackURL?: string } = {},
): Promise<void> {
  const callbackURL = opts.callbackURL ?? "/";
  const errorCallbackURL = opts.errorCallbackURL ?? "/";

  installPreviewAuthResume();

  // Open the popup SYNCHRONOUSLY on the user gesture — before any await
  // (including signOut). Awaiting first drops user-gesture privilege in some
  // browsers when the opener is a cross-origin live-preview iframe.
  const popup = inLivePreview() ? openSignInPopup(providerId) : null;
  const sameWindow = Boolean(popup && popup === window);
  // Attach the message listener BEFORE awaiting pre-sign-in sign-out.
  // Fast Google SSO (already signed-in on iPhone Safari) often postMessages
  // and closes within ~1s — the same window as PREVIEW_SIGN_OUT_TIMEOUT_MS —
  // so listening only after clear would miss the token and leave the card
  // editor on Continue with Google/X after a "successful" popup.
  // Skip for same-window OAuth (this document is navigating away).
  const popupToken = popup && !sameWindow ? waitForPopupToken(popup) : null;

  // Clear any prior session so switching providers actually switches identity.
  // Bounded because the popup is already open — a request that never settles
  // would leave it hanging — but bounded PER ENVIRONMENT: only the server can
  // end a deployed session, so cutting it short at the preview's 1.5s would
  // start OAuth with the old session still live.
  await runPreSignInSignOut({
    livePreview: inLivePreview(),
    hasBearer: Boolean(getBearerToken()),
    requestSignOut: () => authClient.signOut(),
    clearToken: () => setBearerToken(null),
  });

  // Same-window navigation (some iPhone WebViews): this document is leaving.
  // Completion page stashes the bearer in sessionStorage and redirects home.
  if (sameWindow) return;

  if (inLivePreview()) {
    if (!popup || !popupToken) throw new Error("Pop-up blocked — allow pop-ups for sign-in");
    const token = await popupToken;
    if (!token) throw new Error("Sign-in was cancelled or failed");
    setBearerToken(token);
    // Refresh useSession() atomically with the bearer attached (onRequest).
    // Avoid a full iframe reload when we're already on the destination — that
    // reload was the slow "still loading after the popup closed" feeling.
    try {
      await refreshSessionAtom();
    } catch {
      /* session store will recover on next useSession fetch */
    }
    if (typeof window !== "undefined") {
      const dest = new URL(callbackURL, window.location.origin);
      const here = window.location;
      if (dest.origin !== here.origin || dest.pathname !== here.pathname || dest.search !== here.search) {
        window.location.href = callbackURL;
      }
    }
    return;
  }

  // grok_preview only allows https://*.grok-sandbox.com/... redirect_uris.
  // Starting OAuth from loopback always yields Invalid redirect URI at the broker.
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
    throw new Error(
      "Google / X sign-in needs the live preview URL (https://*.grok-sandbox.com), " +
        "not http://localhost. Open the app from the Grok live preview, then retry.",
    );
  }

  const { data, error } = await authClient.signIn.oauth2({
    providerId,
    callbackURL,
    errorCallbackURL,
  });
  if (error) throw new Error(error.message ?? "Sign-in failed");
  if (data?.url) window.location.href = data.url;
}

/**
 * Open `/auth/popup` in a new window. Must run synchronously inside the click
 * handler (no await before this). The path is served by the template Vite
 * plugin (`authPopupPlugin` in vite.config.ts) — NOT by a React route.
 *
 * Opens the real URL directly (not about:blank → assign). From a cross-origin
 * iframe the about:blank dance often fails on the first click and the window
 * ends up showing the app shell.
 */
function openSignInPopup(providerId: string): Window | null {
  const origin = window.location.origin;
  // Pass the browser origin explicitly: the preview proxy may present Vite with
  // Host=127.0.0.1 and no X-Forwarded-Host, which would otherwise make Better
  // Auth emit redirect_uri=http://localhost:8080/... (rejected by the broker).
  const url =
    `${origin}/auth/popup?providerId=${encodeURIComponent(providerId)}` +
    `&origin=${encodeURIComponent(origin)}`;
  // Unique name per attempt so a prior attempt stuck on the SPA is not reused.
  const name = `grok-signin-${Date.now()}`;
  return window.open(url, name, "popup,width=500,height=650");
}

/**
 * Wait for the popup's completion page to postMessage the session bearer (or
 * for the user to dismiss the popup). Also polls sessionStorage: the completion
 * page writes the opener's storage when postMessage is unreliable (iPhone).
 */
function waitForPopupToken(popup: Window): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const origin = window.location.origin;
    let settled = false;
    let closeTimer: number | undefined;
    const settle = (token: string | null, error?: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      // Prefer the popup's explicit error over a generic cancel/fail message.
      if (!token && error) {
        reject(new Error(error));
        return;
      }
      resolve(token);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as PopupMessage | undefined;
      if (!data || data.source !== "grok-auth-popup") return;
      settle(data.token ?? null, data.error);
    };
    // Fallback when the user dismisses the popup. Grace period lets the
    // completion page's postMessage (or sessionStorage write) win over a
    // racing `popup.closed`.
    const pollTimer = window.setInterval(() => {
      const fromStorage = syncBearerFromStorage();
      if (fromStorage) {
        settle(fromStorage);
        return;
      }
      if (!popup.closed) return;
      window.clearInterval(pollTimer);
      closeTimer = window.setTimeout(() => {
        const stored = syncBearerFromStorage();
        settle(stored);
      }, 600);
    }, 250);
    function cleanup() {
      window.clearInterval(pollTimer);
      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
      window.removeEventListener("message", onMessage);
    }
    window.addEventListener("message", onMessage);
  });
}

/**
 * Sign out of THIS app's local session, clear the preview token, then redirect.
 *
 * Use this, never `authClient.signOut()` — see the note on `authClient`.
 * Sequencing lives in `scripts/sign-out-plan.mjs` so it can be unit-tested.
 *
 * **Rejects when deployed if the server never confirms.** There the session is
 * an HttpOnly cookie only the server can clear, so redirecting anyway would
 * report a sign-out that did not happen. `<UserButton />` handles that for you;
 * a hand-rolled control must catch it and let the visitor retry. In the live
 * preview the local clear is sufficient, so it always resolves.
 */
export async function signOut(redirectTo = "/"): Promise<void> {
  await runSignOut({
    livePreview: inLivePreview(),
    hasBearer: Boolean(getBearerToken()),
    // Better Auth resolves with `{ error }` instead of rejecting, so surface a
    // failed response as a rejection for the sequence to act on.
    requestSignOut: async () => {
      const { error } = await authClient.signOut();
      if (error) throw new Error(error.message ?? "Sign-out failed");
    },
    clearToken: () => setBearerToken(null),
    redirect: () => {
      window.location.href = redirectTo;
    },
  });
}

// Install resume hooks as soon as this module loads in the browser preview so a
// same-window OAuth return (token already in sessionStorage) refreshes session
// without requiring another Continue with tap.
if (typeof window !== "undefined") {
  installPreviewAuthResume();
}
