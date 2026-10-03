import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describeLoginProblem,
  driveFailureMessage,
  isMissingTokenDetail,
  isRetryableLogin,
  shortDriveReason,
  stalledMessage,
} from "./drive-errors.ts";

describe("describeLoginProblem", () => {
  it("names a missing connector token", () => {
    assert.match(describeLoginProblem("missing_connector_token: open this app"), /トークンなし/);
  });
  it("does not blame Safari for a missing token and points to the local paths", () => {
    const t = describeLoginProblem("missing_connector_token: open this app");
    assert.doesNotMatch(t, /Safari|開き直/);
    assert.match(t, /Grok/);
    assert.match(t, /ブラウザの問題ではありません/);
    assert.match(t, /JSONを読む/);
    assert.match(t, /ダウンロード/);
  });
  it("detects the missing token wording", () => {
    assert.equal(isMissingTokenDetail("missing_connector_token: x"), true);
    assert.equal(isMissingTokenDetail("Missing connector token"), true);
    assert.equal(isMissingTokenDetail("login required"), false);
    assert.equal(isMissingTokenDetail(undefined), false);
  });
  it("names a missing scope", () => {
    assert.match(describeLoginProblem("insufficient scope drive.readonly"), /読み取り権限/);
  });
  it("names an expired grant", () => {
    assert.match(describeLoginProblem("invalid_grant"), /切れて/);
  });
  it("falls back to not-yet-reflected", () => {
    assert.match(describeLoginProblem("login required"), /反映されていません/);
    assert.match(describeLoginProblem(undefined), /反映されていません/);
  });
});

describe("driveFailureMessage", () => {
  it("covers each kind", () => {
    assert.match(driveFailureMessage("not_connected"), /接続/);
    assert.match(driveFailureMessage("scope_denied"), /許可が付いていません/);
    assert.match(driveFailureMessage("access_denied"), /権限がありません/);
    assert.match(driveFailureMessage("error", "HTTP 500"), /HTTP 500/);
    assert.equal(driveFailureMessage("error"), "ドライブを読めなかった。");
  });
});

describe("stalledMessage", () => {
  it("tells the next step", () => {
    assert.match(stalledMessage("ドライブから読む", "login required", false), /少し待って/);
    assert.match(stalledMessage("ドライブから読む", "login required", true), /開き直します/);
  });
  it("only explains a missing token (re-auth would not help)", () => {
    for (const reauth of [true, false]) {
      const t = stalledMessage("ドライブから読む", "missing_connector_token", reauth);
      assert.equal(t, describeLoginProblem("missing_connector_token"));
      assert.doesNotMatch(t, /開き直します|少し待って/);
    }
  });
});

describe("isRetryableLogin", () => {
  it("retries a lagging grant but not a missing token", () => {
    assert.equal(isRetryableLogin({ ok: false, loginRequired: true, detail: "login required" }), true);
    assert.equal(isRetryableLogin({ ok: false, loginRequired: true, detail: "missing_connector_token" }), false);
    assert.equal(isRetryableLogin({ ok: false }), false);
    assert.equal(isRetryableLogin({ ok: true }), false);
  });
});

describe("shortDriveReason", () => {
  const f = (o: object) => ({ ok: false as const, kind: "error" as const, message: "m", ...o });
  it("is short and specific", () => {
    assert.match(shortDriveReason(f({ kind: "login", loginRequired: true, detail: "missing_connector_token" })), /届いていない/);
    assert.match(shortDriveReason(f({ kind: "login", loginRequired: true })), /未反映/);
    assert.match(shortDriveReason(f({ kind: "not_connected" })), /未接続/);
    assert.match(shortDriveReason(f({ kind: "error", detail: "HTTP 500" })), /HTTP 500/);
    assert.match(shortDriveReason(f({})), /書けなかった/);
  });
});
