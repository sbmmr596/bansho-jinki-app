import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveSignInGateState } from "./sign-in-gate.ts";

describe("resolveSignInGateState", () => {
  it("is pending while the session check is in flight, user or not", () => {
    assert.equal(
      resolveSignInGateState({ isPending: true, hasUser: false }),
      "pending",
    );
    assert.equal(
      resolveSignInGateState({ isPending: true, hasUser: true }),
      "pending",
    );
  });

  it("is signed_in once a user is present", () => {
    assert.equal(
      resolveSignInGateState({ isPending: false, hasUser: true }),
      "signed_in",
    );
  });

  it("is signed_out only after the check resolved with no user", () => {
    assert.equal(
      resolveSignInGateState({ isPending: false, hasUser: false }),
      "signed_out",
    );
  });

  it("stays pending during bearer grace so a just-applied token does not bounce to Continue with", () => {
    assert.equal(
      resolveSignInGateState({
        isPending: false,
        hasUser: false,
        hasPreviewBearer: true,
        previewBearerAppliedAt: 1_000,
        nowMs: 1_000 + 3_000,
        bearerGraceMs: 10_000,
      }),
      "pending",
    );
  });

  it("falls through to signed_out after bearer grace (hang → Continue with, token kept)", () => {
    assert.equal(
      resolveSignInGateState({
        isPending: false,
        hasUser: false,
        hasPreviewBearer: true,
        previewBearerAppliedAt: 1_000,
        nowMs: 1_000 + 12_000,
        bearerGraceMs: 10_000,
      }),
      "signed_out",
    );
  });
});
