/** Best-effort landscape lock + fullscreen (works best as installed PWA / Android Chrome). */
export async function requestGameDisplay(root?: HTMLElement | null) {
  if (typeof window === "undefined") return;
  const el = root ?? document.documentElement;
  try {
    if (!document.fullscreenElement && el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
    }
  } catch {
    /* ignored — iOS Safari often blocks */
  }
  try {
    const orient = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    if (orient?.lock) await orient.lock("landscape");
  } catch {
    /* ignored — requires fullscreen / PWA on many browsers */
  }
}
