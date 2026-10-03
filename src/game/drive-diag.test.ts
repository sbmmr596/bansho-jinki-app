import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDriveDiag } from "./drive-diag.ts";

describe("formatDriveDiag", () => {
  it("prints presence, names and hosts as plain lines", () => {
    const lines = formatDriveDiag({
      connectorToken: false,
      gateIdentity: true,
      cookieNames: ["better-auth.session_token", "theme"],
      forwardedHost: "app.grok.me",
      host: null,
      connectorsHost: "connectors.grok.me",
      authSession: null,
    });
    assert.deepEqual(lines, [
      "x-connector-access-token: なし",
      "x-grok-identity: あり",
      "Cookie名: better-auth.session_token, theme",
      "x-forwarded-host: app.grok.me",
      "host: なし",
      "コネクタ接続先: connectors.grok.me",
      "ログインセッション: 確認できず",
    ]);
  });

  it("handles an empty request", () => {
    const lines = formatDriveDiag({
      connectorToken: false,
      gateIdentity: false,
      cookieNames: [],
      forwardedHost: null,
      host: null,
      connectorsHost: null,
      authSession: false,
    });
    assert.match(lines.join("\n"), /Cookie名: なし/);
    assert.match(lines.join("\n"), /解決できず/);
  });
});
