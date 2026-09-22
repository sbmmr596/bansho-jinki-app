/**
 * Bound the Better Auth `useSession()` pending window.
 *
 * In the grok-sandbox iframe (esp. iPhone Safari + partitioned storage),
 * `/api/auth/get-session` can hang forever — no response, no reject. The
 * session atom then stays `isPending: true` indefinitely. Card editor (#88)
 * correctly waits on pending so it never flashes the editor, but without a
 * timeout that wait never reaches Continue with Google/X either.
 */

/** Max time the UI may treat the session as still resolving. */
export const SESSION_RESOLVE_TIMEOUT_MS = 4_000;

/** Max wait for an explicit post-popup session atom refetch. */
export const SESSION_REFETCH_TIMEOUT_MS = 4_000;

export type EffectivePendingInput = {
  /** Raw Better Auth / useSession pending flag. */
  isPending: boolean;
  /** True once {@link SESSION_RESOLVE_TIMEOUT_MS} elapsed while still pending. */
  timedOut: boolean;
};

/**
 * Effective pending for gates: pending until the check settles OR times out.
 * Timed-out pending must look like "resolved signed-out" so the UI can show
 * Continue with Google/X (never hang forever; never flash editor while pending).
 */
export function resolveEffectivePending(input: EffectivePendingInput): boolean {
  if (!input.isPending) return false;
  if (input.timedOut) return false;
  return true;
}

/**
 * Race a promise against a timeout. Resolves with the value on success;
 * rejects with `TimeoutError` (or returns `onTimeout` if provided) when the
 * timer fires first. Does not cancel the underlying work.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = "operation",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
