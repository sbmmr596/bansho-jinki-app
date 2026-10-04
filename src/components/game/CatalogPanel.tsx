import { useEffect, useRef, useState } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { applyCatalog, HERO_CARDS, loadChars, resetCatalog } from "@/game/data";
import { CATALOG_KEY, clearUserCatalog, saveUserCatalog } from "@/game/catalog-api";
import { createDriveFolder, driveDiag, loadDriveCatalog, type DriveCatalogResult } from "@/game/drive-catalog";
import { formatDriveDiag } from "@/game/drive-diag";
import {
  beginDriveResume,
  clearDriveAuthAttempt,
  decideDriveLogin,
  driveResumeAction,
  retryWhileLoginRequired,
  type DriveResumeAction,
} from "@/game/drive-resume";
import { redirectForDriveLogin } from "@/game/drive-login";
import { isMissingTokenDetail, isRetryableLogin, stalledMessage } from "@/game/drive-errors";
import { useGame } from "@/game/store";
import {
  buildHostLink,
  extractHostIdFromScan,
  getSavedHostId,
  isValidHostId,
  normalizeHostId,
} from "@/game/host-catalog";
import { decodeQrFromFile } from "@/game/host-scan";
import { getHostStatus, getHostTriedId, loadHostCatalog, unloadHostCatalog } from "@/game/host-load";
import { CloseButton } from "./pieces";
import { HostQrScanModal, HostQrShowModal } from "./HostQrModals";

/** 廃止した GitHub 読み込みが残したリポジトリ指定。標準に戻すときだけ消す。 */
const GH_REPO_KEY = "bansho-github-repo";

function sourceLabel(src: "default" | "custom" | "drive" | "host") {
  if (src === "host") return "マイサーバー";
  if (src === "drive") return "ドライブ";
  if (src === "custom") return "カスタム";
  return "標準";
}

