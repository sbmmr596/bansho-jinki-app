import { useEffect, useRef, useState } from "react";
import { extractHostIdFromScan } from "@/game/host-catalog";
import { drawQrToCanvas, makeQrMatrix } from "@/game/host-qr";
import {
  cameraErrorMessage,
  canUseCamera,
  CAMERA_FALLBACK_HINT,
  decodeVideoFrame,
} from "@/game/host-scan";
import { CloseButton } from "./pieces";

/** クリップボードに書く。失敗したら古い方法（選択して copy）も試す。 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* 非対応や権限なし */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function Overlay({ children, testId }: { children: React.ReactNode; testId: string }) {
  return (
    <div
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      className="absolute inset-0 z-[90] flex items-center justify-center bg-bg/85 p-3"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

/** 「QRを表示」: ゲームのリンクをQRにして大きく見せる。横長のステージ（1280x720）に収まる左右配置。 */
export function HostQrShowModal({ link, onClose }: { link: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"making" | "ready" | "error">("making");
  const [copyMsg, setCopyMsg] = useState("");

  useEffect(() => {
    let cancel = false;
    setState("making");
    void makeQrMatrix(link)
      .then((m) => {
        if (cancel || !canvasRef.current) return;
        drawQrToCanvas(canvasRef.current, m);
        setState("ready");
      })
      .catch(() => {
        if (!cancel) setState("error");
      });
    return () => {
      cancel = true;
    };
  }, [link]);

  const onCopy = async () => {
    setCopyMsg(
      (await copyText(link))
        ? "コピーしました"
        : "コピーできません。リンクを長押しでコピーしてください",
    );
  };

  return (
    <Overlay testId="host-qr-modal">
      <div className="panel flex max-h-full w-full max-w-[900px] items-stretch gap-5 rounded-xl p-4">
        <div
          className="relative aspect-square h-[480px] max-h-full shrink-0 self-center rounded-lg bg-white"
          data-state={state}
        >
          <canvas
            ref={canvasRef}
            data-testid="host-qr-canvas"
            aria-label="マイサーバーのQRコード"
            className="h-full w-full rounded-lg"
          />
          {state !== "ready" ? (
            <p className="absolute inset-0 flex items-center justify-center px-3 text-center text-sm text-[#333]">
              {state === "error" ? "QRを作れませんでした" : "作っています…"}
            </p>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-display text-base text-fg">QRで読み込む</p>
            <CloseButton onClick={onClose} />
          </div>
          <p className="mb-3 text-sm leading-relaxed text-muted">
            ほかの端末のカメラでこのQRを読むと、同じIDでゲームが開きます。
          </p>
          <p
            data-testid="host-qr-link"
            className="mb-3 select-text break-all rounded-md bg-raised p-2 font-mono text-[12px] leading-relaxed text-muted hairline"
          >
            {link}
          </p>
          <button
            type="button"
            data-testid="host-qr-copy"
            onClick={() => void onCopy()}
            className="h-11 w-full rounded-md bg-brass text-sm font-medium text-bg"
          >
            リンクをコピー
          </button>
          {copyMsg ? (
            <p data-testid="host-qr-copy-msg" className="mt-2 text-xs text-brass">
              {copyMsg}
            </p>
          ) : null}
          <p className="mt-3 text-[12px] leading-relaxed text-faint">
            このQRを読んだ人は、あなたのカードを読めます。見せる相手は選んでね。
          </p>
          <button
            type="button"
            data-testid="host-qr-close"
            onClick={onClose}
            className="mt-auto h-11 w-full rounded-md bg-raised text-sm text-fg hairline"
          >
            閉じる
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/**
 * 「QRを読む」: 背面カメラのプレビューを出し、QRが見つかったらIDを返す。
 * BarcodeDetector があればそれ、なければ jsQR（host-scan.ts）。
 */
export function HostQrScanModal({
  onId,
  onCancel,
  onPickPhoto,
}: {
  onId: (id: string) => void;
  onCancel: () => void;
  onPickPhoto: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [msg, setMsg] = useState("カメラを起動しています…");
  const onIdRef = useRef(onId);
  onIdRef.current = onId;

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    const canvas = document.createElement("canvas");
    const stop = () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    };
    const fail = (m: string) => {
      stop();
      setStatus("error");
      setMsg(m);
    };

    const tick = async () => {
      const v = videoRef.current;
      if (stopped || !v) return;
      let found: string | null = null;
      if (v.readyState >= 2) {
        try {
          found = await decodeVideoFrame(v, canvas);
        } catch {
          found = null;
        }
      }
      if (stopped) return;
      if (found) {
        const id = extractHostIdFromScan(found);
        if (id) {
          stop();
          onIdRef.current(id);
          return;
        }
        setMsg("このQRはIDではありません。マイサーバーのQRを写してください");
      }
      timer = window.setTimeout(() => void tick(), 180);
    };

    void (async () => {
      if (!canUseCamera()) {
        fail(`カメラが使えません。${CAMERA_FALLBACK_HINT}`);
        return;
      }
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (e) {
          // 条件が合わないだけなら、条件を外してもう一度。許可がないときはそのまま失敗にする。
          const n = (e as { name?: string } | null)?.name;
          if (n !== "OverconstrainedError" && n !== "NotFoundError") throw e;
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        if (stopped) return;
        setStatus("scanning");
        setMsg("QRを枠に合わせてください");
        void tick();
      } catch (e) {
        if (!stopped) fail(cameraErrorMessage(e));
      }
    })();

    return stop;
  }, []);

  return (
    <Overlay testId="host-scan-modal">
      <div className="panel flex max-h-full w-full max-w-[900px] items-stretch gap-5 rounded-xl p-4">
        <div className="relative aspect-[4/3] h-[420px] max-h-full shrink-0 self-center overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            data-testid="host-scan-video"
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />
          {status === "scanning" ? (
            <div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-brass/90" />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-display text-base text-fg">QRを読む</p>
            <CloseButton onClick={onCancel} />
          </div>
          <p
            data-testid="host-scan-msg"
            data-status={status}
            className={`mb-3 text-sm leading-relaxed ${status === "error" ? "text-brass" : "text-muted"}`}
          >
            {msg}
          </p>
          <button
            type="button"
            data-testid="host-scan-photo"
            onClick={onPickPhoto}
            className="h-11 w-full rounded-md bg-brass text-sm font-medium text-bg"
          >
            写真から読む
          </button>
          <button
            type="button"
            data-testid="host-scan-cancel"
            onClick={onCancel}
            className="mt-auto h-11 w-full rounded-md bg-raised text-sm text-fg hairline"
          >
            やめる
          </button>
        </div>
      </div>
    </Overlay>
  );
}
