import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_PREVIEW_BEARER_META,
  nextPreviewBearerMeta,
  type PreviewBearerMeta,
} from "./preview-bearer.ts";

describe("nextPreviewBearerMeta (useSyncExternalStore snapshot)", () => {
  it("returns the same reference when values are unchanged", () => {
    const prev: PreviewBearerMeta = { hasBearer: true, appliedAt: 1000 };
    const next = nextPreviewBearerMeta(prev, true, 1000);
    assert.equal(next, prev);
  });

  it("allocates a new object when hasBearer changes", () => {
    const prev: PreviewBearerMeta = { hasBearer: false, appliedAt: null };
    const next = nextPreviewBearerMeta(prev, true, 2000);
    assert.notEqual(next, prev);
    assert.deepEqual(next, { hasBearer: true, appliedAt: 2000 });
  });

  it("allocates a new object when appliedAt changes", () => {
    const prev: PreviewBearerMeta = { hasBearer: true, appliedAt: 1000 };
    const next = nextPreviewBearerMeta(prev, true, 2000);
    assert.notEqual(next, prev);
    assert.equal(next.appliedAt, 2000);
  });

  it("EMPTY_PREVIEW_BEARER_META is a stable singleton", () => {
    assert.equal(EMPTY_PREVIEW_BEARER_META.hasBearer, false);
    assert.equal(EMPTY_PREVIEW_BEARER_META.appliedAt, null);
    assert.equal(
      nextPreviewBearerMeta(EMPTY_PREVIEW_BEARER_META, false, null),
      EMPTY_PREVIEW_BEARER_META,
    );
  });
});
