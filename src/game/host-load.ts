import { applyCatalog, exportCatalogPayload, loadChars, resetCatalog } from "@/game/data";
import {
  clearHostId,
  fetchHostCatalog,
  getHostBase,
  HOST_MESSAGES,
  prepareHostCatalog,
  saveHostId,
} from "@/game/host-catalog";
import { CATALOG_KEY } from "@/game/catalog-api";
import { useGame } from "@/game/store";

export type HostLoadResult =
  | { ok: true; count: number; message: string }
  | { ok: false; kind: string; message: string };

/** マイサーバーの最後の結果。パネルを開いたときに表示する。 */
let lastStatus = "";
let lastTriedId = "";
export function getHostStatus() {
  return lastStatus;
}
/** 最後に試したID（?host= で来たときに入力欄へ入れる）。 */
export function getHostTriedId() {
  return lastTriedId;
}

/**
 * ホストの chars.json を取り、ローカルJSON読み込みと同じ applyCatalog で反映する。
 * 失敗したときは今のデータをそのまま残す。localStorage の ID は成功時だけ保存する。
 */
export async function loadHostCatalog(id: string, opts?: { remember?: boolean }): Promise<HostLoadResult> {
  const base = getHostBase();
  lastTriedId = id;
  const got = await fetchHostCatalog(id, { base });
  if (!got.ok) {
    lastStatus = got.message;
    return got;
  }
  const before = exportCatalogPayload();
  resetCatalog();
  const n = applyCatalog(prepareHostCatalog(got.raw, base, id));
  if (!n) {
    resetCatalog();
    applyCatalog(before, { replaceAll: true });
    lastStatus = HOST_MESSAGES.empty;
    return { ok: false, kind: "empty", message: HOST_MESSAGES.empty };
  }
  if (opts?.remember !== false) saveHostId(id);
  const st = useGame.getState();
  st.setCatalogSource("host");
  st.bumpCatalog();
  const message = `${n}人を読み込みました`;
  lastStatus = message;
  return { ok: true, count: n, message };
}

/** 解除: 保存したIDを消し、標準データに戻す（「標準に戻す」と同じ。アカウント側の消去は呼び出し側）。 */
export async function unloadHostCatalog(): Promise<void> {
  clearHostId();
  lastStatus = "";
  try {
    localStorage.removeItem(CATALOG_KEY);
  } catch {
    /* private mode */
  }
  resetCatalog();
  await loadChars();
  const st = useGame.getState();
  st.setCatalogSource("default");
  st.bumpCatalog();
}
