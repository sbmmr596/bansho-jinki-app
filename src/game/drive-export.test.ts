import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { exportWithFallback } from "./drive-export.ts";

const fail = (o: object) => ({ ok: false as const, kind: "login" as const, message: "m", ...o });

describe("exportWithFallback", () => {
  it("uses Drive when it works and does not download", async () => {
    let downloads = 0;
    const out = await exportWithFallback({
      saveDrive: async () => ({ ok: true, status: "saved", message: "ドライブに書き出した。" }),
      download: () => void (downloads += 1),
    });
    assert.equal(out.via, "drive");
    assert.equal(downloads, 0);
  });

  it("falls back to a local download on a missing token", async () => {
    let downloads = 0;
    const out = await exportWithFallback({
      saveDrive: async () =>
        fail({ loginRequired: true, detail: "missing_connector_token: x" }),
      download: () => void (downloads += 1),
    });
    assert.equal(out.via, "local");
    assert.equal(downloads, 1);
    assert.match(out.message, /端末にダウンロード/);
    assert.match(out.message, /ドライブに書けなかった/);
    assert.match(out.message, /届いていない/);
  });

  it("falls back on login required and on any other Drive failure", async () => {
    for (const r of [
      fail({ loginRequired: true, loginUrl: "https://gate/x" }),
      fail({ kind: "not_connected" }),
      fail({ kind: "error", detail: "HTTP 500" }),
    ]) {
      let downloads = 0;
      const out = await exportWithFallback({ saveDrive: async () => r, download: () => void (downloads += 1) });
      assert.equal(out.via, "local");
      assert.equal(downloads, 1);
    }
  });

  it("falls back when the server call itself throws", async () => {
    let downloads = 0;
    const out = await exportWithFallback({
      saveDrive: async () => {
        throw new Error("network");
      },
      download: () => void (downloads += 1),
    });
    assert.equal(out.via, "local");
    assert.equal(downloads, 1);
  });

  it("reports (never throws) when the download also fails", async () => {
    const out = await exportWithFallback({
      saveDrive: async () => fail({}),
      download: () => {
        throw new Error("blocked");
      },
    });
    assert.equal(out.via, "failed");
    assert.match(out.message, /ダウンロードも失敗/);
  });
});
