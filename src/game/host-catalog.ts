/**
 * 「マイサーバー」: 自分の PHP ホストから chars.json と画像を読む。
 * このファイルは純粋なロジックだけ（data.ts / store に依存しない）。適用は host-load.ts。
 */

/** ビルド時の既定。localStorage `bansho-host-base` で上書きできる。 */
export const DEFAULT_HOST_BASE = "https://r2a.gao.lu/uDQdPnJG/api.php";
export const HOST_BASE_KEY = "bansho-host-base";
export const HOST_ID_KEY = "bansho-host-id";
export const HOST_ID_RE = /^[a-z2-7]{26}$/;

export type HostErrorKind = "not_found" | "disabled" | "bad_id" | "network" | "invalid" | "empty" | "http";

export type HostFetchResult =
  | { ok: true; raw: unknown }
  | { ok: false; kind: HostErrorKind; message: string };

export const HOST_MESSAGES: Record<HostErrorKind, string> = {
  not_found: "chars.json がまだ置かれていません",
  disabled: "このIDは停止中です",
  bad_id: "IDは26文字の英数字（a-z と 2-7）です",
  network: "サーバーに接続できません",
  invalid: "chars.json を読めませんでした",
  empty: "有効なキャラがありません",
  http: "サーバーの返事が想定と違います",
};

/** 貼り付け対応: 前後の空白を除き小文字化。URL（?host= / #host= / id=）を貼ってもIDだけ取り出す。 */
export function normalizeHostId(input: string): string {
  const s = String(input ?? "").trim();
  const m = /[?#&](?:host|id)=([A-Za-z2-7]{26})(?![A-Za-z0-9])/.exec(s);
  return (m ? m[1]! : s).replace(/\s+/g, "").toLowerCase();
}

export function isValidHostId(id: string): boolean {
  return HOST_ID_RE.test(id);
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function safeStorage(): StorageLike | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function getHostBase(storage: StorageLike | null = safeStorage()): string {
  try {
    const v = storage?.getItem(HOST_BASE_KEY)?.trim();
    if (v && /^https?:\/\//i.test(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_HOST_BASE;
}

export function getSavedHostId(storage: StorageLike | null = safeStorage()): string {
  try {
    const v = normalizeHostId(storage?.getItem(HOST_ID_KEY) ?? "");
    return isValidHostId(v) ? v : "";
  } catch {
    return "";
  }
}

export function saveHostId(id: string, storage: StorageLike | null = safeStorage()) {
  try {
    storage?.setItem(HOST_ID_KEY, id);
  } catch {
    /* private mode */
  }
}

export function clearHostId(storage: StorageLike | null = safeStorage()) {
  try {
    storage?.removeItem(HOST_ID_KEY);
  } catch {
    /* ignore */
  }
}

/** `?host=ID` または `#host=ID`。無ければ ""。 */
export function readHostParam(loc: { search: string; hash: string }): string {
  for (const part of [loc.search, loc.hash]) {
    const q = part.replace(/^[?#]/, "");
    const v = new URLSearchParams(q).get("host");
    if (v) {
      const id = normalizeHostId(v);
      if (isValidHostId(id)) return id;
    }
  }
  return "";
}

/** URL から host パラメータを消した相対URL（履歴に残さないため）。 */
export function stripHostParam(loc: { pathname: string; search: string; hash: string }): string {
  const clean = (part: string, lead: string) => {
    const p = new URLSearchParams(part.replace(/^[?#]/, ""));
    p.delete("host");
    const s = p.toString();
    return s ? `${lead}${s}` : "";
  };
  return `${loc.pathname}${clean(loc.search, "?")}${clean(loc.hash, "#")}`;
}

/** `?id=ID&f=rel`。base に既に ? があれば & でつなぐ。 */
export function hostFileUrl(base: string, id: string, rel: string): string {
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}id=${id}&f=${rel}`;
}

const HOST_IMG_RE = /^[a-z0-9_-]{1,64}\.(?:png|jpe?g|webp)$/;

/**
 * chars.json の画像指定をホストURLにする。
 * - `img/x.png`, `./img/x.png`, `/img/x.png`, 拡張子つきの素のファイル名 `x.png` → ホストの画像
 * - /cards/… /chars/… などのアプリ内パス、https URL、data URL → そのまま
 */
export function resolveHostImage(src: unknown, base: string, id: string): unknown {
  if (typeof src !== "string") return src;
  const s = src.trim();
  if (!s || s.startsWith("data:") || /^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith("//")) return src;
  if (s.startsWith("/") && !s.startsWith("/img/")) return src;
  const rel = s.replace(/^\.?\/+/, "");
  const name = rel.startsWith("img/") ? rel.slice(4) : rel;
  const lower = name.toLowerCase();
  if (!HOST_IMG_RE.test(lower)) return src;
  return hostFileUrl(base, id, `img/${lower}`);
}

/** 読み込んだ JSON のコピーを返し、art / bust をホストURLに解決する。元は変更しない。 */
export function prepareHostCatalog(raw: unknown, base: string, id: string): unknown {
  const fix = (row: unknown) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    const r = { ...(row as Record<string, unknown>) };
    for (const k of ["art", "bust"] as const) {
      if (k in r) r[k] = resolveHostImage(r[k], base, id);
    }
    return r;
  };
  if (Array.isArray(raw)) return raw.map(fix);
  if (raw && typeof raw === "object" && Array.isArray((raw as { chars?: unknown }).chars)) {
    const o = raw as { chars: unknown[] };
    return { ...o, chars: o.chars.map(fix) };
  }
  return raw;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function kindFromBody(body: unknown, status: number): HostErrorKind {
  const code =
    body && typeof body === "object" ? String((body as { error?: unknown }).error ?? "") : "";
  if (code === "not_found" || status === 404) return "not_found";
  if (code === "disabled" || status === 403) return "disabled";
  if (code === "bad_id" || code === "bad_filename" || status === 400) return "bad_id";
  return "http";
}

/** chars.json を取りに行く。ETag で再検証（no-cache）。失敗は種類つきで返す。 */
export async function fetchHostCatalog(
  id: string,
  opts?: { base?: string; fetchImpl?: FetchLike; timeoutMs?: number },
): Promise<HostFetchResult> {
  const fail = (kind: HostErrorKind): HostFetchResult => ({ ok: false, kind, message: HOST_MESSAGES[kind] });
  if (!isValidHostId(id)) return fail("bad_id");
  const base = opts?.base ?? getHostBase();
  const doFetch: FetchLike = opts?.fetchImpl ?? ((u, i) => fetch(u, i));
  let res: Response;
  try {
    res = await doFetch(hostFileUrl(base, id, "chars.json"), {
      cache: "no-cache",
      credentials: "omit",
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 10_000),
    });
  } catch {
    return fail("network");
  }
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* not JSON */
    }
    return fail(kindFromBody(body, res.status));
  }
  try {
    const raw: unknown = JSON.parse((await res.text()).replace(/^\uFEFF/, ""));
    return { ok: true, raw };
  } catch {
    return fail("invalid");
  }
}
