/**
 * Live-preview bearer token storage key + gate grace.
 *
 * The popup completion page (`popup.server.ts`) and the SPA (`client.ts`) must
 * use the SAME key: the completion page writes the session token into the
 * opener's sessionStorage (or its own, then redirects home) when postMessage
 * is lost — common on iPhone Safari / Grok WebView where the "popup" is not a
 * durable window.opener relationship.
 */
export const PREVIEW_BEARER_STORAGE_KEY = "grok-auth.bearer-token";

/**
 * After a fresh bearer is applied, keep the sign-in gate on "pending" this long
 * while /get-session catches up — avoids bouncing to Continue with Google when
 * the token landed but the session atom has not yet.
 */
export const PREVIEW_BEARER_GATE_GRACE_MS = 10_000;

/** Snapshot shape for `useSyncExternalStore` gate grace. */
export type PreviewBearerMeta = {
  hasBearer: boolean;
  appliedAt: number | null;
};

/** Stable server/SSR snapshot — never allocate a fresh object in getServerSnapshot. */
export const EMPTY_PREVIEW_BEARER_META: PreviewBearerMeta = {
  hasBearer: false,
  appliedAt: null,
};

/**
 * Return the previous snapshot reference when values are unchanged.
 * `useSyncExternalStore` compares snapshots with `Object.is`; allocating a new
 * `{ hasBearer, appliedAt }` on every getSnapshot call causes
 * "Maximum update depth exceeded".
 */
export function nextPreviewBearerMeta(
  prev: PreviewBearerMeta,
  hasBearer: boolean,
  appliedAt: number | null,
): PreviewBearerMeta {
  if (prev.hasBearer === hasBearer && prev.appliedAt === appliedAt) return prev;
  return { hasBearer, appliedAt };
}
