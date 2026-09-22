import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("signin visible errors", () => {
  it("SignInButtons awaits signIn and surfaces catch message", () => {
    const src = readFileSync(join(root, "src/lib/auth/gates.tsx"), "utf8");
    assert.match(src, /await signIn\(providerId/);
    assert.match(src, /setError\(formatSignInError\(err\)\)/);
    assert.match(src, /disabled=\{busyProviderId !== null\}/);
    assert.match(src, /接続中…/);
    assert.match(
      src,
      /ポップアップがブロックされました。プレビューでポップアップを許可して再試行してください。/,
    );
    assert.match(src, /サインインがキャンセルされました/);
  });

  it("waitForPopupToken rejects with popup error when token is null", () => {
    const src = readFileSync(join(root, "src/lib/auth/client.ts"), "utf8");
    assert.match(src, /reject\(new Error\(error\)\)/);
    assert.match(src, /settle\(data\.token \?\? null, data\.error\)/);
  });
});
