import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  beginDriveResume,
  clearDriveAuthAttempt,
  clearDriveResume,
  clearFolderAuthAttempt,
  decideDriveLogin,
  driveAuthAttempted,
  retryWhileLoginRequired,
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
  local: Map<string, string>;
};

function install(href: string): Mem {
  const mem: Mem = { store: new Map(), href, replaced: [], local: new Map() };
  const localStore = new Map<string, string>();
  const local = {
    getItem: (k: string) => localStore.get(k) ?? null,
    setItem: (k: string, v: string) => {
      localStore.set(k, v);
    },
    removeItem: (k: string) => {
      localStore.delete(k);
    },
  };
  mem.local = localStore;
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
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: local,
  });
  return mem;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  delete (globalThis as { localStorage?: unknown }).localStorage;
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

  it("adds resume=export when the action is export", () => {
    const next = loginUrlWithDriveResume(
      "https://gate.grok.me/__gate/signin?return_to=https%3A%2F%2Fapp.grok.me",
      "export",
    );
    const back = new URL(new URL(next).searchParams.get("return_to") ?? "");
    assert.equal(back.searchParams.get("resume"), "export");
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

describe("intent survives a different webview / new tab (localStorage)", () => {
  it("is pending from localStorage when sessionStorage is empty", () => {
    const mem = install("https://app.grok.me/");
    markDriveResume("read", 1_000);
    mem.store.clear(); // new tab / system browser: sessionStorage is gone
    assert.equal(driveResumeAction(1_000 + 5_000), "read");
    markDriveResume("folder", 2_000);
    mem.store.clear();
    assert.equal(driveResumeAction(2_000 + 5_000), "folder");
  });

  it("expires after 15 minutes", () => {
    const mem = install("https://app.grok.me/");
    markDriveResume("read", 1_000);
    mem.store.clear();
    assert.equal(driveResumeAction(1_000 + 16 * 60 * 1000), null);
    assert.equal(mem.local.size, 0);
  });

  it("is cleared once consumed", () => {
    const mem = install("https://app.grok.me/");
    markDriveResume("read");
    mem.store.clear();
    clearDriveResume();
    assert.equal(driveResumeAction(), null);
    assert.equal(mem.local.size, 0);
  });
});

describe("decideDriveLogin", () => {
  it("redirects when Google was not tried yet", () => {
    install("https://app.grok.me/");
    assert.equal(decideDriveLogin("read", { now: 1_000 }), "redirect");
  });

  it("never redirects automatically after the consent return", () => {
    install("https://app.grok.me/");
    markDriveAuthAttempt("read", 1_000);
    assert.equal(decideDriveLogin("read", { resumed: true, now: 2_000 }), "stay");
    assert.equal(decideDriveLogin("read", { resumed: true, now: 3_000 }), "stay");
  });

  it("stays once, then sends the user to Google again instead of locking for 10 minutes", () => {
    install("https://app.grok.me/");
    markDriveAuthAttempt("read", 1_000);
    assert.equal(decideDriveLogin("read", { now: 2_000 }), "stay");
    assert.equal(decideDriveLogin("read", { now: 3_000 }), "redirect");
    markDriveAuthAttempt("read", 3_000); // redirect marks a new attempt
    assert.equal(decideDriveLogin("read", { now: 4_000 }), "stay");
  });

  it("with a missing token: redirects once, then never again in this session", () => {
    install("https://app.grok.me/");
    assert.equal(decideDriveLogin("read", { tokenMissing: true, now: 1_000 }), "redirect");
    markDriveAuthAttempt("read", 1_000); // redirect marks the attempt
    for (let i = 1; i <= 4; i++) {
      assert.equal(decideDriveLogin("read", { tokenMissing: true, now: 1_000 + i * 1000 }), "stay");
    }
    // even long after the 10 minute attempt window, and for another action
    assert.equal(decideDriveLogin("read", { tokenMissing: true, now: 1_000 + 30 * 60 * 1000 }), "stay");
    assert.equal(decideDriveLogin("folder", { tokenMissing: true, now: 2_000 }), "stay");
  });

  it("with a missing token: a successful Drive call resets it", () => {
    install("https://app.grok.me/");
    markDriveAuthAttempt("read", 1_000);
    clearDriveAuthAttempt("read");
    assert.equal(decideDriveLogin("read", { tokenMissing: true, now: 2_000 }), "redirect");
  });

  it("a real 401 (token exists) keeps the stay-once-then-redirect behaviour", () => {
    install("https://app.grok.me/");
    markDriveAuthAttempt("read", 1_000);
    assert.equal(decideDriveLogin("read", { tokenMissing: false, now: 2_000 }), "stay");
    assert.equal(decideDriveLogin("read", { tokenMissing: false, now: 3_000 }), "redirect");
  });

  it("is tracked per action", () => {
    install("https://app.grok.me/");
    markDriveAuthAttempt("read", 1_000);
    assert.equal(decideDriveLogin("folder", { now: 2_000 }), "redirect");
  });
});

describe("retryWhileLoginRequired", () => {
  const login = (v: string) => v === "login";

  it("returns the first success without waiting", async () => {
    let calls = 0;
    const sleeps: number[] = [];
    const v = await retryWhileLoginRequired(
      async () => {
        calls += 1;
        return "ok";
      },
      login,
      [10, 20],
      async (ms) => void sleeps.push(ms),
    );
    assert.equal(v, "ok");
    assert.equal(calls, 1);
    assert.deepEqual(sleeps, []);
  });

  it("retries until the grant shows up", async () => {
    const seq = ["login", "login", "ok"];
    const sleeps: number[] = [];
    const v = await retryWhileLoginRequired(
      async () => seq.shift() ?? "ok",
      login,
      [10, 20, 30],
      async (ms) => void sleeps.push(ms),
    );
    assert.equal(v, "ok");
    assert.deepEqual(sleeps, [10, 20]);
  });

  it("gives up after the delays and returns the login result", async () => {
    let calls = 0;
    const v = await retryWhileLoginRequired(
      async () => {
        calls += 1;
        return "login";
      },
      login,
      [1, 1],
      async () => undefined,
    );
    assert.equal(v, "login");
    assert.equal(calls, 3);
  });
});
