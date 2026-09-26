/** Survive the Google Drive consent round-trip.
 * Hydrate always reopens the title, so without this the action never continues.
 */

const STORAGE_KEY = "bansho-drive-resume";
const FOLDER_AUTH_KEY = "bansho-drive-folder-auth";
const FOLDER_AUTH_TTL_MS = 10 * 60 * 1000;
const PARAM = "resume";

export type DriveResumeAction = "read" | "folder";

let inflight: Promise<unknown> | null = null;

function actionFromValue(raw: string | null): DriveResumeAction | null {
  if (raw === "folder") return "folder";
  if (raw === "1" || raw === "read" || raw === "drive") return "read";
  return null;
}

export function markDriveResume(action: DriveResumeAction = "read"): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, action === "folder" ? "folder" : "1");
  } catch {
    /* private mode */
  }
}

export function driveResumeAction(): DriveResumeAction | null {
  if (typeof window === "undefined") return null;
  try {
    const fromQuery = actionFromValue(new URL(window.location.href).searchParams.get(PARAM));
    if (fromQuery) return fromQuery;
  } catch {
    /* ignore */
  }
  try {
    return actionFromValue(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
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

/** Remember that folder creation already sent the user to Google in this tab. */
export function markFolderAuthAttempt(now = Date.now()): void {
  try {
    sessionStorage.setItem(FOLDER_AUTH_KEY, String(now));
  } catch {
    /* private mode */
  }
}

export function folderAuthAttempted(now = Date.now()): boolean {
  try {
    const raw = sessionStorage.getItem(FOLDER_AUTH_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && now - at >= 0 && now - at < FOLDER_AUTH_TTL_MS;
  } catch {
    return false;
  }
}

export function clearFolderAuthAttempt(): void {
  try {
    sessionStorage.removeItem(FOLDER_AUTH_KEY);
  } catch {
    /* ignore */
  }
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
    back.searchParams.set(PARAM, action === "folder" ? "folder" : "drive");
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
