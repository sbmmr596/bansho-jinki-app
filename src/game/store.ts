import { create } from "zustand";
import { sfx, unlockAudio } from "./audio";
import { enemyToMembers, formationOfLeader, simulateBattle } from "./combat";
import { beginTrial, clearTrial } from "./trial";
import {
  CARD_BY_ID,
  CARDS,
  HERO_CARDS,
  MAX_LEVEL,
  MAX_RANK,
  NODE_BY_ID,
  NODES,
  SUMMON_COST,
  applyCatalog,
  costCapFor,
  loadChars,
  trainCost,
} from "./data";
import { CATALOG_KEY, loadUserCatalog } from "./catalog-api";
import { clearSave, defaultSave, hasSave, loadSave, writeSave } from "./save";
import type {
  BattleEvent,
  BattleLog,
  BattleResult,
  BattleSpeed,
  FieldKind,
  SaveState,
  Screen,
} from "./types";
import { clampBattleSpeed } from "./types";

interface GameStore extends SaveState {
  hydrated: boolean;
  hasExisting: boolean;
  screen: Screen;
  helpOpen: boolean;
  scoutNodeId: string | null;
  selectedCardId: string | null;
  battle: BattleLog | null;
  result: BattleResult | null;
  lastSummon: { cardId: string; isNew: boolean; leveled: boolean } | null;
  summoning: boolean;
  debugUnlocked: boolean;
  debugOpen: boolean;
  trial: { kills: number; field: FieldKind } | null;
  catalogSource: "default" | "custom" | "drive" | "github";
  catalogOpen: boolean;
  zoomCardId: string | null;
  hydrate: () => void;
  newGame: () => void;
  continueGame: () => void;
  setScreen: (s: Screen) => void;
  setHelp: (v: boolean) => void;
  persist: () => void;
  openScout: (nodeId: string) => void;
  placeCard: (slot: number, cardId: string | null) => void;
  setLeader: (cardId: string) => void;
  setSelected: (id: string | null) => void;
  setBattleSpeed: (n: BattleSpeed) => void;
  startBattle: () => void;
  finishBattle: (endOverride?: Extract<BattleEvent, { kind: "end" }>) => void;
  afterResult: () => void;
  summon: () => void;
  trainGold: (cardId: string) => void;
  trainFuse: (cardId: string) => void;
  unlockDebug: () => void;
  setDebugOpen: (v: boolean) => void;
  debugAddGold: () => void;
  debugGrantAll: () => void;
  debugCaptureAll: () => void;
  debugMaxLevels: () => void;
  debugCaptureNode: () => void;
  startTrial: () => void;
  endTrial: () => void;
  addTrialKills: (n: number) => void;
  resetAll: () => void;
  setCatalogSource: (v: "default" | "custom" | "drive" | "github") => void;
  setCatalogOpen: (v: boolean) => void;
  setZoomCard: (id: string | null) => void;
}

