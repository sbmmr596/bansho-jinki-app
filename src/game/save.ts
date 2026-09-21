import {
  CARD_BY_ID,
  FORMATIONS,
  STARTER_IDS,
  HOME_ID,
  MAX_LEVEL,
  MAX_SKILL_LV,
  costCapFor,
} from "./data";
import {
  SAVE_VERSION,
  clampBattleSpeed,
  clampNavSide,
  type OwnedCard,
  type OwnedSkill2,
  type SaveState,
} from "./types";
import { clampDifficulty } from "./difficulty";
import { SPIRIT_MAX, applySpiritRegen, clampSpirit } from "./arena";

export const SAVE_KEY = "bansho-jinki-v1";

export function blankOwned(partial?: Partial<OwnedCard>): OwnedCard {
  return {
    level: 1,
    count: 1,
    skill1Lv: 1,
    ...partial,
  };
}

/** Migrate legacy owned entries (rank → skill1Lv) and clamp fields. */
export function migrateOwned(raw: Partial<OwnedCard> & { rank?: number } | null | undefined): OwnedCard {
  const level = Math.min(MAX_LEVEL, Math.max(1, raw?.level ?? 1));
  const count = Math.max(0, raw?.count ?? 0);
  const fromRank =
    typeof raw?.rank === "number" && Number.isFinite(raw.rank) ? Math.max(0, raw.rank) + 1 : 1;
  const skill1Lv = Math.min(
    MAX_SKILL_LV,
    Math.max(1, typeof raw?.skill1Lv === "number" ? raw.skill1Lv : fromRank),
  );
  let skill2: OwnedSkill2 | undefined;
  const s2 = raw?.skill2;
  if (s2 && typeof s2.sourceCardId === "string" && s2.sourceCardId) {
    skill2 = {
      sourceCardId: s2.sourceCardId,
      lv: Math.min(MAX_SKILL_LV, Math.max(1, typeof s2.lv === "number" ? s2.lv : 1)),
    };
  }
  return skill2 ? { level, count, skill1Lv, skill2 } : { level, count, skill1Lv };
}

export function defaultSave(): SaveState {
  const owned: SaveState["owned"] = {};
  for (const id of STARTER_IDS) {
    if (!CARD_BY_ID[id]) continue;
    owned[id] = blankOwned();
  }
  const party: (string | null)[] = Array(9).fill(null);
  const leaderId =
    (STARTER_IDS.find((id) => id === "sora" && CARD_BY_ID[id]) ??
      STARTER_IDS.find((id) => CARD_BY_ID[id]) ??
      Object.keys(CARD_BY_ID)[0]) as string;
  const leader = CARD_BY_ID[leaderId];
  if (!leader) {
    throw new Error("defaultSave: no cards in catalog");
  }
  const formation = FORMATIONS[leader.formation] ?? FORMATIONS.basic;
  const starters = STARTER_IDS.filter((id) => id !== leaderId && CARD_BY_ID[id]);
  const slots = formation.slots
    .map((ok, i) => (ok ? i : -1))
    .filter((i) => i >= 0);
  party[slots[0] ?? 4] = leaderId;
  const startCap = costCapFor(1);
  let cost = leader.cost;
  let si = 1;
  for (const id of starters) {
    while (si < slots.length && party[slots[si]]) si++;
    if (si >= slots.length) break;
    const c = CARD_BY_ID[id];
    if (!c || cost + c.cost > startCap) continue;
    party[slots[si]] = id;
    cost += c.cost;
    si++;
  }
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    gold: 220,
    spirit: SPIRIT_MAX,
    spiritAt: now,
    owned,
    party,
    leaderId,
    captured: [HOME_ID],
    battleSpeed: 0.1, // temporary for ATB debug / verification
    navSide: "right",
    difficulty: "normal",
  };
}


/** Strip material-only fodder from party/leader (corrupt or experimental saves). */
export function sanitizeParty(state: SaveState): SaveState {
  const party = state.party.map((id) => {
    if (!id) return null;
    const c = CARD_BY_ID[id];
    if (!c || c.fodder) return null;
    return id;
  });
  let leaderId = state.leaderId;
  if (leaderId) {
    const leader = CARD_BY_ID[leaderId];
    if (!leader || leader.fodder || !party.includes(leaderId)) {
      leaderId = party.find((id) => !!id) ?? null;
    }
  }
  return { ...state, party, leaderId };
}

export function loadSave(): SaveState {
  const base = defaultSave();
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<SaveState>;
    const ownedRaw = { ...base.owned, ...(parsed.owned ?? {}) };
    const owned: SaveState["owned"] = {};
    for (const [id, o] of Object.entries(ownedRaw)) {
      owned[id] = migrateOwned(o as Partial<OwnedCard> & { rank?: number });
    }
    const party = Array.from({ length: 9 }, (_, i) => parsed.party?.[i] ?? null);
    const now = Date.now();
    const hasSpirit = typeof (parsed as { spirit?: unknown }).spirit === "number";
    const rawSpirit = hasSpirit ? (parsed as { spirit: number }).spirit : SPIRIT_MAX;
    const rawAt =
      typeof (parsed as { spiritAt?: unknown }).spiritAt === "number"
        ? (parsed as { spiritAt: number }).spiritAt
        : now;
    // Old saves missing spirit → fill to max at now; then apply accrued regen.
    const hydrated = applySpiritRegen(
      hasSpirit ? clampSpirit(rawSpirit) : SPIRIT_MAX,
      hasSpirit ? rawAt : now,
      now,
    );
    return sanitizeParty({
      version: SAVE_VERSION,
      gold: typeof parsed.gold === "number" ? parsed.gold : base.gold,
      spirit: hydrated.spirit,
      spiritAt: hydrated.spiritAt,
      owned,
      party,
      leaderId: parsed.leaderId ?? base.leaderId,
      captured: Array.isArray(parsed.captured) ? parsed.captured : base.captured,
      battleSpeed: clampBattleSpeed(parsed.battleSpeed),
      navSide: clampNavSide(parsed.navSide),
      difficulty: clampDifficulty(parsed.difficulty),
    });
  } catch {
    return base;
  }
}

export function writeSave(state: SaveState) {
  if (typeof window === "undefined") return;
  try {
    // Drop legacy `rank` from writes; only persist skill fields.
    const owned: SaveState["owned"] = {};
    for (const [id, o] of Object.entries(state.owned)) {
      owned[id] = migrateOwned(o);
    }
    const hydrated = applySpiritRegen(
      clampSpirit(state.spirit ?? SPIRIT_MAX),
      typeof state.spiritAt === "number" ? state.spiritAt : Date.now(),
    );
    const payload: SaveState = {
      version: SAVE_VERSION,
      gold: state.gold,
      spirit: hydrated.spirit,
      spiritAt: hydrated.spiritAt,
      owned,
      party: state.party,
      leaderId: state.leaderId,
      captured: state.captured,
      battleSpeed: clampBattleSpeed(state.battleSpeed),
      navSide: clampNavSide(state.navSide),
      difficulty: clampDifficulty(state.difficulty),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode */
  }
}

export function hasSave(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function clearSave() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
