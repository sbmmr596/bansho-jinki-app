import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

const mem = new Map<string, string>();
const localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorage });
Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });

const { applyCatalog, CARD_BY_ID, HERO_CARDS, resetCatalog, STARTER_IDS } = await import("./data.ts");
const { defaultSave, loadSave, sanitizeParty, SAVE_KEY, writeSave } = await import("./save.ts");
const { useGame } = await import("./store.ts");

function hero(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    faction: "koryu",
    type: "power",
    rarity: "N",
    cost: 3,
    hp: 500,
    atk: 100,
    def: 50,
    spd: 100,
    formation: "basic",
    skill: { name: "斬", kind: "front", power: 1, desc: "" },
    ...extra,
  };
}

const custom = (n: number) => Array.from({ length: n }, (_, i) => hero(`mine${i + 1}`));
const heroIds = () => HERO_CARDS.map((c) => c.id);

describe("rebuildCatalog replaceAll", () => {
  beforeEach(() => {
    mem.clear();
    resetCatalog();
  });
  afterEach(() => resetCatalog());

  it("replaceAll true (payload flag) with a custom set excludes every starter", () => {
    const n = applyCatalog({ replaceAll: true, chars: custom(3) });
    assert.equal(n, 3);
    assert.deepEqual(heroIds(), ["mine1", "mine2", "mine3"]);
    for (const id of STARTER_IDS) assert.equal(CARD_BY_ID[id], undefined, id);
  });

  it("replaceAll true (option, as the editor saves) excludes starters too", () => {
    applyCatalog({ chars: custom(2) }, { replaceAll: true });
    assert.deepEqual(heroIds(), ["mine1", "mine2"]);
  });

  it("replaceAll false still merges the starters", () => {
    applyCatalog({ chars: custom(2) });
    for (const id of STARTER_IDS) assert.ok(CARD_BY_ID[id], id);
    assert.ok(CARD_BY_ID.mine1 && CARD_BY_ID.mine2);
    applyCatalog({ replaceAll: false, chars: custom(1) });
    for (const id of STARTER_IDS) assert.ok(CARD_BY_ID[id], id);
  });

  it("a starter kept in the replaceAll list stays; others are not re-added", () => {
    const sora = HERO_CARDS.find((c) => c.id === "sora")!;
    applyCatalog({ replaceAll: true, chars: [sora, ...custom(1)] });
    assert.deepEqual(heroIds().sort(), ["mine1", "sora"]);
  });

  it("empty list keeps the previous catalog (returns 0)", () => {
    applyCatalog({ replaceAll: true, chars: custom(2) });
    assert.equal(applyCatalog({ replaceAll: true, chars: [] }), 0);
    assert.equal(applyCatalog({ replaceAll: true, chars: [{ nope: 1 }, null] }), 0);
    assert.equal(applyCatalog([], { replaceAll: true }), 0);
    assert.deepEqual(heroIds(), ["mine1", "mine2"]);
  });

  it("replaceAll leaving no playable hero (fodder only) falls back to the starters", () => {
    const n = applyCatalog({ replaceAll: true, chars: [hero("mat1", { fodder: true })] });
    assert.equal(n, 1);
    for (const id of STARTER_IDS) assert.ok(CARD_BY_ID[id], id);
    assert.ok(HERO_CARDS.some((c) => !c.fodder));
  });
});

describe("new game / saves without starters", () => {
  beforeEach(() => {
    mem.clear();
    resetCatalog();
  });
  afterEach(() => resetCatalog());

  it("defaultSave with default catalog is unchanged: sora leads, all starters owned", () => {
    const s = defaultSave();
    assert.equal(s.leaderId, "sora");
    assert.deepEqual(Object.keys(s.owned), STARTER_IDS);
    assert.ok(s.party.includes("sora"));
  });

  it("defaultSave with no starters picks available heroes (no throw, non-empty party)", () => {
    applyCatalog({ replaceAll: true, chars: custom(10) });
    const s = defaultSave();
    assert.equal(s.leaderId, "mine1");
    assert.deepEqual(Object.keys(s.owned), custom(7).map((c) => c.id));
    assert.ok(s.party.includes("mine1"));
    assert.ok(s.party.every((id) => id === null || !!CARD_BY_ID[id]));
    assert.ok(s.party.filter(Boolean).length >= 2);
  });

  it("defaultSave prefers the starters that are present, then pads", () => {
    const keep = HERO_CARDS.filter((c) => c.id === "maki" || c.id === "rin").map((c) => ({ ...c }));
    applyCatalog({ replaceAll: true, chars: [...custom(8), ...keep] });
    const s = defaultSave();
    assert.deepEqual(Object.keys(s.owned).slice(0, 2), ["maki", "rin"]);
    assert.equal(Object.keys(s.owned).length, STARTER_IDS.length);
    assert.equal(s.leaderId, "maki");
  });

  it("newGame works with a starter-less catalog", () => {
    applyCatalog({ replaceAll: true, chars: custom(3) });
    useGame.getState().newGame("normal");
    const st = useGame.getState();
    assert.equal(st.started, true);
    assert.equal(st.leaderId, "mine1");
    assert.ok(st.party.includes("mine1"));
    assert.deepEqual(Object.keys(st.owned), ["mine1", "mine2", "mine3"]);
    for (const id of STARTER_IDS) assert.equal(st.owned[id], undefined);
  });

  it("existing save that references removed cards loads without crashing and is not given default heroes", () => {
    writeSave({ ...defaultSave(), gold: 999 }); // sora/maki/... party and owned
    const s0 = loadSave();
    s0.owned.sora = { ...s0.owned.sora!, skill2: { sourceCardId: "maki", lv: 2 } };
    writeSave(s0);
    applyCatalog({ replaceAll: true, chars: custom(3) });
    const s = loadSave();
    assert.equal(s.gold, 999);
    assert.ok(s.party.filter(Boolean).length > 0, "party falls back, not empty");
    assert.ok(s.party.every((id) => id === null || !!CARD_BY_ID[id]));
    assert.ok(!!s.leaderId && !!CARD_BY_ID[s.leaderId]);
    assert.ok(s.owned.sora, "removed ids stay in owned (skipped by lookups)");
    assert.equal(CARD_BY_ID.sora, undefined);
  });

  it("corrupt save JSON falls back to a fresh default", () => {
    applyCatalog({ replaceAll: true, chars: custom(3) });
    mem.set(SAVE_KEY, "{not json");
    assert.equal(loadSave().leaderId, "mine1");
  });

  it("sanitizeParty keeps a surviving member and drops removed ones", () => {
    const sora = HERO_CARDS.find((c) => c.id === "sora")!;
    const base = defaultSave();
    applyCatalog({ replaceAll: true, chars: [{ ...sora }, ...custom(1)] });
    const s = sanitizeParty({ ...base, party: base.party.map((id) => (id === "sora" || id === "maki" ? id : null)) });
    assert.ok(s.party.includes("sora"));
    assert.ok(!s.party.includes("maki"));
  });

  it("bumpCatalog drops removed cards from the live party", () => {
    useGame.getState().newGame("normal");
    applyCatalog({ replaceAll: true, chars: custom(3) });
    useGame.getState().bumpCatalog();
    const st = useGame.getState();
    assert.ok(st.party.filter(Boolean).length > 0);
    assert.ok(st.party.every((id) => id === null || !!CARD_BY_ID[id]));
    assert.ok(!!st.leaderId && !!CARD_BY_ID[st.leaderId]);
  });
});
