import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("card editor session resolve timeout (auth still elsewhere)", () => {
  it("useCurrentUserState bounds pending via session-resolve", () => {
    const src = readFileSync(join(root, "src/lib/auth/use-current-user.ts"), "utf8");
    assert.match(src, /SESSION_RESOLVE_TIMEOUT_MS/);
    assert.match(src, /resolveEffectivePending/);
    assert.match(src, /sessionResolveTimedOut/);
  });

  it("popup session refetch is bounded", () => {
    const src = readFileSync(join(root, "src/lib/auth/client.ts"), "utf8");
    assert.match(src, /withTimeout\(run\(\), SESSION_REFETCH_TIMEOUT_MS/);
    // Keep #89: listen before pre-sign-in clear
    const listenIdx = src.indexOf("const popupToken = popup && !sameWindow ? waitForPopupToken(popup) : null;");
    const clearIdx = src.indexOf("await runPreSignInSignOut({");
    assert.ok(listenIdx > 0);
    assert.ok(clearIdx > listenIdx);
  });

  it("preview bearer snapshot stays referentially stable (#94)", () => {
    const src = readFileSync(join(root, "src/lib/auth/preview-bearer.ts"), "utf8");
    assert.match(src, /nextPreviewBearerMeta/);
    assert.match(src, /EMPTY_PREVIEW_BEARER_META/);
    assert.match(src, /Object\.is/);
  });
});
