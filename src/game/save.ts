import {
  CARD_BY_ID,
  FORMATIONS,
  STARTER_IDS,
  HOME_ID,
  MAX_LEVEL,
  MAX_RANK,
  costCapFor,
} from "./data";
import { SAVE_VERSION, clampBattleSpeed, clampNavSide, type SaveState } from "./types";
import { clampDifficulty } from "./difficulty";

export const SAVE_KEY = "bansho-jinki-v1";

export function defaultSave(): SaveState {
  const owned: SaveState["owned"] = {};
  for (const id of STARTER_IDS) {
    owned[id] = { level: 1, rank: 0, count: 1 };
  }
  const party: (string | null)[] = Array(9).fill(null);
  const leaderId = "sora";
  const formation = FORMATIONS[CARD_BY_ID[leaderId].formation];
  const starters = STARTER_IDS.filter((id) => id !== leaderId);
  const slots = formation.slots
    .map((ok, i) => (ok ? i : -1))
    .filter((i) => i >= 0);
  party[slots[0] ?? 4] = leaderId;
  const startCap = costCapFor(1);
  let cost = CARD_BY_ID[leaderId].cost;
  let si = 1;
  for (const id of starters) {
    while (si < slots.length && party[slots[si]]) si++;
    if (si >= slots.length) break;
    const c = CARD_BY_ID[id];
    if (cost + c.cost > startCap) continue;
    party[slots[si]] = id;
    cost += c.cost;
    si++;
  }
  return {
    version: SAVE_VERSION,
    gold: 220,
    owned,
    party,
    leaderId,
    captured: [HOME_ID],
    battleSpeed: 1,
    navSide: "right",
    difficulty: "normal",
  };
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
      owned[id] = {
        level: Math.min(MAX_LEVEL, Math.max(1, o?.level ?? 1)),
        rank: Math.min(MAX_RANK, Math.max(0, o?.rank ?? 0)),
        count: Math.max(0, o?.count ?? 0),
      };
    }
    const party = Array.from({ length: 9 }, (_, i) => parsed.party?.[i] ?? null);
    return {
      version: SAVE_VERSION,
      gold: typeof parsed.gold === "number" ? parsed.gold : base.gold,
      owned,
      party,
      leaderId: parsed.leaderId ?? base.leaderId,
      captured: Array.isArray(parsed.captured) ? parsed.captured : base.captured,
      battleSpeed: clampBattleSpeed(parsed.battleSpeed),
      navSide: clampNavSide(parsed.navSide),
      difficulty: clampDifficulty(parsed.difficulty),
    };
  } catch {
    return base;
  }
}

export function writeSave(state: SaveState) {
  if (typeof window === "undefined") return;
  try {
    const payload: SaveState = {
      version: SAVE_VERSION,
      gold: state.gold,
      owned: state.owned,
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
