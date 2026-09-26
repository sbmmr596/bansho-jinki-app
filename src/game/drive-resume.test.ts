import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  beginDriveResume,
  clearDriveAuthAttempt,
  clearDriveResume,
  clearFolderAuthAttempt,
  driveAuthAttempted,
  driveResumeAction,
  driveResumePending,
  folderAuthAttempted,
  loginUrlWithDriveResume,
  markDriveAuthAttempt,
  markDriveResume,
  markFolderAuthAttempt,
} from "./drive-resume.ts";

type Mem = {
  store: Map<string, string>;
  href: string;
  replaced: string[];
};

function install(href: string): Mem {
  const mem: Mem = { store: new Map(), href, replaced: [] };
  const sessionStorage = {
    getItem: (k: string) => mem.store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.store.set(k, v);
    },
    removeItem: (k: string) => {
      mem.store.delete(k);
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { href: mem.href },
      history: {
        state: null,
        replaceState: (_s: unknown, _t: string, next: string) => {
          mem.replaced.push(next);
          mem.href = new URL(next, mem.href).href;
          (globalThis as { window: { location: { href: string } } }).window.location.href = mem.href;
        },
      },
      sessionStorage,
    },
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: sessionStorage,
  });
  return mem;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
});

describe("loginUrlWithDriveResume", () => {
  it("adds resume=drive to return_to", () => {
    const next = loginUrlWithDriveResume(
      "https://gate.grok.me/__gate/signin?return_to=https%3A%2F%2Fapp.grok.me",
    );
    const u = new URL(next);
    const back = new URL(u.searchParams.get("return_to") ?? "");
    assert.equal(back.origin, "https://app.grok.me");
    assert.equal(back.searchParams.get("resume"), "drive");
  });

  it("leaves a url without return_to unchanged", () => {
    const raw = "https://gate.grok.me/__gate/signin";
    assert.equal(loginUrlWithDriveResume(raw), raw);
  });

  it("adds resume=folder when the action is folder", () => {
    const next = loginUrlWithDriveResume(
      "https://gate.grok.me/__gate/signin?return_to=https%3A%2F%2Fapp.grok.me",
      "folder",
    );
    const back = new URL(new URL(next).searchParams.get("return_to") ?? "");
    assert.equal(back.searchParams.get("resume"), "folder");
  });
});

describe("drive resume flag", () => {
  it("is pending from sessionStorage and clears", () => {
    const mem = install("https://app.grok.me/");
    assert.equal(driveResumePending(), false);
    markDriveResume();
    assert.equal(driveResumePending(), true);
    clearDriveResume();
    assert.equal(driveResumePending(), false);
    assert.equal(mem.store.size, 0);
  });

  it("is pending from the return query and strips it", () => {
    const mem = install("https://app.grok.me/?resume=drive");
    assert.equal(driveResumePending(), true);
    assert.equal(driveResumeAction(), "read");
    clearDriveResume();
    assert.equal(driveResumePending(), false);
    assert.equal(mem.replaced[0], "/");
  });

  it("resumes folder creation from the return query", () => {
    const mem = install("https://app.grok.me/?resume=folder");
    assert.equal(driveResumeAction(), "folder");
    clearDriveResume();
    assert.equal(driveResumePending(), false);
    assert.equal(mem.replaced[0], "/");
  });

  it("remembers a folder auth attempt so the next press does not redirect", () => {
    install("https://app.grok.me/");
    assert.equal(folderAuthAttempted(1_000), false);
    markFolderAuthAttempt(1_000);
    assert.equal(folderAuthAttempted(1_000 + 1000), true);
    assert.equal(folderAuthAttempted(1_000 + 10 * 60 * 1000), false);
    clearFolderAuthAttempt();
    assert.equal(folderAuthAttempted(1_000 + 1000), false);
  });

  it("remembers a read auth attempt so ドライブから読む does not redirect again", () => {
    install("https://app.grok.me/");
    assert.equal(driveAuthAttempted("read", 1_000), false);
    markDriveAuthAttempt("read", 1_000);
    assert.equal(driveAuthAttempted("read", 1_000 + 1000), true);
    assert.equal(driveAuthAttempted("folder", 1_000 + 1000), false);
    assert.equal(driveAuthAttempted("read", 1_000 + 10 * 60 * 1000), false);
    clearDriveAuthAttempt("read");
    assert.equal(driveAuthAttempted("read", 1_000 + 1000), false);
  });

  it("shares one load across a second caller", async () => {
    install("https://app.grok.me/?resume=drive");
    let calls = 0;
    const load = () => {
      calls += 1;
      return Promise.resolve("ok");
    };
    const first = beginDriveResume(() => load());
    const second = beginDriveResume(() => load());
    assert.equal(first, second);
    assert.equal(await first, "ok");
    assert.equal(calls, 1);
    assert.equal(driveResumePending(), false);
    assert.equal(beginDriveResume(load), null);
  });

  it("passes folder to the resumed action", async () => {
    install("https://app.grok.me/?resume=folder");
    let seen = "";
    const job = beginDriveResume(async (action) => {
      seen = action;
      return action;
    });
    assert.equal(await job, "folder");
    assert.equal(seen, "folder");
  });
});
