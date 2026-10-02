import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

// Minimal browser shims (store/save touch window + localStorage + audio).
const mem = new Map<string, string>();
const localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorage });
Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });

const { SAVE_KEY, hasSave } = await import("./save.ts");
const { useGame } = await import("./store.ts");

describe("no empty save before a game is started", () => {
  beforeEach(() => {
    mem.clear();
    useGame.setState({ started: false, hasExisting: false, screen: "title" });
  });

  it("persist() on the title screen writes nothing", () => {
    useGame.getState().persist();
    assert.equal(mem.has(SAVE_KEY), false);
    assert.equal(hasSave(), false);
  });

  it("persist() works once a game is started", () => {
    useGame.setState({ started: true });
    useGame.getState().persist();
    assert.equal(hasSave(), true);
  });

  it("newGame writes a save and enables autosave; resetAll clears and disables it", () => {
    useGame.getState().newGame("normal");
    assert.equal(hasSave(), true);
    assert.equal(useGame.getState().started, true);
    useGame.getState().resetAll();
    assert.equal(hasSave(), false);
    assert.equal(useGame.getState().started, false);
    useGame.getState().persist();
    assert.equal(hasSave(), false);
  });

  it("continueGame on an existing save marks started", () => {
    useGame.getState().newGame("normal");
    useGame.setState({ started: false, hasExisting: true, screen: "title" });
    useGame.getState().continueGame();
    assert.equal(useGame.getState().started, true);
    assert.equal(useGame.getState().screen, "palace");
  });
});
