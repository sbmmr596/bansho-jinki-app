import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("card editor session resolve timeout", () => {
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
    const listenIdx = src.indexOf("const popupToken = popup ? waitForPopupToken(popup) : null;");
    const clearIdx = src.indexOf("await runPreSignInSignOut({");
    assert.ok(listenIdx > 0);
    assert.ok(clearIdx > listenIdx);
  });

  it("card editor shows connecting + session check + back, and timeout error", () => {
    const src = readFileSync(
      join(root, "src/components/game/CardEditorPanel.tsx"),
      "utf8",
    );
    assert.match(src, /接続中/);
    assert.match(src, /セッションを確認しています/);
    assert.match(src, /元に戻る/);
    assert.match(src, /sessionResolveTimedOut/);
    assert.match(src, /セッション確認がタイムアウトしました/);
    // Keep #88: pending → loading, not editor
    assert.match(src, /gateState === "pending"/);
    assert.match(src, /resolveSignInGateState/);
  });
});
