import { create } from "zustand";
import { sfx, unlockAudio } from "./audio";
import { enemyToMembers, formationOfLeader, simulateBattle } from "./combat";
import { beginTrial, clearTrial } from "./trial";
import { clampDifficulty } from "./difficulty";
import {
  ARENA_TIER_META,
  buildArenaEncounter,
  partyAverageLevel,
  partyMaxCost,
  partyTotalCost,
  type ArenaTier,
} from "./arena";
import {
  CARD_BY_ID,
  CARDS,
  FODDER_CARDS,
  HERO_CARDS,
  MAX_LEVEL,
  MAX_SKILL_LV,
  NODE_BY_ID,
  NODES,
  SPECIAL_FODDER,
  SUMMON_COST,
  SUMMON_INCLUDE_FODDER,
  applyCatalog,
  costCapFor,
  fuseSuccessRate,
  loadChars,
  trainCost,
} from "./data";
import { commonSkillName } from "./skillNames";
import { CATALOG_KEY } from "./catalog-api";
import { blankOwned, clearSave, defaultSave, hasSave, loadSave, sanitizeParty, writeSave } from "./save";
import type {
  BattleEvent,
  BattleLog,
  BattleResult,
  BattleSpeed,
  Difficulty,
  FieldKind,
  FuseResult,
  SaveState,
  Screen,
} from "./types";
import { clampBattleSpeed, clampNavSide, type NavSide } from "./types";

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
  /** Active arena bout metadata (fee already deducted). Separate from endless trial. */
  arena: { tier: ArenaTier; fee: number; reward: number; seed: number } | null;
  catalogSource: "default" | "custom" | "drive" | "github";
  catalogOpen: boolean;
  zoomCardId: string | null;
  hydrate: () => void;
  newGame: (difficulty?: Difficulty) => void;
  continueGame: () => void;
  setScreen: (s: Screen) => void;
  setHelp: (v: boolean) => void;
  persist: () => void;
  openScout: (nodeId: string) => void;
  placeCard: (slot: number, cardId: string | null) => void;
  setLeader: (cardId: string) => void;
  setSelected: (id: string | null) => void;
  setBattleSpeed: (n: BattleSpeed) => void;
  setNavSide: (side: NavSide) => void;
  startBattle: () => void;
  finishBattle: (endOverride?: Extract<BattleEvent, { kind: "end" }>) => void;
  afterResult: () => void;
  summon: () => void;
  finishSummon: () => void;
  trainGold: (cardId: string) => void;
  trainFuse: (cardId: string) => FuseResult | null;
  trainFuseOther: (baseId: string, materialId: string) => FuseResult | null;
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
  startArena: (tier: ArenaTier) => { ok: true } | { ok: false; reason: string };
  resetAll: () => void;
  setCatalogSource: (v: "default" | "custom" | "drive" | "github") => void;
  setCatalogOpen: (v: boolean) => void;
  setZoomCard: (id: string | null) => void;
}

/**
 * Summon pick rates:
 * - When SUMMON_INCLUDE_FODDER: ~40% fodder (material-only N), remaining 60% heroes
 *   with legacy SP/H/S/N weights among heroes only
 *   (absolute ≈ fodder 40% / N 33% / S 16.8% / H 8.4% / SP 1.8%).
 * - When off: legacy heroes only — SP 3% / H 14% / S 28% / N 55%.
 */
