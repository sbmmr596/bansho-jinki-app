/** Best-effort landscape lock + fullscreen (works best as installed PWA / Android Chrome). */

export type DisplayModeResult = {
  ok: boolean;
  mode: "entered" | "exited" | "failed";
  reason?: string;
};

type FullscreenCapable = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type DocumentWithWebkit = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

export function getFullscreenElement(): Element | null {
  if (typeof document === "undefined") return null;
  const doc = document as DocumentWithWebkit;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

async function exitFullscreen(): Promise<void> {
  const doc = document as DocumentWithWebkit;
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }
  if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen();
  }
}

async function enterFullscreen(el: FullscreenCapable): Promise<void> {
  if (el.requestFullscreen) {
    await el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
    return;
  }
  if (el.webkitRequestFullscreen) {
    await el.webkitRequestFullscreen();
  }
}

function resolveTarget(root?: HTMLElement | null): FullscreenCapable {
  if (root) return root as FullscreenCapable;
  const frame = document.querySelector(".game-frame") as HTMLElement | null;
  return (frame ?? document.documentElement) as FullscreenCapable;
}

async function tryLockLandscape(): Promise<void> {
  try {
    const orient = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    if (orient?.lock) await orient.lock("landscape");
  } catch {
    /* ignored — requires fullscreen / PWA on many browsers */
  }
}

/**
 * Toggle fullscreen on `.game-frame` (or given root / documentElement).
 * Tries webkit-prefixed APIs for older Safari. After enter, best-effort landscape lock.
 */
export async function requestGameDisplay(
  root?: HTMLElement | null,
): Promise<DisplayModeResult> {
  if (typeof window === "undefined") {
    return { ok: false, mode: "failed", reason: "ssr" };
  }

  const el = resolveTarget(root);
  const canEnter = Boolean(el.requestFullscreen || el.webkitRequestFullscreen);
  const canExit = Boolean(
    document.exitFullscreen || (document as DocumentWithWebkit).webkitExitFullscreen,
  );

  if (getFullscreenElement()) {
    if (!canExit) {
      return {
        ok: false,
        mode: "failed",
        reason: "このブラウザでは制限あり（PWA推奨）",
      };
    }
    try {
      await exitFullscreen();
      return { ok: true, mode: "exited" };
    } catch {
      return {
        ok: false,
        mode: "failed",
        reason: "このブラウザでは制限あり（PWA推奨）",
      };
    }
  }

  if (!canEnter) {
    return {
      ok: false,
      mode: "failed",
      reason: "このブラウザでは制限あり（PWA推奨）",
    };
  }

  try {
    await enterFullscreen(el);
    await tryLockLandscape();
    return { ok: true, mode: "entered" };
  } catch {
    /* iOS Safari often blocks Fullscreen API outside PWA */
    await tryLockLandscape();
    return {
      ok: false,
      mode: "failed",
      reason: "このブラウザでは制限あり（PWA推奨）",
    };
  }
}
