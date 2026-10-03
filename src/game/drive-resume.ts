/** Survive the Google Drive consent round-trip.
 * Hydrate always reopens the title, so without this the action never continues.
 */

const STORAGE_KEY = "bansho-drive-resume";
const AUTH_ATTEMPT_PREFIX = "bansho-drive-auth-";
const AUTH_ATTEMPT_TTL_MS = 10 * 60 * 1000;
const PARAM = "resume";
/** localStorage copy of the pending intent: survives a new tab / a different webview of the same origin. */
const INTENT_KEY = "bansho-drive-intent";
const INTENT_TTL_MS = 15 * 60 * 1000;
const STALL_PREFIX = "bansho-drive-stall-";

export type DriveResumeAction = "read" | "folder" | "export";

let inflight: Promise<unknown> | null = null;

function actionFromValue(raw: string | null): DriveResumeAction | null {
  if (raw === "folder") return "folder";
  if (raw === "export") return "export";
  if (raw === "1" || raw === "read" || raw === "drive") return "read";
  return null;
}

function resumeQuery(action: DriveResumeAction): string {
  if (action === "folder") return "folder";
  if (action === "export") return "export";
  return "drive";
}

function authAttemptKey(action: DriveResumeAction): string {
  return `${AUTH_ATTEMPT_PREFIX}${action}`;
}

export function markDriveResume(action: DriveResumeAction = "read", now = Date.now()): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, action === "read" ? "1" : action);
  } catch {
    /* private mode */
  }
  try {
    localStorage.setItem(INTENT_KEY, JSON.stringify({ action, at: now }));
  } catch {
    /* private mode */
  }
}

function intentFromLocal(now: number): DriveResumeAction | null {
  try {
    const raw = localStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { action?: unknown; at?: unknown };
    const at = typeof v.at === "number" ? v.at : NaN;
    if (!Number.isFinite(at) || now - at < 0 || now - at >= INTENT_TTL_MS) {
      localStorage.removeItem(INTENT_KEY);
      return null;
    }
    return actionFromValue(typeof v.action === "string" ? v.action : null);
  } catch {
    return null;
  }
}

export function driveResumeAction(now = Date.now()): DriveResumeAction | null {
  if (typeof window === "undefined") return null;
  try {
    const fromQuery = actionFromValue(new URL(window.location.href).searchParams.get(PARAM));
    if (fromQuery) return fromQuery;
  } catch {
    /* ignore */
  }
  try {
    const fromSession = actionFromValue(sessionStorage.getItem(STORAGE_KEY));
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  return intentFromLocal(now);
}

export function driveResumePending(): boolean {
  return driveResumeAction() !== null;
}

export function clearDriveResume(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(INTENT_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    if (!actionFromValue(url.searchParams.get(PARAM))) return;
    url.searchParams.delete(PARAM);
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next || "/");
  } catch {
    /* ignore */
  }
}

/** Remember that this Drive action already sent the user to Google in this tab. */
export function markDriveAuthAttempt(action: DriveResumeAction, now = Date.now()): void {
  try {
    sessionStorage.removeItem(`${STALL_PREFIX}${action}`);
    sessionStorage.setItem(authAttemptKey(action), String(now));
  } catch {
    /* private mode */
  }
}

export function driveAuthAttempted(action: DriveResumeAction, now = Date.now()): boolean {
  try {
    const raw = sessionStorage.getItem(authAttemptKey(action));
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && now - at >= 0 && now - at < AUTH_ATTEMPT_TTL_MS;
  } catch {
    return false;
  }
}

export function clearDriveAuthAttempt(action: DriveResumeAction): void {
  try {
    sessionStorage.removeItem(authAttemptKey(action));
    sessionStorage.removeItem(`${STALL_PREFIX}${action}`);
  } catch {
    /* ignore */
  }
}

export type DriveLoginDecision = "redirect" | "stay";

/**
 * 認証が必要と返ったとき、Googleへ送るか、この画面に留まるか。
 * - 自動の続き（resumed）は絶対に自動で飛ばさない（ループ防止）。
 * - まだ試していなければ飛ばす。
 * - 試した直後の1回目の再押しは「反映待ち」として留まる。
 * - それでも続かず2回目の再押しは、許可を取り直すためもう一度Googleへ送る
 *   （従来は10分間ずっと留まって詰まっていた）。
 */
export function decideDriveLogin(
  action: DriveResumeAction,
  opts: { resumed?: boolean; now?: number } = {},
): DriveLoginDecision {
  const now = opts.now ?? Date.now();
  const stallKey = `${STALL_PREFIX}${action}`;
  if (opts.resumed) return "stay";
  if (!driveAuthAttempted(action, now)) return "redirect";
  let seen = false;
  try {
    seen = sessionStorage.getItem(stallKey) === "1";
  } catch {
    /* ignore */
  }
  if (seen) return "redirect";
  try {
    sessionStorage.setItem(stallKey, "1");
  } catch {
    /* ignore */
  }
  return "stay";
}

/** Retry a call that still says "login required" right after consent (the grant can lag a moment). */
export async function retryWhileLoginRequired<T>(
  run: () => Promise<T>,
  isLoginRequired: (value: T) => boolean,
  delaysMs: readonly number[] = [1200, 2500, 4000],
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  let value = await run();
  for (const d of delaysMs) {
    if (!isLoginRequired(value)) return value;
    await sleep(d);
    value = await run();
  }
  return value;
}

/** @deprecated Prefer markDriveAuthAttempt("folder") */
export function markFolderAuthAttempt(now = Date.now()): void {
  markDriveAuthAttempt("folder", now);
}

/** @deprecated Prefer driveAuthAttempted("folder") */
export function folderAuthAttempted(now = Date.now()): boolean {
  return driveAuthAttempted("folder", now);
}

/** @deprecated Prefer clearDriveAuthAttempt("folder") */
export function clearFolderAuthAttempt(): void {
  clearDriveAuthAttempt("folder");
}

/** Add resume=drive or resume=folder to the gate return_to so a new tab still continues. */
export function loginUrlWithDriveResume(
  loginUrl: string,
  action: DriveResumeAction = "read",
): string {
  try {
    const u = new URL(loginUrl);
    const ret = u.searchParams.get("return_to");
    if (!ret) return loginUrl;
    const back = new URL(ret);
    back.searchParams.set(PARAM, resumeQuery(action));
    u.searchParams.set("return_to", back.toString());
    return u.toString();
  } catch {
    return loginUrl;
  }
}

/** One shared load across a StrictMode remount. Null when nothing is pending. */
export function beginDriveResume<T>(
  run: (action: DriveResumeAction) => Promise<T>,
): Promise<T> | null {
  if (inflight) return inflight as Promise<T>;
  const action = driveResumeAction();
  if (!action) return null;
  clearDriveResume();
  const job = run(action).finally(() => {
    if (inflight === job) inflight = null;
  });
  inflight = job;
  return job;
}
