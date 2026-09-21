import { useRef, useState } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { redirectToLoginIfRequired } from "@/lib/app-data";
import { applyCatalog, HERO_CARDS, loadChars, resetCatalog } from "@/game/data";
import { CATALOG_KEY, clearUserCatalog, saveUserCatalog } from "@/game/catalog-api";
import { createDriveFolder, loadDriveCatalog, type DriveCatalogResult } from "@/game/drive-catalog";
import { DEFAULT_GH_REPO, GH_KEY, loadGithubCatalog, type GithubCatalogResult } from "@/game/github-catalog";
import { useGame } from "@/game/store";
import { CloseButton } from "./pieces";

function sourceLabel(src: "default" | "custom" | "drive" | "github") {
  if (src === "drive") return "ドライブ";
  if (src === "github") return "GitHub";
  if (src === "custom") return "カスタム";
  return "標準";
}

export function CatalogPanel({ onClose }: { onClose: () => void }) {
  const { user, isPending } = useCurrentUserState();
  const catalogSource = useGame((s) => s.catalogSource);
  const setCatalogSource = useGame((s) => s.setCatalogSource);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);

  const handleDrive = (result: DriveCatalogResult) => {
    if (!result.ok) {
      setLoginUrl(result.loginUrl ?? null);
      setMsg(result.message);
      if (result.loginRequired && result.loginUrl) {
        redirectToLoginIfRequired({
          ok: false,
          data: null,
          loginRequired: true,
          loginUrl: result.loginUrl,
        });
      }
      return false;
    }
    setLoginUrl(null);
    if (result.status === "empty") {
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

  const handleGithub = (result: GithubCatalogResult) => {
    if (!result.ok) {
      setMsg(result.message);
      return false;
    }
    if (result.status === "empty") {
      setMsg(result.message);
      return false;
    }
    const n = applyCatalog(JSON.parse(result.payload) as unknown);
    if (!n) {
      setMsg("有効なキャラがありません。");
      return false;
    }
    localStorage.setItem(CATALOG_KEY, result.payload);
    setCatalogSource("github");
    setMsg(`${n}人を GitHubから適用した。`);
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

  const onDrive = async () => {
    setBusy(true);
    setMsg("ドライブを確認中…");
    try {
      handleDrive(await loadDriveCatalog());
    } catch {
      setMsg("ドライブに届かなかった。");
    } finally {
      setBusy(false);
    }
  };

  const onMakeFolder = async () => {
    setBusy(true);
    setMsg("");
    try {
      handleDrive(await createDriveFolder());
    } catch {
      setMsg("フォルダを作れなかった。");
    } finally {
      setBusy(false);
    }
  };

  const onGithub = async () => {
    let spec = DEFAULT_GH_REPO;
    try {
      const saved = localStorage.getItem(GH_KEY)?.trim();
      if (saved) spec = saved;
    } catch {
      /* default */
    }
    setBusy(true);
    setMsg("GitHubを確認中…");
    try {
      localStorage.setItem(GH_KEY, spec);
      handleGithub(await loadGithubCatalog({ data: spec }));
    } catch {
      setMsg("GitHubに届かなかった。");
    } finally {
      setBusy(false);
    }
  };

  const onReset = async () => {
    setBusy(true);
    setMsg("");
    try {
      localStorage.removeItem(CATALOG_KEY);
      localStorage.removeItem(GH_KEY);
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
          ドライブの「万象陣記」か、GitHubの公開リポジトリにある chars.json を使う。なければ標準データ。標準の絵や本体は書き出さない。
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
          onClick={() => void onGithub()}
          className="mt-3 h-11 w-full rounded-md bg-brass text-sm font-medium text-bg disabled:opacity-40"
        >
          GitHubから読む
        </button>
        {loginUrl ? (
          <button
            type="button"
            className="mt-3 h-11 w-full rounded-md bg-brass text-sm font-medium text-bg"
            onClick={() =>
              redirectToLoginIfRequired({
                ok: false,
                data: null,
                loginRequired: true,
                loginUrl,
              })
            }
          >
            Grokで接続
          </button>
        ) : null}
        <p className="mt-3 text-[10px] leading-relaxed text-faint">
          万象陣記 / chars.json。差し替え絵は chars/id.png か cards/id.jpg。JSON の art が /chars/… ならアプリ標準絵のまま。
        </p>
      </div>
    </div>
  );
}
