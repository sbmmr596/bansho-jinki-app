import { createServerFn } from "@tanstack/react-start";
import {
  classifyCallToolError,
  ConnectorType,
  GoogleDriveTools,
  isLoginRequired,
} from "@/lib/app-data";
import type { CallToolResult } from "@/lib/app-data";

export const DRIVE_FOLDER = "万象陣記";

export type DriveCatalogResult =
  | { ok: true; status: "loaded"; payload: string; count: number }
  | { ok: true; status: "empty"; message: string }
  | {
      ok: false;
      kind: "login" | "not_connected" | "scope_denied" | "access_denied" | "error";
      message: string;
      loginRequired?: boolean;
      loginUrl?: string;
    };

const OPT = { connectorType: ConnectorType.GoogleDrive } as const;
const FOLDER_MIME = "application/vnd.google-apps.folder";

type DriveFile = { id: string; name: string; mimeType: string };

function driveFail(result: CallToolResult): DriveCatalogResult {
  const classified = classifyCallToolError(result);
  const kind = classified?.kind ?? "error";
  const message =
    kind === "login"
      ? "Grokで接続するとドライブを読めます。"
      : kind === "not_connected"
        ? "Googleドライブを接続してください。"
        : kind === "access_denied"
          ? "このドライブへの権限がありません。"
          : result.errorMessage || "ドライブを読めなかった。";
  return {
    ok: false,
    kind,
    message,
    loginRequired: isLoginRequired(result) || undefined,
    loginUrl: result.loginUrl,
  };
}

function asFile(raw: unknown): DriveFile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? o.fileId ?? o.file_id ?? o.folder_id ?? o.folderId ?? "").trim();
  const name = String(o.name ?? o.title ?? o.folder_name ?? "").trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    mimeType: String(o.mimeType ?? o.mime_type ?? o.mime ?? ""),
  };
}

function asFiles(data: unknown): DriveFile[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(asFile).filter((f): f is DriveFile => !!f);
  if (typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["files", "items", "results", "documents", "data"]) {
      if (Array.isArray(o[key])) return asFiles(o[key]);
    }
    const one = asFile(data);
    if (one) return [one];
  }
  return [];
}

function extractText(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  for (const key of ["text", "content", "body", "markdown", "data"]) {
    if (typeof o[key] === "string" && (o[key] as string).trim()) return o[key] as string;
  }
  return null;
}

async function driveCall(tool: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const { callTool } = await import("@/lib/app-data/client.server");
  return callTool(tool, args, OPT);
}

async function searchFolder(): Promise<CallToolResult> {
  const first = await driveCall(GoogleDriveTools.search, {
    exact_name: DRIVE_FOLDER,
    mime_type_filter: FOLDER_MIME,
    max_results: 10,
  });
  if (first.ok && asFiles(first.data).length) return first;
  const second = await driveCall(GoogleDriveTools.search, {
    query: DRIVE_FOLDER,
    mime_type_filter: FOLDER_MIME,
    title_only: true,
    max_results: 10,
  });
  return second.ok ? second : first;
}

async function listFolder(folderId: string): Promise<CallToolResult> {
  return driveCall(GoogleDriveTools.listFolder, { folder_id: folderId, max_results: 200 });
}

async function readFile(fileId: string): Promise<CallToolResult> {
  return driveCall(GoogleDriveTools.readFile, { file_id: fileId });
}

function pickFolder(files: DriveFile[]): DriveFile | null {
  const named = files.filter((f) => f.name === DRIVE_FOLDER);
  const folders = named.filter((f) => f.mimeType.includes("folder") || !f.mimeType);
  return folders[0] ?? named[0] ?? null;
}

function isImageName(name: string) {
  return /\.(png|jpe?g|webp|gif)$/i.test(name);
}

function mimeOf(name: string) {
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.webp$/i.test(name)) return "image/webp";
  if (/\.gif$/i.test(name)) return "image/gif";
  return "image/jpeg";
}

function toDataUrl(name: string, raw: string): string | null {
  const mime = mimeOf(name);
  const s = raw.trim();
  if (s.startsWith("data:")) return s;
  const comma = s.indexOf(",");
  if (comma > 0 && s.slice(0, comma).includes("base64")) {
    return `data:${mime};base64,${s.slice(comma + 1).replace(/\s/g, "")}`;
  }
  if (s.length > 80 && /^[A-Za-z0-9+/=\s]+$/.test(s)) {
    const b64 = s.replace(/\s/g, "");
    if (b64.length > 200_000 * 1.4) return null;
    return `data:${mime};base64,${b64}`;
  }
  return null;
}

function fileKey(name: string) {
  return name.replace(/^\/+/, "").toLowerCase();
}

