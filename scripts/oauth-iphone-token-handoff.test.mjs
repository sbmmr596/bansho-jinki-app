import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("iPhone OAuth bearer handoff", () => {
  it("completion page writes opener sessionStorage and redirects when no opener", () => {
    const src = readFileSync(join(root, "src/lib/auth/popup.server.ts"), "utf8");
    assert.match(src, /sessionStorage\.setItem\(BEARER_KEY/);
    assert.match(src, /if \(!window\.opener\)/);
    assert.match(src, /location\.replace/);
    assert.match(src, /writeStorage\(window\.opener\)/);
    assert.match(src, /tries < 8/);
  });

  it("client polls storage while waiting and resumes session on visibility", () => {
    const src = readFileSync(join(root, "src/lib/auth/client.ts"), "utf8");
    assert.match(src, /syncBearerFromStorage/);
    assert.match(src, /installPreviewAuthResume/);
    assert.match(src, /visibilitychange/);
    assert.match(src, /pageshow/);
    assert.match(src, /sameWindow/);
    // Listener still before pre-sign-in clear (#89)
    const listenIdx = src.indexOf(
      "const popupToken = popup && !sameWindow ? waitForPopupToken(popup) : null;",
    );
    const clearIdx = src.indexOf("await runPreSignInSignOut({");
    assert.ok(listenIdx > 0, "expected early popupToken listener");
    assert.ok(clearIdx > listenIdx, "listener must be attached before runPreSignInSignOut");
  });

  it("preview bearer storage key is shared between client and completion page", () => {
    const keySrc = readFileSync(
      join(root, "src/lib/auth/preview-bearer.ts"),
      "utf8",
    );
    const keyMatch = keySrc.match(
      /PREVIEW_BEARER_STORAGE_KEY\s*=\s*"([^"]+)"/,
    );
    assert.ok(keyMatch, "expected PREVIEW_BEARER_STORAGE_KEY");
    const key = keyMatch[1];
    const popup = readFileSync(join(root, "src/lib/auth/popup.server.ts"), "utf8");
    assert.match(popup, new RegExp(key.replace(/\./g, "\\.")));
    const client = readFileSync(join(root, "src/lib/auth/client.ts"), "utf8");
    assert.match(client, /PREVIEW_BEARER_STORAGE_KEY/);
  });

  it("card editor and SignInGate pass preview bearer into gate resolve", () => {
    const panel = readFileSync(
      join(root, "src/components/game/CardEditorPanel.tsx"),
      "utf8",
    );
    assert.match(panel, /hasPreviewBearer:\s*bearerMeta\.hasBearer/);
    assert.match(panel, /subscribePreviewBearer/);
    const gates = readFileSync(join(root, "src/lib/auth/gates.tsx"), "utf8");
    assert.match(gates, /hasPreviewBearer:\s*bearerMeta\.hasBearer/);
  });

  it("getPreviewBearerMeta caches snapshot for useSyncExternalStore", () => {
    const client = readFileSync(join(root, "src/lib/auth/client.ts"), "utf8");
    assert.match(client, /nextPreviewBearerMeta/);
    assert.match(client, /bearerMetaSnapshot/);
    assert.match(client, /getServerPreviewBearerMeta/);
    // Must not allocate a fresh object literal inside getPreviewBearerMeta body.
    const fnStart = client.indexOf("export function getPreviewBearerMeta");
    assert.ok(fnStart > 0, "expected getPreviewBearerMeta");
    const fnBody = client.slice(fnStart, fnStart + 280);
    assert.doesNotMatch(
      fnBody,
      /return\s*\{\s*hasBearer:/,
      "getPreviewBearerMeta must not return a fresh object literal (Maximum update depth)",
    );
    const panel = readFileSync(
      join(root, "src/components/game/CardEditorPanel.tsx"),
      "utf8",
    );
    assert.match(panel, /getServerPreviewBearerMeta/);
    const gates = readFileSync(join(root, "src/lib/auth/gates.tsx"), "utf8");
    assert.match(gates, /getServerPreviewBearerMeta/);
  });

});
