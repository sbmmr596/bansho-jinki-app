import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jsQR from "jsqr";
import { buildHostLink, extractHostIdFromScan } from "./host-catalog.ts";
import { makeQrMatrix, QR_QUIET, qrToRgba } from "./host-qr.ts";
import { cameraErrorMessage } from "./host-scan.ts";

const ID = "7poddxmkvg4ybmwnsqagquaih5";

function roundTrip(text: string, cell: number) {
  return makeQrMatrix(text).then((m) => {
    const img = qrToRgba(m, cell);
    return { m, img, hit: jsQR(img.data, img.width, img.height) };
  });
}

describe("host QR", () => {
  it("renders a matrix with a white quiet zone that decodes back to the exact link", async () => {
    const link = buildHostLink({ origin: "https://bansho-jinki.grok.me", pathname: "/" }, ID);
    const { m, img, hit } = await roundTrip(link, 6);
    assert.equal(hit?.data, link);
    assert.equal(img.width, (m.length + QR_QUIET * 2) * 6);
    // 外周は全部白
    for (let i = 0; i < img.width * QR_QUIET * 6; i++) assert.equal(img.data[i * 4], 255);
    assert.equal(extractHostIdFromScan(hit!.data), ID);
  });
  it("round-trips a deeper path and different cell sizes", async () => {
    const link = buildHostLink({ origin: "http://localhost:8080", pathname: "/a/b/" }, ID);
    for (const cell of [3, 4, 8]) assert.equal((await roundTrip(link, cell)).hit?.data, link);
  });
});

describe("camera errors", () => {
  it("points to the photo fallback in Japanese", () => {
    const denied = cameraErrorMessage({ name: "NotAllowedError" });
    assert.equal(denied, "カメラが使えません。写真から読むを試してください");
    assert.equal(cameraErrorMessage(new TypeError("x")), denied);
    for (const name of ["NotFoundError", "NotReadableError", "OverconstrainedError"]) {
      assert.ok(cameraErrorMessage({ name }).includes("写真から読むを試してください"));
    }
    assert.ok(cameraErrorMessage(null).includes("写真から読む"));
  });
});
