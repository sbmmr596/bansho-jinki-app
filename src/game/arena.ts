import { CARD_BY_ID, FORMATIONS, HERO_CARDS, MAX_LEVEL } from "./data";
import type { PartyMember } from "./combat";
import type { Formation } from "./types";

/**
 * Fire-Emblem-style paid arena (separate from debug endless trial).
 *
 * Fee table scales with party average level so early/late game both work.
 * Anchors at avg Lv5 ≈ 80 / 150 / 280 gold for 互角 / 剛腕 / 鬼神.
 * Rewards are fee × 1.6 / 2.2 / 3.0 (entry already paid; no refund on loss).
 * Enemy levels = round(avgLevel × 1.0 / 1.2 / 1.5), clamped 1..MAX_LEVEL.
 */
export type ArenaTier = "even" | "strong" | "demon";

export const ARENA_TIERS: ArenaTier[] = ["even", "strong", "demon"];

export const ARENA_TIER_META: Record<
  ArenaTier,
  { id: ArenaTier; name: string; levelMul: number; feeAnchor: number; rewardMul: number; blurb: string }
> = {
  even: {
    id: "even",
    name: "互角",
    levelMul: 1.0,
    feeAnchor: 80,
    rewardMul: 1.6,
    blurb: "同格の挑戦者。賭け金は控えめ。",
  },
  strong: {
    id: "strong",
    name: "剛腕",
    levelMul: 1.2,
    feeAnchor: 150,
    rewardMul: 2.2,
    blurb: "一回り強い相手。見返りも厚い。",
  },
  demon: {
    id: "demon",
    name: "鬼神",
    levelMul: 1.5,
    feeAnchor: 280,
    rewardMul: 3.0,
    blurb: "鬼神級。高額の入場料と報酬。",
  },
};

export function partyAverageLevel(
  party: (string | null)[],
  owned: Record<string, { level: number }>,
): number {
  const levels = party
    .filter((id): id is string => !!id)
    .map((id) => owned[id]?.level ?? 1);
  if (!levels.length) return 1;
  return levels.reduce((a, b) => a + b, 0) / levels.length;
}

/** Scale fee anchors so Lv5 ≈ listed fees; grows linearly with avg level. */
export function arenaFee(tier: ArenaTier, avgLevel: number): number {
  const scale = Math.max(0.5, avgLevel / 5);
  return Math.max(20, Math.round(ARENA_TIER_META[tier].feeAnchor * scale));
}

export function arenaReward(tier: ArenaTier, fee: number): number {
  return Math.max(1, Math.round(fee * ARENA_TIER_META[tier].rewardMul));
}

export function arenaEnemyLevel(avgLevel: number, tier: ArenaTier): number {
  return Math.max(1, Math.min(MAX_LEVEL, Math.round(avgLevel * ARENA_TIER_META[tier].levelMul)));
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFormation(rng: () => number): Formation {
  const ids = Object.keys(FORMATIONS);
  // Bias toward basic / simpler layouts so open-slot counts stay sane.
  if (rng() < 0.45) return FORMATIONS.basic;
  return FORMATIONS[ids[Math.floor(rng() * ids.length)]!] ?? FORMATIONS.basic;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export type ArenaEncounter = {
  seed: number;
  formationId: string;
  enemies: PartyMember[];
  fee: number;
  reward: number;
  tier: ArenaTier;
  enemyLevel: number;
};

/**
 * Build a one-shot arena bout: random heroes in a random/basic formation,
 * count ≈ player size ±1 (clamped 3–5 and by open slots).
 */
export function buildArenaEncounter(
  playerCount: number,
  avgLevel: number,
  tier: ArenaTier,
  seed = (Math.random() * 0xffffffff) >>> 0,
): ArenaEncounter {
  const rng = mulberry32(seed || 1);
  const fee = arenaFee(tier, avgLevel);
  const reward = arenaReward(tier, fee);
  const enemyLevel = arenaEnemyLevel(avgLevel, tier);
  const form = pickFormation(rng);
  const open = form.slots.map((ok, i) => (ok ? i : -1)).filter((i) => i >= 0);
  const desired = Math.max(3, Math.min(5, playerCount + (rng() < 0.5 ? -1 : 1)));
  const count = Math.max(1, Math.min(desired, open.length, HERO_CARDS.length || 1));
  const slots = shuffle(open, rng).slice(0, count);
  const pool = HERO_CARDS.length ? HERO_CARDS : Object.values(CARD_BY_ID).filter((c) => !c.fodder);
  const heroes = shuffle(pool, rng).slice(0, count);
  const leaderIdx = Math.floor(rng() * heroes.length);
  const enemies: PartyMember[] = heroes.map((card, i) => ({
    cardId: card.id,
    slot: slots[i]!,
    level: enemyLevel,
    rank: 0,
    isLeader: i === leaderIdx,
  }));
  return {
    seed,
    formationId: form.id,
    enemies,
    fee,
    reward,
    tier,
    enemyLevel,
  };
}
