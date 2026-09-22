import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLoopbackHostname,
  isPreviewAllowedHostname,
  parseTrustedPublicOrigin,
  resolvePublicAuthOrigin,
} from "./public-origin.server.ts";

describe("isPreviewAllowedHostname", () => {
  it("allows grok-sandbox subdomains", () => {
    assert.equal(isPreviewAllowedHostname("abc.grok-sandbox.com"), true);
    assert.equal(isPreviewAllowedHostname("a.b.grok-sandbox.com"), true);
  });
  it("rejects apex and unrelated hosts", () => {
    assert.equal(isPreviewAllowedHostname("grok-sandbox.com"), false);
    assert.equal(isPreviewAllowedHostname("evil.com"), false);
    assert.equal(isPreviewAllowedHostname("localhost"), false);
  });
});

describe("parseTrustedPublicOrigin", () => {
  it("accepts https preview origins", () => {
    assert.equal(
      parseTrustedPublicOrigin("https://sess.grok-sandbox.com/path?x=1"),
      "https://sess.grok-sandbox.com",
    );
  });
  it("rejects http preview, loopback, and foreign hosts", () => {
    assert.equal(parseTrustedPublicOrigin("http://sess.grok-sandbox.com"), null);
    assert.equal(parseTrustedPublicOrigin("http://localhost:8080"), null);
    assert.equal(parseTrustedPublicOrigin("https://evil.com"), null);
    assert.equal(parseTrustedPublicOrigin("https://app.grok.me"), null);
  });
});

describe("resolvePublicAuthOrigin", () => {
  it("prefers the validated query origin over loopback Host", () => {
    const req = new Request("http://127.0.0.1:8080/auth/popup", {
      headers: { host: "127.0.0.1:8080" },
    });
    const resolved = resolvePublicAuthOrigin(req, "https://live.grok-sandbox.com");
    assert.deepEqual(resolved, {
      origin: "https://live.grok-sandbox.com",
      source: "query",
    });
  });

  it("uses x-forwarded-host when query is absent", () => {
    const req = new Request("http://127.0.0.1:8080/auth/popup", {
      headers: {
        host: "127.0.0.1:8080",
        "x-forwarded-host": "fwd.grok-sandbox.com",
        "x-forwarded-proto": "https",
      },
    });
    const resolved = resolvePublicAuthOrigin(req, null);
    assert.deepEqual(resolved, {
      origin: "https://fwd.grok-sandbox.com",
      source: "forwarded",
    });
  });

  it("returns null on pure loopback (no usable public origin)", () => {
    const req = new Request("http://localhost:8080/auth/popup", {
      headers: { host: "localhost:8080" },
    });
    assert.equal(resolvePublicAuthOrigin(req, null), null);
    assert.equal(isLoopbackHostname("localhost"), true);
  });
});