function pickSummonId(): string {
  const roll = Math.random();
  const rarity = roll < 0.03 ? "UR" : roll < 0.15 ? "SR" : roll < 0.45 ? "R" : "N";
  const pool = HERO_CARDS.filter((c) => c.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function trialParty(s: { party: (string | null)[]; owned: SaveState["owned"]; leaderId: string | null }) {
  return s.party
    .map((id, slot) =>
      id
        ? {
            cardId: id,
            slot,
            level: s.owned[id]?.level ?? 1,
            rank: s.owned[id]?.rank ?? 0,
            isLeader: id === s.leaderId,
          }
        : null,
    )
    .filter((x): x is NonNullable<typeof x> => !!x);
}

export const useGame = create<GameStore>((set, get) => ({
  ...defaultSave(),
  hydrated: false,
  hasExisting: false,
  screen: "title",
  helpOpen: false,
  scoutNodeId: null,
  selectedCardId: null,
  battle: null,
  result: null,
  lastSummon: null,
  summoning: false,
  debugUnlocked: true,
  debugOpen: false,
  trial: null,
  catalogSource: "default",
  catalogOpen: false,
  zoomCardId: null,

  hydrate: async () => {
    await loadChars();
    let catalogSource: "default" | "custom" = "default";
    try {
      const remote = await loadUserCatalog();
      if (remote) {
        const n = applyCatalog(JSON.parse(remote) as unknown);
        if (n) catalogSource = "custom";
      }
    } catch {
      try {
        const local = localStorage.getItem(CATALOG_KEY);
        if (local) {
          const n = applyCatalog(JSON.parse(local) as unknown);
          if (n) catalogSource = "custom";
        }
      } catch {
        /* keep default */
      }
    }
    const existing = hasSave();
    const loaded = existing ? loadSave() : defaultSave();
    set({
      ...loaded,
      hydrated: true,
      hasExisting: existing,
      screen: "title",
      debugUnlocked: true,
      debugOpen: false,
      catalogSource,
      catalogOpen: false,
    });
  },

  newGame: () => {
    unlockAudio();
    sfx("click");
    clearSave();
    const fresh = defaultSave();
    writeSave(fresh);
    set({
      ...fresh,
      hasExisting: true,
      screen: "palace",
      helpOpen: true,
      scoutNodeId: null,
      selectedCardId: null,
      battle: null,
      result: null,
      lastSummon: null,
    });
  },

  continueGame: () => {
    unlockAudio();
    sfx("click");
    const loaded = loadSave();
    set({ ...loaded, screen: "palace", hasExisting: true });
  },

  setScreen: (screen) => {
    sfx("click");
    set({ screen, selectedCardId: null });
  },

  setHelp: (helpOpen) => set({ helpOpen }),

  persist: () => {
    const s = get();
    writeSave({
      version: s.version,
      gold: s.gold,
      owned: s.owned,
      party: s.party,
      leaderId: s.leaderId,
      captured: s.captured,
      battleSpeed: clampBattleSpeed(s.battleSpeed),
    });
  },

  openScout: (nodeId) => {
    sfx("click");
    set({ scoutNodeId: nodeId, screen: "scout" });
  },

  setSelected: (selectedCardId) => set({ selectedCardId }),

  setBattleSpeed: (battleSpeed) => {
    set({ battleSpeed });
    get().persist();
  },

  placeCard: (slot, cardId) => {
    const s = get();
    const form = formationOfLeader(s.leaderId);
    if (!form.slots[slot]) return;
    let party = s.party.slice();
    let leaderId = s.leaderId;

    if (!cardId || party[slot] === cardId) {
      const gone = party[slot];
      if (!gone) return;
      if (gone === leaderId) {
        party = Array(9).fill(null);
        leaderId = null;
      } else {
        party[slot] = null;
      }
      sfx("click");
      set({ party, leaderId, selectedCardId: null });
      get().persist();
      return;
    }

    const from = party.findIndex((id) => id === cardId);
    const occupant = party[slot];
    const next = party.slice();

    if (from >= 0) {
      next[from] = occupant;
      next[slot] = cardId;
    } else if (occupant && occupant === leaderId) {
      const cleared: (string | null)[] = Array(9).fill(null);
      const nf = formationOfLeader(cardId);
      const home = nf.slots[slot] ? slot : nf.slots.findIndex((ok) => ok);
      if (home < 0) return;
      cleared[home] = cardId;
      if (partyCost(cleared) > currentCostCap(s.captured)) return;
      sfx("click");
      set({ party: cleared, leaderId: cardId, selectedCardId: null });
      get().persist();
      return;
    } else {
      next[slot] = cardId;
    }

    if (partyCost(next) > currentCostCap(s.captured)) return;

    if (!leaderId) {
      leaderId = cardId;
      const nf = formationOfLeader(leaderId);
      const mapped = next.map((id, i) => (nf.slots[i] ? id : null));
      if (!mapped.includes(leaderId)) {
        const free = nf.slots.findIndex((ok, i) => ok && !mapped[i]);
        if (free >= 0) mapped[free] = leaderId;
      }
      sfx("click");
      set({ party: mapped, leaderId, selectedCardId: null });
      get().persist();
      return;
    }

    sfx("click");
    set({ party: next, leaderId, selectedCardId: null });
    get().persist();
  },

  setLeader: (cardId) => {
    const s = get();
    if (!s.party.includes(cardId)) return;
    const nextForm = formationOfLeader(cardId);
    const party = s.party.map((id, i) => (nextForm.slots[i] ? id : null));
    if (!party.includes(cardId)) {
      const free = nextForm.slots.findIndex((ok, i) => ok && !party[i]);
      if (free >= 0) party[free] = cardId;
    }
    set({ leaderId: cardId, party, selectedCardId: null });
    get().persist();
  },

  startBattle: () => {
    const s = get();
    const node = s.scoutNodeId ? NODE_BY_ID[s.scoutNodeId] : null;
    if (!node || node.home) return;
    const player = s.party
      .map((id, slot) =>
        id
          ? {
              cardId: id,
              slot,
              level: s.owned[id]?.level ?? 1,
              rank: s.owned[id]?.rank ?? 0,
              isLeader: id === s.leaderId,
            }
          : null,
      )
      .filter((x): x is NonNullable<typeof x> => !!x);
    if (!player.length || !s.leaderId) return;
    const enemyLeader = node.enemy.find((e) => e.leader)?.cardId ?? node.enemy[0]?.cardId;
    const log = simulateBattle(
      player,
      enemyToMembers(node.enemy),
      formationOfLeader(s.leaderId).id,
      formationOfLeader(enemyLeader ?? null).id,
    );
    unlockAudio();
    set({ battle: log, screen: "battle", result: null, trial: null });
  },

  finishBattle: (endOverride) => {
    const s = get();
    if (!s.battle) return;
    const end =
      endOverride && endOverride.kind === "end"
        ? endOverride
        : [...s.battle.events].reverse().find((e) => e.kind === "end");
    if (!end || end.kind !== "end") return;

    if (s.trial) {
      const result: BattleResult = {
        winner: end.winner,
        reason: end.reason,
        goldGain: 0,
        cardGain: null,
        cardWasNew: false,
        leveled: [],
        nodeName: "試し撃ち",
        trial: true,
        waves: 0,
        kills: s.trial.kills,
      };
      sfx(end.winner === "player" ? "win" : "lose");
      clearTrial();
      set({ result, screen: "result", battle: null, trial: null });
      return;
    }

    const node = s.scoutNodeId ? NODE_BY_ID[s.scoutNodeId] : null;
    let goldGain = 0;
    let cardGain: string | null = null;
    let cardWasNew = false;
    const leveled: string[] = [];
    let gold = s.gold;
    let owned = s.owned;
    let captured = s.captured;
    if (end.winner === "player" && node && !node.home) {
      goldGain = node.reward.gold;
      gold += goldGain;
      if (node.reward.cardId) {
        cardGain = node.reward.cardId;
        const prev = owned[cardGain];
        if (!prev) {
          owned = { ...owned, [cardGain]: { level: 1, rank: 0, count: 1 } };
          cardWasNew = true;
        } else {
          owned = {
            ...owned,
            [cardGain]: { ...prev, count: prev.count + 1 },
          };
        }
      }
      if (!captured.includes(node.id)) captured = [...captured, node.id];
      const deployed = s.party.filter((id): id is string => !!id);
      owned = { ...owned };
      for (const id of deployed) {
        const cur = owned[id];
        if (!cur || cur.level >= MAX_LEVEL) continue;
        owned[id] = { ...cur, level: cur.level + 1 };
        leveled.push(id);
      }
    }
    if (end.winner === "player") sfx("win");
    else sfx("lose");
    const result: BattleResult = {
      winner: end.winner,
      reason: end.reason,
      goldGain,
      cardGain,
      cardWasNew,
      leveled,
      nodeName: node?.name ?? "",
    };
    set({ gold, owned, captured, result, screen: "result" });
    get().persist();
  },

  afterResult: () => {
    sfx("click");
    const s = get();
    const trialDone = !!s.result?.trial;
    const wonCapital =
      s.result?.winner === "player" && s.scoutNodeId === "capital";
    set({
      screen: trialDone || wonCapital ? "palace" : "map",
      battle: null,
      scoutNodeId: trialDone || wonCapital ? null : s.scoutNodeId,
    });
  },

  summon: () => {
    const s = get();
    if (s.gold < SUMMON_COST || s.summoning) return;
    unlockAudio();
    sfx("summon");
    const cardId = pickSummonId();
    const prev = s.owned[cardId];
    const isNew = !prev;
    let owned = s.owned;
    let leveled = false;
    if (!prev) {
      owned = { ...owned, [cardId]: { level: 1, rank: 0, count: 1 } };
    } else {
      owned = { ...owned, [cardId]: { ...prev, count: prev.count + 1 } };
    }
    set({
      gold: s.gold - SUMMON_COST,
      owned,
      lastSummon: { cardId, isNew, leveled },
      summoning: true,
    });
    get().persist();
    setTimeout(() => set({ summoning: false }), 700);
  },

  trainGold: (cardId) => {
    const s = get();
    const own = s.owned[cardId];
    if (!own || own.level >= MAX_LEVEL) return;
    const cost = trainCost(own.level);
    if (s.gold < cost) return;
    sfx("summon");
    set({
      gold: s.gold - cost,
      owned: {
        ...s.owned,
        [cardId]: { ...own, level: own.level + 1 },
      },
    });
    get().persist();
  },

  trainFuse: (cardId) => {
    const s = get();
    const own = s.owned[cardId];
    const rank = own?.rank ?? 0;
    if (!own || own.count < 2 || rank >= MAX_RANK) return;
    sfx("summon");
    set({
      owned: {
        ...s.owned,
        [cardId]: { ...own, rank: rank + 1, count: own.count - 1 },
      },
    });
    get().persist();
  },

  unlockDebug: () => {
    set({ debugUnlocked: true, debugOpen: true });
  },

  setDebugOpen: (debugOpen) => set({ debugOpen }),

  debugAddGold: () => {
    set({ gold: get().gold + 5000 });
    get().persist();
  },

  debugGrantAll: () => {
    const owned = { ...get().owned };
    for (const c of CARDS) {
      if (c.fodder) continue;
      if (!owned[c.id]) owned[c.id] = { level: 1, rank: 0, count: 1 };
      else owned[c.id] = { ...owned[c.id], rank: owned[c.id].rank ?? 0, count: Math.max(owned[c.id].count, 1) };
    }
    set({ owned });
    get().persist();
  },

  debugCaptureAll: () => {
    set({ captured: NODES.map((n) => n.id) });
    get().persist();
  },

  debugMaxLevels: () => {
    const owned = { ...get().owned };
    for (const id of Object.keys(owned)) {
      owned[id] = { ...owned[id], level: MAX_LEVEL };
    }
    set({ owned });
    get().persist();
  },

  debugCaptureNode: () => {
    const s = get();
    if (!s.scoutNodeId) return;
    const node = NODE_BY_ID[s.scoutNodeId];
    if (!node || node.home) return;
    let gold = s.gold + node.reward.gold;
    let owned = s.owned;
    let captured = s.captured.includes(node.id) ? s.captured : [...s.captured, node.id];
    if (node.reward.cardId && !owned[node.reward.cardId]) {
      owned = { ...owned, [node.reward.cardId]: { level: 1, rank: 0, count: 1 } };
    }
    set({
      gold,
      owned,
      captured,
      screen: "map",
      scoutNodeId: null,
    });
    get().persist();
  },

  startTrial: () => {
    const s = get();
    const player = trialParty(s);
    if (!player.length || !s.leaderId) return;
    const live = beginTrial(player);
    unlockAudio();
    sfx("click");
    set({
      battle: { units: live.units.map((u) => ({ ...u })), events: [] },
      trial: { kills: 0, field: live.field },
      screen: "battle",
      debugOpen: false,
      result: null,
      scoutNodeId: null,
    });
  },

  addTrialKills: (n) => {
    const trial = get().trial;
    if (!trial || n <= 0) return;
    set({ trial: { ...trial, kills: trial.kills + n } });
  },

  endTrial: () => {
    const s = get();
    const trial = s.trial;
    sfx("click");
    clearTrial();
    set({
      result: {
        winner: "player",
        reason: "wipe",
        goldGain: 0,
        cardGain: null,
        cardWasNew: false,
        leveled: [],
        nodeName: "試し撃ち",
        trial: true,
        waves: 0,
        kills: trial?.kills ?? 0,
      },
      screen: "result",
      battle: null,
      trial: null,
    });
  },

  resetAll: () => {
    clearSave();
    const fresh = defaultSave();
    set({
      ...fresh,
      hasExisting: false,
      screen: "title",
      helpOpen: false,
      scoutNodeId: null,
      battle: null,
      result: null,
      lastSummon: null,
    });
  },
  setCatalogSource: (v) => set({ catalogSource: v }),
  setCatalogOpen: (v) => set({ catalogOpen: v }),
  setZoomCard: (id) => set({ zoomCardId: id }),
}));

export function partyCost(party: (string | null)[]): number {
  return party.reduce((sum, id) => sum + (id ? (CARD_BY_ID[id]?.cost ?? 0) : 0), 0);
}

export function currentCostCap(captured: string[]): number {
  return costCapFor(captured.length);
}
