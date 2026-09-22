import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("oauth popup token race hardening", () => {
  it("starts waitForPopupToken before pre-sign-in sign-out", () => {
    const src = readFileSync(join(root, "src/lib/auth/client.ts"), "utf8");
    const listenIdx = src.indexOf("const popupToken = popup && !sameWindow ? waitForPopupToken(popup) : null;");
    const clearIdx = src.indexOf("await runPreSignInSignOut({");
    assert.ok(listenIdx > 0, "expected early popupToken listener");
    assert.ok(clearIdx > listenIdx, "listener must be attached before runPreSignInSignOut");
    assert.match(src, /const token = await popupToken/);
  });

  it("completion page retries postMessage before close", () => {
    const src = readFileSync(join(root, "src/lib/auth/popup.server.ts"), "utf8");
    assert.match(src, /tries < 8/);
    assert.match(src, /setTimeout\(post,\s*100\)/);
    assert.match(src, /function post\(\)/);
  });
});
