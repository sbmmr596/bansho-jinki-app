import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SESSION_REFETCH_TIMEOUT_MS,
  SESSION_RESOLVE_TIMEOUT_MS,
  resolveEffectivePending,
  withTimeout,
} from "./session-resolve.ts";

describe("resolveEffectivePending", () => {
  it("stays pending while the session check is in flight", () => {
    assert.equal(
      resolveEffectivePending({ isPending: true, timedOut: false }),
      true,
    );
  });

  it("clears pending after timeout so the gate can show signed_out", () => {
    assert.equal(
      resolveEffectivePending({ isPending: true, timedOut: true }),
      false,
    );
  });

  it("is not pending once Better Auth settles", () => {
    assert.equal(
      resolveEffectivePending({ isPending: false, timedOut: false }),
      false,
    );
    assert.equal(
      resolveEffectivePending({ isPending: false, timedOut: true }),
      false,
    );
  });
});

describe("session resolve timeouts", () => {
  it("uses a short bound so iPhone Safari cannot hang forever", () => {
    assert.ok(SESSION_RESOLVE_TIMEOUT_MS <= 5_000);
    assert.ok(SESSION_RESOLVE_TIMEOUT_MS >= 2_000);
    assert.ok(SESSION_REFETCH_TIMEOUT_MS <= 5_000);
  });
});

describe("withTimeout", () => {
  it("resolves when the promise wins", async () => {
    const value = await withTimeout(Promise.resolve("ok"), 200, "test");
    assert.equal(value, "ok");
  });

  it("rejects when the timer fires first", async () => {
    await assert.rejects(
      () =>
        withTimeout(
          new Promise(() => {
            /* never settles */
          }),
          30,
          "slow-op",
        ),
      /slow-op timed out after 30ms/,
    );
  });
});
