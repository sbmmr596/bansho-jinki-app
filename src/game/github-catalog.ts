import { createServerFn } from "@tanstack/react-start";

export const GH_KEY = "bansho-github-repo";
export const DEFAULT_GH_REPO = "sbmmr596/bansho-jinki";

export type GithubCatalogResult =
  | { ok: true; status: "loaded"; payload: string; count: number; repo: string }
  | { ok: true; status: "empty"; message: string }
  | { ok: false; message: string };

function parseRepo(raw: string) {
  const s = raw.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/, "").replace(/\/+$/, "");
  const parts = s.split("/").filter(Boolean);
  const owner = parts[0] ?? "";
  const name = (parts[1] ?? "").replace(/#.*$/, "");
  const branch = parts[2] === "tree" && parts[3] ? parts[3] : "main";
  return { owner, name, branch };
}

function rewritePaths(raw: unknown, base: string): unknown {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { chars?: unknown }).chars)
      ? [...(raw as { chars: Record<string, unknown>[] }).chars]
      : [];
  const chars = list.map((row) => {
    const next = { ...(row as Record<string, unknown>) };
    for (const field of ["art", "bust"] as const) {
      const v = next[field];
      if (typeof v !== "string") continue;
      const s = v.trim();
      if (!s || s.startsWith("http") || s.startsWith("/") || s.startsWith("data:")) continue;
      next[field] = `${base}/${s.replace(/^\.\//, "")}`;
    }
    return next;
  });
  return { chars };
}

export const loadGithubCatalog = createServerFn({ method: "POST" })
  .validator((repo: string) => repo)
  .handler(async ({ data: repo }): Promise<GithubCatalogResult> => {
    const spec = parseRepo(typeof repo === "string" && repo.trim() ? repo : DEFAULT_GH_REPO);
    if (!spec.owner || !spec.name) {
      return { ok: false, message: "リポジトリは owner/name の形で。" };
    }
    const label = `${spec.owner}/${spec.name}`;
    const base = `https://raw.githubusercontent.com/${spec.owner}/${spec.name}/${spec.branch}`;
    const url = `${base}/chars.json`;
    let text = "";
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.status === 404) {
        return {
          ok: true,
          status: "empty",
          message: `${label} に chars.json がありません。置くまで標準データを使います。`,
        };
      }
      if (!res.ok) {
        return { ok: false, message: `GitHubを読めなかった（${res.status}）。公開リポジトリか確認して。` };
      }
      text = await res.text();
    } catch {
      return { ok: false, message: "GitHubに届かなかった。" };
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, message: "chars.json が壊れている。" };
    }
    const rewritten = rewritePaths(raw, base);
    const n = Array.isArray((rewritten as { chars: unknown[] }).chars)
      ? (rewritten as { chars: unknown[] }).chars.length
      : 0;
    if (!n) {
      return { ok: true, status: "empty", message: "chars.json にキャラがありません。" };
    }
    return { ok: true, status: "loaded", payload: JSON.stringify(rewritten), count: n, repo: label };
  });