export function CatalogPanel({ onClose }: { onClose: () => void }) {
  const { user, isPending } = useCurrentUserState();
  const catalogSource = useGame((s) => s.catalogSource);
  const setCatalogSource = useGame((s) => s.setCatalogSource);
  const bumpCatalog = useGame((s) => s.bumpCatalog);
  const setCardEditorOpen = useGame((s) => s.setCardEditorOpen);
  const setCatalogOpen = useGame((s) => s.setCatalogOpen);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  /** 許可のあと続かなかった操作。別タブ/別画面で許可して戻ったとき、自動で続ける。 */
  const [awaiting, setAwaiting] = useState<DriveResumeAction | null>(null);
  const [diag, setDiag] = useState<string[] | null>(null);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const [hostId, setHostId] = useState(() => getSavedHostId() || getHostTriedId());
  const [hostMsg, setHostMsg] = useState(() => getHostStatus());
  const hostValid = isValidHostId(hostId);
  const hostActive = catalogSource === "host" || !!getSavedHostId();
  const [qrModal, setQrModal] = useState<"show" | "scan" | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  /** QRにするID: 入力中の正しいID、なければ保存済みID。 */
  const qrId = hostValid ? hostId : getSavedHostId();

  const handleDrive = (
    result: DriveCatalogResult,
    opts?: { resumed?: boolean; action?: DriveResumeAction },
  ) => {
    const action = opts?.action ?? "read";
    if (!result.ok) {
      const tokenMissing = isMissingTokenDetail(result.detail);
      if (result.loginRequired && result.loginUrl) {
        const again =
          action === "folder" ? "フォルダを作る" : action === "export" ? "JSONを書き出す" : "ドライブから読む";
        const decision = decideDriveLogin(action, { resumed: opts?.resumed, tokenMissing });
        if (decision === "stay") {
          // トークンなしは待っても直らない。許可後の自動再確認は使わず、説明だけ出す。
          setAwaiting(tokenMissing ? null : action);
          setMsg(stalledMessage(again, result.detail, !opts?.resumed));
          return false;
        }
        setMsg(
          tokenMissing
            ? "Grokのログインを確認します。"
            : action === "folder"
            ? "Googleでドライブを許可すると、フォルダ作成を続けます。"
            : "Googleでドライブを許可すると、読み込みを続けます。",
        );
        redirectForDriveLogin(result.loginUrl, action);
        return false;
      }
      if (result.loginRequired) {
        // ログインURLが取れない（ゲート外で開いている等）。
        setMsg(tokenMissing ? result.message : `${result.message}（許可画面のURLを取得できませんでした）`);
        return false;
      }
      setMsg(result.message);
      return false;
    }
    clearDriveAuthAttempt(action);
    setAwaiting(null);
    if (result.status !== "loaded") {
      setMsg(result.message);
      return false;
    }
    const n = applyCatalog(JSON.parse(result.payload) as unknown);
    if (!n) {
      setMsg("有効なキャラがありません。");
      return false;
    }
    localStorage.setItem(CATALOG_KEY, result.payload);
    setCatalogSource("drive");
    bumpCatalog();
    setMsg(`${n}人をドライブから適用した。`);
    if (user) void saveUserCatalog({ data: result.payload }).catch(() => undefined);
    return true;
  };

  const applyPayload = async (raw: unknown, persist: boolean) => {
    const n = applyCatalog(raw);
    if (!n) {
      setMsg("有効なキャラがありません。");
      return;
    }
    const text = JSON.stringify(raw);
    localStorage.setItem(CATALOG_KEY, text);
    setCatalogSource("custom");
    bumpCatalog();
    setMsg(`${n}人のデータを適用した。`);
    if (persist && user) {
      try {
        await saveUserCatalog({ data: text });
        setMsg(`${n}人のデータをアカウントに保存した。`);
      } catch {
        setMsg(`${n}人を適用。アカウント保存は後でやり直せる。`);
      }
    }
  };

  const onFile = async (file: File) => {
    setBusy(true);
    setMsg("");
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      await applyPayload(raw, true);
    } catch {
      setMsg("JSONを読めなかった。");
    } finally {
      setBusy(false);
    }
  };

  const onDrive = async (opts?: { resumed?: boolean }) => {
    setBusy(true);
    setMsg("ドライブを確認中…");
    try {
      handleDrive(await loadDriveCatalog(), { ...opts, action: "read" });
    } catch {
      setMsg("ドライブに届かなかった。");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // beginDriveResume shares one in-flight job, so a StrictMode remount re-attaches to it
    // instead of dropping the result (the first mount's cleanup cancels its own handlers).
    const hinted = driveResumeAction();
    const job = beginDriveResume(async (action) => ({
      action,
      // 許可の直後は反映が少し遅れることがあるので、数回だけ静かに再試行する。
      result: await retryWhileLoginRequired(
        () => (action === "folder" ? createDriveFolder() : loadDriveCatalog()),
        isRetryableLogin,
      ),
    }));
    if (!job) return;
    let cancel = false;
    setBusy(true);
    if (hinted === "folder") setMsg("フォルダを作っています…");
    else if (hinted) setMsg("ドライブを確認中…");
    void job
      .then(({ action, result }) => {
        if (!cancel) handleDrive(result, { resumed: true, action });
      })
      .catch(() => {
        if (!cancel) setMsg(hinted === "folder" ? "フォルダを作れなかった。" : "ドライブに届かなかった。");
      })
      .finally(() => {
        if (!cancel) setBusy(false);
      });
    return () => {
      cancel = true;
    };
    // Resume once when this panel opens after the Google consent return.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 別タブ/システムブラウザで許可して戻ってきたら、押し直さなくても続ける。
  useEffect(() => {
    if (!awaiting) return;
    const action = awaiting;
    let last = 0;
    const retry = () => {
      if (document.visibilityState === "hidden" || busyRef.current) return;
      const now = Date.now();
      if (now - last < 2000) return;
      last = now;
      setBusy(true);
      setMsg("ドライブを確認中…");
      void (action === "folder" ? createDriveFolder() : loadDriveCatalog())
        .then((r) => handleDrive(r, { resumed: true, action }))
        .catch(() => setMsg("ドライブに届かなかった。"))
        .finally(() => setBusy(false));
    };
    document.addEventListener("visibilitychange", retry);
    window.addEventListener("focus", retry);
    window.addEventListener("pageshow", retry);
    return () => {
      document.removeEventListener("visibilitychange", retry);
      window.removeEventListener("focus", retry);
      window.removeEventListener("pageshow", retry);
    };
    // handleDrive only closes over stable setters / store actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaiting]);

  const onMakeFolder = async () => {
    setBusy(true);
    setMsg("フォルダを作っています…");
    try {
      handleDrive(await createDriveFolder(), { action: "folder" });
    } catch {
      setMsg("フォルダを作れなかった。");
    } finally {
      setBusy(false);
    }
  };

  const onDiag = async () => {
    setBusy(true);
    setDiag(["確認中…"]);
    try {
      setDiag(formatDriveDiag(await driveDiag()));
    } catch {
      setDiag(["診断に届かなかった。"]);
    } finally {
      setBusy(false);
    }
  };

  const onHostLoad = async (override?: string) => {
    const id = normalizeHostId(override ?? hostId);
    setHostId(id);
    if (!isValidHostId(id)) {
      setHostMsg("IDは26文字の英数字です（a-z と 2-7）");
      return;
    }
    setBusy(true);
    setHostMsg("読み込み中…");
    try {
      const r = await loadHostCatalog(id);
      setHostMsg(r.message);
    } catch {
      setHostMsg("サーバーに接続できません");
    } finally {
      setBusy(false);
    }
  };

  /** 写真（スクショでも撮影でも）からQRを読んで、IDが取れたら読み込む。 */
  const onQrPhoto = async (file: File) => {
    setBusy(true);
    setHostMsg("写真を読んでいます…");
    let text: string | null = null;
    try {
      text = await decodeQrFromFile(file);
    } catch {
      text = null;
    }
    setBusy(false);
    if (!text) {
      setHostMsg("QRが見つかりませんでした。QR全体が大きく写るようにしてね");
      return;
    }
    const id = extractHostIdFromScan(text);
    if (!id) {
      setHostMsg("このQRはIDではありません。マイサーバーのQRを写してください");
      return;
    }
    await onHostLoad(id);
  };

  const onHostRelease = async () => {
    setBusy(true);
    try {
      await unloadHostCatalog();
      if (user) await clearUserCatalog().catch(() => undefined);
      setHostId("");
      setHostMsg("解除しました。標準データに戻しました");
    } finally {
      setBusy(false);
    }
  };

  const onReset = async () => {
    setBusy(true);
    setMsg("");
    try {
      localStorage.removeItem(CATALOG_KEY);
      localStorage.removeItem(GH_REPO_KEY);
      resetCatalog();
      await loadChars();
      setCatalogSource("default");
      bumpCatalog();
      if (user) {
        try {
          await clearUserCatalog();
        } catch {
          /* local reset is enough */
        }
      }
      setMsg("標準データに戻した。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-[80] flex items-center justify-center bg-bg/70 p-3"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="panel max-h-full w-full max-w-md overflow-y-auto rounded-xl p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-display text-sm text-fg">マイデータ</p>
          <CloseButton onClick={onClose} />
        </div>
        <div className="mb-2 min-h-8">
          {isPending ? <p className="text-xs text-muted">確認中…</p> : <UserButton />}
        </div>
        <p className="mb-2 text-xs leading-relaxed text-muted">
          ドライブの「万象陣記」にある chars.json を使う。なければ標準データ。標準の絵や本体は書き出さない。
        </p>
        <p className="mb-2 text-xs tabular text-faint">
          いま {sourceLabel(catalogSource)}　{HERO_CARDS.length}人
        </p>
        {msg ? <p className="mb-3 text-xs text-brass">{msg}</p> : null}
        <section data-testid="host-section" className="mb-3 rounded-md bg-raised/60 p-2 hairline">
          <p className="mb-1 text-xs font-medium text-fg">マイサーバー</p>
          <p className="mb-2 text-[12px] leading-relaxed text-muted">
            自分のサーバーの chars.json と画像を読みます。IDを貼ってください。絵は art や bust に img/名前.png と書くと、サーバーのものを使います。
          </p>
          <div className="flex gap-2">
            <input
              data-testid="host-id"
              type="text"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              placeholder="26文字のID"
              value={hostId}
              disabled={busy}
              onChange={(e) => setHostId(normalizeHostId(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && hostValid && !busy) void onHostLoad();
              }}
              className="h-11 min-w-0 flex-1 rounded-md bg-bg px-2 font-mono text-[16px] text-fg hairline disabled:opacity-40"
            />
            <button
              type="button"
              data-testid="host-load"
              disabled={busy || !hostValid}
              onClick={() => void onHostLoad()}
              className="h-11 shrink-0 rounded-md bg-brass px-4 text-sm font-medium text-bg disabled:opacity-40"
            >
              読み込む
            </button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button
              type="button"
              data-testid="host-qr-show"
              disabled={busy || !qrId}
              onClick={() => setQrModal("show")}
              className="h-11 rounded-md bg-raised text-[13px] text-fg hairline disabled:opacity-40"
            >
              QRを表示
            </button>
            <button
              type="button"
              data-testid="host-qr-scan"
              disabled={busy}
              onClick={() => setQrModal("scan")}
              className="h-11 rounded-md bg-raised text-[13px] text-fg hairline disabled:opacity-40"
            >
              QRを読む
            </button>
            <button
              type="button"
              data-testid="host-qr-photo"
              disabled={busy}
              onClick={() => photoRef.current?.click()}
              className="h-11 rounded-md bg-raised text-[13px] text-fg hairline disabled:opacity-40"
            >
              写真から読む
            </button>
          </div>
          <input
            ref={photoRef}
            data-testid="host-qr-photo-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onQrPhoto(f);
            }}
          />
          {hostId && !hostValid ? (
            <p className="mt-1 text-[12px] text-faint tabular">{hostId.length}/26 文字</p>
          ) : null}
          {hostMsg ? (
            <p data-testid="host-msg" className="mt-1 text-xs text-brass">
              {hostMsg}
            </p>
          ) : null}
          {hostActive ? (
            <button
              type="button"
              data-testid="host-release"
              disabled={busy}
              onClick={() => void onHostRelease()}
              className="mt-2 h-9 w-full rounded-md bg-raised text-xs text-fg hairline disabled:opacity-40"
            >
              解除
            </button>
          ) : null}
        </section>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onFile(f);
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDrive()}
            className="h-11 rounded-md bg-brass text-sm font-medium text-bg disabled:opacity-40"
          >
            ドライブから読む
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onMakeFolder()}
            className="h-11 rounded-md bg-raised text-sm text-fg hairline disabled:opacity-40"
          >
            フォルダを作る
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="h-11 rounded-md bg-raised text-sm text-fg hairline disabled:opacity-40"
          >
            JSONを読む
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onReset()}
            className="h-11 rounded-md bg-raised text-sm text-fg hairline disabled:opacity-40"
          >
            標準に戻す
          </button>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setCatalogOpen(false);
            setCardEditorOpen(true);
          }}
          className="mt-3 h-11 w-full rounded-md bg-raised text-sm text-fg hairline disabled:opacity-40"
        >
          カード編集を開く
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onDiag()}
          className="mt-2 h-9 w-full rounded-md bg-raised text-xs text-muted hairline disabled:opacity-40"
        >
          接続の診断
        </button>
        {diag ? (
          <div
            data-testid="drive-diag"
            className="mt-2 select-text rounded-md bg-raised p-2 text-[12px] leading-relaxed text-muted hairline"
          >
            {diag.map((line, i) => (
              <p key={i} className="break-all">
                {line}
              </p>
            ))}
          </div>
        ) : null}
        <p className="mt-3 text-[14px] leading-relaxed text-faint">
          万象陣記 / chars.json。差し替え絵は chars/id.png か cards/id.jpg。JSON の art が /chars/… ならアプリ標準絵のまま。
        </p>
      </div>
      {qrModal === "show" && qrId ? (
        <HostQrShowModal
          link={buildHostLink({ origin: window.location.origin, pathname: window.location.pathname }, qrId)}
          onClose={() => setQrModal(null)}
        />
      ) : null}
      {qrModal === "scan" ? (
        <HostQrScanModal
          onCancel={() => setQrModal(null)}
          onPickPhoto={() => {
            setQrModal(null);
            photoRef.current?.click();
          }}
          onId={(id) => {
            setQrModal(null);
            setHostId(id);
            void onHostLoad(id);
          }}
        />
      ) : null}
    </div>
  );
}
