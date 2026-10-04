import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_HOST_BASE,
  fetchHostCatalog,
  getHostBase,
  getSavedHostId,
  hostFileUrl,
  isValidHostId,
  normalizeHostId,
  prepareHostCatalog,
  readHostParam,
  resolveHostImage,
  stripHostParam,
} from "./host-catalog.ts";

const ID = "7poddxmkvg4ybmwnsqagquaih5";
const BASE = "https://example.test/x/api.php";

function mem(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const jsonRes = (status: number, body: unknown) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

describe("host id", () => {
  it("trims and lowercases, and pulls the id out of a pasted link", () => {
    assert.equal(normalizeHostId(`  ${ID.toUpperCase()} \n`), ID);
    assert.equal(normalizeHostId(`https://bansho-jinki.grok.me/?host=${ID}`), ID);
    assert.equal(normalizeHostId(`https://h/api.php?id=${ID}&f=chars.json`), ID);
  });
  it("validates 26 chars of a-z2-7", () => {
    assert.ok(isValidHostId(ID));
    assert.ok(!isValidHostId(ID.slice(1)));
    assert.ok(!isValidHostId(`${ID.slice(1)}1`));
    assert.ok(!isValidHostId(`${ID.slice(1)}A`));
  });
  it("reads ?host= and #host= and strips them", () => {
    assert.equal(readHostParam({ search: `?host=${ID}`, hash: "" }), ID);
    assert.equal(readHostParam({ search: "", hash: `#host=${ID}` }), ID);
    assert.equal(readHostParam({ search: "?host=short", hash: "" }), "");
    assert.equal(stripHostParam({ pathname: "/", search: `?a=1&host=${ID}`, hash: `#host=${ID}` }), "/?a=1");
  });
});

describe("storage", () => {
  it("base defaults and can be overridden", () => {
    assert.equal(getHostBase(mem()), DEFAULT_HOST_BASE);
    assert.equal(getHostBase(mem({ "bansho-host-base": "http://127.0.0.1:8099/api.php" })), "http://127.0.0.1:8099/api.php");
    assert.equal(getHostBase(mem({ "bansho-host-base": "javascript:1" })), DEFAULT_HOST_BASE);
  });
  it("ignores a bad saved id", () => {
    assert.equal(getSavedHostId(mem({ "bansho-host-id": ID })), ID);
    assert.equal(getSavedHostId(mem({ "bansho-host-id": "nope" })), "");
  });
});

describe("image resolving", () => {
  const u = (rel: string) => hostFileUrl(BASE, ID, rel);
  it("maps img/ names to the host", () => {
    assert.equal(resolveHostImage("img/a.png", BASE, ID), u("img/a.png"));
    assert.equal(resolveHostImage("./img/A_b-1.JPG", BASE, ID), u("img/a_b-1.jpg"));
    assert.equal(resolveHostImage("/img/a.webp", BASE, ID), u("img/a.webp"));
    assert.equal(resolveHostImage("a.jpeg", BASE, ID), u("img/a.jpeg"));
  });
  it("keeps bundled paths, URLs and data URLs", () => {
    for (const s of ["/cards/sora.jpg", "/chars/sora.png?v=k4", "https://cdn.test/a.png", "data:image/png;base64,AA", "//cdn/a.png"]) {
      assert.equal(resolveHostImage(s, BASE, ID), s);
    }
  });
  it("leaves odd values alone", () => {
    assert.equal(resolveHostImage(undefined, BASE, ID), undefined);
    assert.equal(resolveHostImage("", BASE, ID), "");
    assert.equal(resolveHostImage("img/bad name.png", BASE, ID), "img/bad name.png");
    assert.equal(resolveHostImage("a/b/c.png", BASE, ID), "a/b/c.png");
  });
  it("prepares both array and {chars} shapes without mutating", () => {
    const raw = { factions: { koryu: "x" }, chars: [{ id: "a", art: "img/a.png", bust: "/cards/sora.jpg" }, null] };
    const out = prepareHostCatalog(raw, BASE, ID) as typeof raw;
    assert.equal(out.chars[0]!.art, hostFileUrl(BASE, ID, "img/a.png"));
    assert.equal(out.chars[0]!.bust, "/cards/sora.jpg");
    assert.equal(raw.chars[0]!.art, "img/a.png");
    assert.equal(out.factions.koryu, "x");
    const arr = prepareHostCatalog([{ id: "a", bust: "b.png" }], BASE, ID) as Array<{ bust: string }>;
    assert.equal(arr[0]!.bust, hostFileUrl(BASE, ID, "img/b.png"));
  });
});

describe("fetchHostCatalog", () => {
  it("returns the parsed json and requests ?id&f=chars.json", async () => {
    let url = "";
    const r = await fetchHostCatalog(ID, {
      base: BASE,
      fetchImpl: async (u) => ((url = u), jsonRes(200, "\uFEFF" + JSON.stringify({ chars: [] }))),
    });
    assert.ok(r.ok);
    assert.equal(url, `${BASE}?id=${ID}&f=chars.json`);
  });
  it("maps errors to Japanese messages", async () => {
    const run = (res: () => Promise<Response>) => fetchHostCatalog(ID, { base: BASE, fetchImpl: res });
    const nf = await run(async () => jsonRes(404, { ok: false, error: "not_found", message: "x" }));
    assert.deepEqual(nf.ok ? null : [nf.kind, nf.message], ["not_found", "chars.json がまだ置かれていません"]);
    const dis = await run(async () => jsonRes(403, { ok: false, error: "disabled", message: "x" }));
    assert.deepEqual(dis.ok ? null : [dis.kind, dis.message], ["disabled", "このIDは停止中です"]);
    const net = await run(async () => {
      throw new TypeError("Failed to fetch");
    });
    assert.deepEqual(net.ok ? null : [net.kind, net.message], ["network", "サーバーに接続できません"]);
    const bad = await run(async () => jsonRes(200, "<html>"));
    assert.equal(bad.ok ? "" : bad.kind, "invalid");
    const srv = await run(async () => jsonRes(500, "oops"));
    assert.equal(srv.ok ? "" : srv.kind, "http");
  });
  it("rejects a bad id without fetching", async () => {
    let called = false;
    const r = await fetchHostCatalog("short", { base: BASE, fetchImpl: async () => ((called = true), jsonRes(200, "{}")) });
    assert.ok(!r.ok && r.kind === "bad_id");
    assert.ok(!called);
  });
});