function pickSummonId(): string {
  if (SUMMON_INCLUDE_FODDER && Math.random() < 0.4) {
    const pool = [...FODDER_CARDS, ...SPECIAL_FODDER];
    return pool[Math.floor(Math.random() * pool.length)].id;
  }
  const roll = Math.random();
  const rarity = roll < 0.03 ? "SP" : roll < 0.17 ? "H" : roll < 0.45 ? "S" : "N";
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
            skill1Lv: s.owned[id]?.skill1Lv ?? 1,
            skill2: s.owned[id]?.skill2,
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
  arena: null,
  catalogSource: "default",
  catalogOpen: false,
  zoomCardId: null,

  hydrate: async () => {
    // Never await remote catalog here — GameApp loads it post-hydrate.
    // A hung auth/DB request used to leave #boot-splash forever.
    let catalogSource: "default" | "custom" = "default";
    let existing = false;
    let loaded = defaultSave();
    try {
      await loadChars();
      try {
        const local = localStorage.getItem(CATALOG_KEY);
        if (local) {
          const n = applyCatalog(JSON.parse(local) as unknown);
          if (n) catalogSource = "custom";
        }
      } catch {
        /* keep default */
      }
      existing = hasSave();
      loaded = sanitizeParty(existing ? loadSave() : defaultSave());
    } catch {
      /* local load optional — still clear splash */
    } finally {
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
    }
  },

  newGame: (difficulty = "normal") => {
    unlockAudio();
    sfx("click");
    clearSave();
    const fresh = { ...defaultSave(), difficulty: clampDifficulty(difficulty) };
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
      trial: null,
      arena: null,
    });
  },

  continueGame: () => {
    unlockAudio();
    sfx("click");
    const loaded = sanitizeParty(loadSave());
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
      navSide: clampNavSide(s.navSide),
      difficulty: clampDifficulty(s.difficulty),
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

  setNavSide: (navSide) => {
    set({ navSide: clampNavSide(navSide) });
    get().persist();
  },

  placeCard: (slot, cardId) => {
    const s = get();
    const form = formationOfLeader(s.leaderId);
    if (!form.slots[slot]) return;
    // Material-only fodder cannot join party / formation
    if (cardId && CARD_BY_ID[cardId]?.fodder) return;
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
    if (CARD_BY_ID[cardId]?.fodder) return;
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
              skill1Lv: s.owned[id]?.skill1Lv ?? 1,
              skill2: s.owned[id]?.skill2,
              isLeader: id === s.leaderId,
            }
          : null,
      )
      .filter((x): x is NonNullable<typeof x> => !!x);
    if (!player.length || !s.leaderId) return;
    const enemyLeader = node.enemy.find((e) => e.leader)?.cardId ?? node.enemy[0]?.cardId;
    const log = simulateBattle(
      player,
      enemyToMembers(node.enemy, clampDifficulty(s.difficulty)),
      formationOfLeader(s.leaderId).id,
      formationOfLeader(enemyLeader ?? null).id,
    );
    unlockAudio();
    set({ battle: log, screen: "battle", result: null, trial: null, arena: null });
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
      set({ result, screen: "result", battle: null, trial: null, arena: null });
      return;
    }

    if (s.arena) {
      let goldGain = 0;
      let gold = s.gold;
      if (end.winner === "player") {
        goldGain = s.arena.reward;
        gold += goldGain;
      }
      const tierName = ARENA_TIER_META[s.arena.tier].name;
      const result: BattleResult = {
        winner: end.winner,
        reason: end.reason,
        goldGain,
        cardGain: null,
        cardWasNew: false,
        leveled: [],
        nodeName: `闘技場・${tierName}`,
        arena: true,
      };
      sfx(end.winner === "player" ? "win" : "lose");
      set({ gold, result, screen: "result", battle: null, arena: null });
      get().persist();
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
          owned = { ...owned, [cardGain]: blankOwned() };
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
    const arenaDone = !!s.result?.arena;
    const wonCapital =
      s.result?.winner === "player" && s.scoutNodeId === "capital";
    const toPalace = trialDone || wonCapital;
    set({
      screen: arenaDone ? "arena" : toPalace ? "palace" : "map",
      battle: null,
      scoutNodeId: toPalace || arenaDone ? null : s.scoutNodeId,
      result: null,
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
      owned = { ...owned, [cardId]: blankOwned() };
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
    // Fallback so double-tap cannot race if UI never calls finishSummon
    setTimeout(() => {
      if (get().summoning) set({ summoning: false });
    }, 2300);
  },

  finishSummon: () => {
    if (get().summoning) set({ summoning: false });
  },

  trainGold: (cardId) => {
    const s = get();
    if (CARD_BY_ID[cardId]?.fodder) return;
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
    // Fodder is material-only — no same-name skill1 fuse as base
    if (CARD_BY_ID[cardId]?.fodder) return null;
    const own = s.owned[cardId];
    if (!own || own.count < 2 || own.skill1Lv >= MAX_SKILL_LV) return null;
    const rate = fuseSuccessRate(own.skill1Lv, own.level, own.level);
    const success = Math.random() * 100 < rate;
    const nextLv = success ? own.skill1Lv + 1 : own.skill1Lv;
    sfx("summon");
    set({
      owned: {
        ...s.owned,
        [cardId]: { ...own, skill1Lv: nextLv, count: own.count - 1 },
      },
    });
    get().persist();
    const result: FuseResult = {
      success,
      kind: "skill1",
      newLv: nextLv,
      rate,
      message: success
        ? `成功！必殺技1が Lv.${nextLv} になった。`
        : `失敗…必殺技1は Lv.${nextLv} のまま。素材は消費された。`,
    };
    return result;
  },

  trainFuseOther: (baseId, materialId) => {
    const s = get();
    if (baseId === materialId) return null;
    // Fodder OK as material for 異名合成; not as base
    if (CARD_BY_ID[baseId]?.fodder) return null;
    const base = s.owned[baseId];
    const mat = s.owned[materialId];
    if (!base || !mat || mat.count < 1) return null;
    if (!CARD_BY_ID[materialId]) return null;

    const owned = { ...s.owned };
    let party = s.party;
    let leaderId = s.leaderId;

    // Always consume 1 material
    if (mat.count <= 1) {
      delete owned[materialId];
      party = s.party.map((id) => (id === materialId ? null : id));
      leaderId = s.leaderId === materialId ? null : s.leaderId;
      if (leaderId && !party.includes(leaderId)) {
        leaderId = party.find((id) => !!id) ?? null;
      }
    } else {
      owned[materialId] = { ...mat, count: mat.count - 1 };
    }

    let result: FuseResult;
    const cur = owned[baseId] ?? base;

    if (!cur.skill2) {
      owned[baseId] = {
        ...cur,
        skill2: { sourceCardId: materialId, lv: 1 },
      };
      result = {
        success: true,
        kind: "skill2-install",
        newLv: 1,
        message: `必殺技2に「${CARD_BY_ID[materialId] ? commonSkillName(CARD_BY_ID[materialId].skill) : "技"}」を装着した！`,
      };
    } else if (cur.skill2.sourceCardId === materialId) {
      if (cur.skill2.lv >= MAX_SKILL_LV) {
        owned[baseId] = cur;
        result = {
          success: false,
          kind: "skill2-level",
          newLv: cur.skill2.lv,
          message: `必殺技2はすでに最大 Lv.${MAX_SKILL_LV}。素材のみ消費された。`,
        };
      } else {
        const rate = fuseSuccessRate(cur.skill2.lv, base.level, mat.level);
        const success = Math.random() * 100 < rate;
        const nextLv = success ? cur.skill2.lv + 1 : cur.skill2.lv;
        owned[baseId] = {
          ...cur,
          skill2: { ...cur.skill2, lv: nextLv },
        };
        result = {
          success,
          kind: "skill2-level",
          newLv: nextLv,
          rate,
          message: success
            ? `成功！必殺技2が Lv.${nextLv} になった。`
            : `失敗…必殺技2は Lv.${nextLv} のまま。素材は消費された。`,
        };
      }
    } else {
      owned[baseId] = {
        ...cur,
        skill2: { sourceCardId: materialId, lv: 1 },
      };
      result = {
        success: true,
        kind: "skill2-replace",
        newLv: 1,
        message: `必殺技2を「${CARD_BY_ID[materialId] ? commonSkillName(CARD_BY_ID[materialId].skill) : "技"}」に差し替えた！`,
      };
    }

    sfx("summon");
    set({ owned, party, leaderId });
    get().persist();
    return result;
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
      if (!owned[c.id]) owned[c.id] = blankOwned();
      else owned[c.id] = { ...owned[c.id], count: Math.max(owned[c.id].count, 1) };
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
      owned = { ...owned, [node.reward.cardId]: blankOwned() };
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

  startArena: (tier) => {
    const s = get();
    const player = trialParty(s);
    if (!player.length || !s.leaderId) {
      return { ok: false, reason: "リーダーとパーティが必要です" };
    }
    const avg = partyAverageLevel(s.party, s.owned);
    const encounter = buildArenaEncounter(player.length, avg, tier, {
      playerTotalCost: partyTotalCost(s.party),
      playerMaxCost: partyMaxCost(s.party),
    });
    if (s.gold < encounter.fee) {
      return { ok: false, reason: "金が足りない" };
    }
    const log = simulateBattle(
      player,
      encounter.enemies,
      formationOfLeader(s.leaderId).id,
      encounter.formationId,
    );
    unlockAudio();
    sfx("click");
    set({
      gold: s.gold - encounter.fee,
      battle: log,
      screen: "battle",
      result: null,
      trial: null,
      arena: {
        tier,
        fee: encounter.fee,
        reward: encounter.reward,
        seed: encounter.seed,
      },
      scoutNodeId: null,
      debugOpen: false,
    });
    get().persist();
    return { ok: true };
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
      arena: null,
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
      trial: null,
      arena: null,
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