function lookup(index: Map<string, DriveFile>, path: string): DriveFile | undefined {
  const key = fileKey(path);
  return (
    index.get(key) ||
    index.get(key.replace(/^chars\//, "")) ||
    index.get(key.replace(/^cards\//, "")) ||
    index.get(key.split("/").pop() ?? key)
  );
}

function needsDriveArt(src: unknown) {
  if (typeof src !== "string" || !src.trim()) return true;
  const s = src.trim();
  if (s.startsWith("data:") || /^https?:\/\//i.test(s)) return false;
  if (s.startsWith("/chars/") || s.startsWith("/cards/")) return false;
  return true;
}

export const loadDriveCatalog = createServerFn({ method: "POST" }).handler(
  async (): Promise<DriveCatalogResult> => {
    const found = await searchFolder();
    if (!found.ok) return driveFail(found);

    const folder = pickFolder(asFiles(found.data));
    if (!folder) {
      return {
        ok: true,
        status: "empty",
        message: `ドライブに「${DRIVE_FOLDER}」フォルダがありません。フォルダを作り、chars.json を置いてください。`,
      };
    }

    const listed = await listFolder(folder.id);
    if (!listed.ok) return driveFail(listed);
    const top = asFiles(listed.data);

    const index = new Map<string, DriveFile>();
    for (const f of top) index.set(fileKey(f.name), f);

    for (const sub of top.filter((f) => /^(chars|cards)$/i.test(f.name))) {
      const nested = await listFolder(sub.id);
      if (!nested.ok) continue;
      for (const f of asFiles(nested.data)) {
        index.set(fileKey(`${sub.name}/${f.name}`), f);
        index.set(fileKey(f.name), f);
      }
    }

    const jsonFile =
      lookup(index, "chars.json") ||
      [...index.values()].find((f) => f.name.toLowerCase() === "chars.json");
    if (!jsonFile) {
      return {
        ok: true,
        status: "empty",
        message: `「${DRIVE_FOLDER}」に chars.json がありません。置くまで標準データを使います。`,
      };
    }

    const read = await readFile(jsonFile.id);
    if (!read.ok) return driveFail(read);
    const text = extractText(read.data);
    if (!text) {
      return { ok: false, kind: "error", message: "chars.json の中身を取れなかった。" };
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, kind: "error", message: "chars.json が壊れている。" };
    }

    const list = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && Array.isArray((raw as { chars?: unknown }).chars)
        ? (raw as { chars: Record<string, unknown>[] }).chars
        : [];
    if (!Array.isArray(list) || !list.length) {
      return { ok: true, status: "empty", message: "chars.json にキャラがありません。" };
    }

    const chars = list.map((row) => ({ ...(row as Record<string, unknown>) }));
    let fetched = 0;
    for (const row of chars) {
      if (fetched >= 24) break;
      const id = typeof row.id === "string" ? row.id : "";
      for (const field of ["art", "bust"] as const) {
        const current = row[field];
        const candidates = [
          needsDriveArt(current) ? String(current ?? "") : "",
          field === "art" ? `chars/${id}.png` : `cards/${id}.jpg`,
          field === "art" ? `${id}.png` : `${id}.jpg`,
        ].filter(Boolean);
        if (!needsDriveArt(current) && field === "art") continue;
        if (!needsDriveArt(current) && field === "bust") continue;
        let hit: DriveFile | undefined;
        for (const c of candidates) {
          hit = lookup(index, c);
          if (hit && isImageName(hit.name)) break;
          hit = undefined;
        }
        if (!hit) continue;
        const img = await readFile(hit.id);
        if (!img.ok) continue;
        const body = extractText(img.data);
        if (!body) continue;
        const url = toDataUrl(hit.name, body);
        if (!url) continue;
        row[field] = url;
        fetched += 1;
        if (fetched >= 24) break;
      }
    }

    const payload = JSON.stringify({ chars });
    return { ok: true, status: "loaded", payload, count: chars.length };
  },
);

export const createDriveFolder = createServerFn({ method: "POST" }).handler(
  async (): Promise<DriveCatalogResult> => {
    const found = await searchFolder();
    if (!found.ok) return driveFail(found);
    if (pickFolder(asFiles(found.data))) {
      return {
        ok: true,
        status: "empty",
        message: `「${DRIVE_FOLDER}」は既にあります。chars.json を置いて「ドライブから読む」を押してください。`,
      };
    }
    const created = await driveCall(GoogleDriveTools.createFolder, { folder_name: DRIVE_FOLDER });
    if (!created.ok) return driveFail(created);
    const made = asFile(created.data);
    return {
      ok: true,
      status: "empty",
      message: made
        ? `「${DRIVE_FOLDER}」を作りました。chars.json を置いてください。標準データは書き込みません。`
        : `「${DRIVE_FOLDER}」を作りました。chars.json を置いてください。標準データは書き込みません。`,
    };
  },
);
