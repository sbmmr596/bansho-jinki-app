/** Preload/decode images with a hard timeout so missing assets never softlock. */

const DEFAULT_TIMEOUT_MS = 4000;

function loadOne(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    img.onload = done;
    img.onerror = done;
    img.src = url;
    if (typeof img.decode === "function") {
      void img.decode().then(done).catch(done);
    } else if (img.complete) {
      done();
    }
  });
}

/**
 * Wait until every URL has loaded/decoded (or failed), or until timeoutMs.
 * Failures and timeout still resolve — never rejects.
 */
export function preloadImages(
  urls: string[],
  opts?: {
    timeoutMs?: number;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<void> {
  const unique = [...new Set(urls.filter((u) => typeof u === "string" && u.length > 0))];
  const total = unique.length;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!total) {
    opts?.onProgress?.(0, 0);
    return Promise.resolve();
  }

  let doneCount = 0;
  const report = () => opts?.onProgress?.(doneCount, total);

  const all = Promise.all(
    unique.map((url) =>
      loadOne(url).then(() => {
        doneCount += 1;
        report();
      }),
    ),
  ).then(() => undefined);

  const timeout = new Promise<void>((resolve) => {
    window.setTimeout(resolve, timeoutMs);
  });

  report();
  return Promise.race([all, timeout]);
}

export const BATTLE_PRELOAD_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
