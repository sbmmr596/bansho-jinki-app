/** Survive the Google Drive consent round-trip.
 * Hydrate always reopens the title, so without this the read never continues.
 */

const STORAGE_KEY = "bansho-drive-resume";
const PARAM = "resume";
const VALUE = "drive";

let inflight: Promise<unknown> | null = null;

export function markDriveResume(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function driveResumePending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URL(window.location.href).searchParams.get(PARAM) === VALUE) return true;
  } catch {
    /* ignore */
  }
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
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
    if (url.searchParams.get(PARAM) !== VALUE) return;
    url.searchParams.delete(PARAM);
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next || "/");
  } catch {
    /* ignore */
  }
}

/** Add resume=drive to the gate return_to so a new tab still continues the read. */
export function loginUrlWithDriveResume(loginUrl: string): string {
  try {
    const u = new URL(loginUrl);
    const ret = u.searchParams.get("return_to");
    if (!ret) return loginUrl;
    const back = new URL(ret);
    back.searchParams.set(PARAM, VALUE);
    u.searchParams.set("return_to", back.toString());
    return u.toString();
  } catch {
    return loginUrl;
  }
}

/** One shared load across a StrictMode remount. Null when nothing is pending. */
export function beginDriveResume<T>(load: () => Promise<T>): Promise<T> | null {
  if (inflight) return inflight as Promise<T>;
  if (!driveResumePending()) return null;
  clearDriveResume();
  const job = load().finally(() => {
    if (inflight === job) inflight = null;
  });
  inflight = job;
  return job;
}
