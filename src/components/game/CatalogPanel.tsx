import { useEffect, useRef, useState } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { applyCatalog, HERO_CARDS, loadChars, resetCatalog } from "@/game/data";
import { CATALOG_KEY, clearUserCatalog, saveUserCatalog } from "@/game/catalog-api";
import { createDriveFolder, loadDriveCatalog, type DriveCatalogResult } from "@/game/drive-catalog";
import {
  beginDriveResume,
  clearDriveAuthAttempt,
  driveAuthAttempted,
  driveResumeAction,
  type DriveResumeAction,
} from "@/game/drive-resume";
import { redirectForDriveLogin } from "@/game/drive-login";
import { useGame } from "@/game/store";
import { CloseButton } from "./pieces";

/** 廃止した GitHub 読み込みが残したリポジトリ指定。標準に戻すときだけ消す。 */
const GH_REPO_KEY = "bansho-github-repo";

function sourceLabel(src: "default" | "custom" | "drive") {
  if (src === "drive") return "ドライブ";
  if (src === "custom") return "カスタム";
  return "標準";
}

export function CatalogPanel({ onClose }: { onClose: () => void }) {
  const { user, isPending } = useCurrentUserState();
  const catalogSource = useGame((s) => s.catalogSource);
  const setCatalogSource = useGame((s) => s.setCatalogSource);
  const setCardEditorOpen = useGame((s) => s.setCardEditorOpen);
  const setCatalogOpen = useGame((s) => s.setCatalogOpen);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const handleDrive = (
    result: DriveCatalogResult,
    opts?: { resumed?: boolean; action?: DriveResumeAction },
  ) => {
    const action = opts?.action ?? "read";
    if (!result.ok) {
      if (result.loginRequired && result.loginUrl) {
        const again =
          action === "folder" ? "フォルダを作る" : action === "export" ? "JSONを書き出す" : "ドライブから読む";
        const stay = opts?.resumed || driveAuthAttempted(action);
        if (stay) {
          setMsg(`許可のあと、まだ続けられていません。もう一度「${again}」を押してください。`);
          return false;
        }
        setMsg(
          action === "folder"
            ? "Googleでドライブを許可すると、フォルダ作成を続けます。"
            : "Googleでドライブを許可すると、読み込みを続けます。",
        );
        redirectForDriveLogin(result.loginUrl, action);
        return false;
      }
      setMsg(result.message);
      return false;
    }
    clearDriveAuthAttempt(action);
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

  const resumeOnce = useRef(false);
  useEffect(() => {
    if (resumeOnce.current) return;
    const hinted = driveResumeAction();
    const job = beginDriveResume(async (action) => ({
      action,
      result: action === "folder" ? await createDriveFolder() : await loadDriveCatalog(),
    }));
    if (!job) return;
    resumeOnce.current = true;
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

  const onReset = async () => {
    setBusy(true);
    setMsg("");
    try {
      localStorage.removeItem(CATALOG_KEY);
      localStorage.removeItem(GH_REPO_KEY);
      resetCatalog();
      await loadChars();
      setCatalogSource("default");
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
        <p className="mt-3 text-[14px] leading-relaxed text-faint">
          万象陣記 / chars.json。差し替え絵は chars/id.png か cards/id.jpg。JSON の art が /chars/… ならアプリ標準絵のまま。
        </p>
      </div>
    </div>
  );
}
