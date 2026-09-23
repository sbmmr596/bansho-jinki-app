import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Mirror of nextPreviewBearerMeta in preview-bearer.ts — keep in sync.
 * useSyncExternalStore requires Object.is-stable snapshots.
 */
function nextPreviewBearerMeta(prev, hasBearer, appliedAt) {
  if (prev.hasBearer === hasBearer && prev.appliedAt === appliedAt) return prev;
  return { hasBearer, appliedAt };
}

describe("preview bearer meta snapshot (Maximum update depth guard)", () => {
  it("source exports nextPreviewBearerMeta with referential reuse", () => {
    const src = readFileSync(join(root, "src/lib/auth/preview-bearer.ts"), "utf8");
    assert.match(src, /export function nextPreviewBearerMeta/);
    assert.match(src, /prev\.hasBearer === hasBearer && prev\.appliedAt === appliedAt/);
    assert.match(src, /EMPTY_PREVIEW_BEARER_META/);
  });

  it("returns the same reference when values are unchanged", () => {
    const prev = { hasBearer: true, appliedAt: 1000 };
    assert.equal(nextPreviewBearerMeta(prev, true, 1000), prev);
  });

  it("allocates only when values change", () => {
    const prev = { hasBearer: false, appliedAt: null };
    const a = nextPreviewBearerMeta(prev, true, 2000);
    assert.notEqual(a, prev);
    const b = nextPreviewBearerMeta(a, true, 2000);
    assert.equal(b, a);
  });

  it("client getPreviewBearerMeta uses the cache helper", () => {
    const client = readFileSync(join(root, "src/lib/auth/client.ts"), "utf8");
    assert.match(client, /bearerMetaSnapshot/);
    assert.match(client, /syncBearerMetaSnapshot/);
    assert.match(client, /nextPreviewBearerMeta/);
    const fnStart = client.indexOf("export function getPreviewBearerMeta");
    assert.ok(fnStart > 0);
    const fnBody = client.slice(fnStart, fnStart + 280);
    assert.doesNotMatch(fnBody, /return\s*\{\s*hasBearer:/);
  });
});
