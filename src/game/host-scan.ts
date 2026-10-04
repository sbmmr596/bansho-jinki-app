/**
 * マイサーバーのQR読み取り。
 * 1. BarcodeDetector があればそれを使う（Chrome/Android など）。
 * 2. なければ jsQR（Apache-2.0、小さい純JS）を必要なときだけ読み込み、canvas に描いたフレームを解く。
 * 3. 写真（<input type=file>）からも同じ手順で読む。
 */

type DetectedBarcode = { rawValue?: string };
type BarcodeDetectorLike = { detect(src: ImageBitmapSource): Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

export const CAMERA_FALLBACK_HINT = "写真から読むを試してください";

/** getUserMedia の失敗を、やさしい日本語にする。どれも最後は「写真から読む」へ案内。 */
export function cameraErrorMessage(err: unknown): string {
  const name =
    err && typeof err === "object" && "name" in err ? String((err as { name?: unknown }).name) : "";
  if (
    name === "NotFoundError" ||
    name === "OverconstrainedError" ||
    name === "DevicesNotFoundError"
  ) {
    return `カメラが見つかりません。${CAMERA_FALLBACK_HINT}`;
  }
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
    return `カメラを開けません。ほかのアプリが使っているかもしれません。${CAMERA_FALLBACK_HINT}`;
  }
  // NotAllowedError / SecurityError / PermissionDeniedError / TypeError(非対応) など
  return `カメラが使えません。${CAMERA_FALLBACK_HINT}`;
}

export function canUseCamera(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

let detectorPromise: Promise<BarcodeDetectorLike | null> | null = null;

/** QRに対応した BarcodeDetector を返す。無ければ null（jsQR を使う）。 */
export function getBarcodeDetector(): Promise<BarcodeDetectorLike | null> {
  detectorPromise ??= (async () => {
    try {
      const Ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      if (!Ctor) return null;
      const formats = await Ctor.getSupportedFormats?.();
      if (formats && !formats.includes("qr_code")) return null;
      return new Ctor({ formats: ["qr_code"] });
    } catch {
      return null;
    }
  })();
  return detectorPromise;
}

async function jsqrDecode(img: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}): Promise<string | null> {
  const { default: jsQR } = await import("jsqr");
  const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
  return hit?.data ? hit.data : null;
}

/** 長辺を maxSide 以下に縮めて canvas に描き、画素を返す。 */
function snapshot(
  src: CanvasImageSource,
  w: number,
  h: number,
  canvas: HTMLCanvasElement,
  maxSide: number,
): ImageData | null {
  if (!w || !h) return null;
  const k = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * k));
  const ch = Math.max(1, Math.round(h * k));
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0, cw, ch);
  return ctx.getImageData(0, 0, cw, ch);
}

/** カメラ映像の1フレームからQRの文字列を読む。無ければ null。 */
export async function decodeVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  const det = await getBarcodeDetector();
  if (det) {
    try {
      const r = await det.detect(video);
      const v = r.find((b) => b.rawValue)?.rawValue;
      if (v) return v;
      return null;
    } catch {
      /* この環境では検出に失敗した。jsQR に切り替える */
    }
  }
  const img = snapshot(video, video.videoWidth, video.videoHeight, canvas, 800);
  return img ? jsqrDecode(img) : null;
}

async function loadImage(
  file: Blob,
): Promise<{ src: CanvasImageSource; w: number; h: number; done: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return { src: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() };
    } catch {
      /* 古いブラウザは Image で */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return {
    src: img,
    w: img.naturalWidth,
    h: img.naturalHeight,
    done: () => URL.revokeObjectURL(url),
  };
}

/** 写真（画像ファイル）からQRの文字列を読む。画像として開けない/QRが無いときは null。 */
export async function decodeQrFromFile(file: Blob): Promise<string | null> {
  let loaded;
  try {
    loaded = await loadImage(file);
  } catch {
    return null;
  }
  try {
    const canvas = document.createElement("canvas");
    const det = await getBarcodeDetector();
    if (det) {
      try {
        const v = (await det.detect(loaded.src)).find((b) => b.rawValue)?.rawValue;
        if (v) return v;
      } catch {
        /* jsQR へ */
      }
    }
    // 大きい写真は縮めたほうが読めることがあるので、大きさを変えて試す。
    for (const side of [1600, 1000, 600]) {
      const img = snapshot(loaded.src, loaded.w, loaded.h, canvas, side);
      const v = img ? await jsqrDecode(img) : null;
      if (v) return v;
    }
    return null;
  } finally {
    loaded.done();
  }
}
