import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeLoginProblem, driveFailureMessage, stalledMessage } from "./drive-errors.ts";

describe("describeLoginProblem", () => {
  it("names a missing connector token", () => {
    assert.match(describeLoginProblem("missing_connector_token: open this app"), /トークンなし/);
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
});
