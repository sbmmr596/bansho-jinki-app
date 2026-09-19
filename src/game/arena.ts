import { CARD_BY_ID, FORMATIONS, HERO_CARDS, MAX_LEVEL } from "./data";
import type { PartyMember } from "./combat";
import type { Card, Formation } from "./types";

/**
 * Fire-Emblem-style paid arena (separate from debug endless trial).
 *
 * Fee table scales with party average level so early/late game both work.
 * Anchors at avg Lv5 ≈ 80 / 150 / 280 gold for 互角 / 剛腕 / 鬼神.
 * Rewards are fee × 1.6 / 2.2 / 3.0 (entry already paid; no refund on loss).
 * Enemy levels = round(avgLevel × levelMul), clamped 1..MAX_LEVEL.
 * Enemy heroes are cost-matched to the player party (main fairness lever).
 */
export type ArenaTier = "even" | "strong" | "demon";

export const ARENA_TIERS: ArenaTier[] = ["even", "strong", "demon"];

/** Target enemy total cost as a multiple of player party cost. */
export const ARENA_COST_MUL: Record<ArenaTier, { min: number; max: number }> = {
  even: { min: 1.0, max: 1.0 },
  strong: { min: 1.0, max: 1.2 },
  demon: { min: 1.15, max: 1.4 },
};

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
    blurb: "同コスト同格。",
  },
  strong: {
    id: "strong",
    name: "剛腕",
    levelMul: 1.15,
    feeAnchor: 150,
    rewardMul: 2.2,
    blurb: "一回り強い相手。見返りも厚い。",
  },
  demon: {
    id: "demon",
    name: "鬼神",
    levelMul: 1.35,
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

export function partyTotalCost(party: (string | null)[]): number {
  return party
    .filter((id): id is string => !!id)
    .reduce((sum, id) => sum + (CARD_BY_ID[id]?.cost ?? 0), 0);
}

export function partyMaxCost(party: (string | null)[]): number {
  let max = 0;
  for (const id of party) {
    if (!id) continue;
    const c = CARD_BY_ID[id]?.cost ?? 0;
    if (c > max) max = c;
  }
  return max;
}

/** Midpoint estimate for UI ("相手目安コスト ~N"). */
export function arenaCostHint(playerCost: number, tier: ArenaTier): number {
  const { min, max } = ARENA_COST_MUL[tier];
  const mid = playerCost * ((min + max) / 2);
  return Math.max(1, Math.round(mid));
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

function heroPool(): Card[] {
  return HERO_CARDS.length
    ? HERO_CARDS.slice()
    : Object.values(CARD_BY_ID).filter((c) => !c.fodder);
}

/**
 * Fill `count` slots with unique heroes whose total cost stays near
 * [budgetMin, budgetMax]. Prefer cards with cost ≤ preferMaxCost.
 * Fall back to the cheapest remaining card if the budget filter empties.
 */
function pickHeroesForBudget(
  count: number,
  budgetMin: number,
  budgetMax: number,
  preferMaxCost: number,
  rng: () => number,
): Card[] {
  const pool = heroPool();
  if (!pool.length || count <= 0) return [];

  const byCostAsc = pool.slice().sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
  const cheapestCost = byCostAsc[0]!.cost;

  const picked: Card[] = [];
  const used = new Set<string>();
  let running = 0;

  for (let i = 0; i < count; i++) {
    const remainingAfter = count - i - 1;
    const reserve = cheapestCost * remainingAfter;
    const maxSpend = Math.max(cheapestCost, budgetMax - running - reserve);
    // Soft floor so we don't undershoot budgetMin too early when slots remain.
    const minSpend =
      remainingAfter === 0
        ? Math.max(0, budgetMin - running)
        : 0;

    const available = pool.filter((c) => !used.has(c.id));
    if (!available.length) break;

    let candidates = available.filter((c) => c.cost <= maxSpend && c.cost >= minSpend);
    if (!candidates.length) {
      candidates = available.filter((c) => c.cost <= maxSpend);
    }

    const preferred = candidates.filter((c) => c.cost <= preferMaxCost);
    if (preferred.length) candidates = preferred;

    if (!candidates.length) {
      // Stuck: take cheapest available so we can still fill the slot.
      const fallback = available.slice().sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
      candidates = fallback.slice(0, 1);
    }

    const card = candidates[Math.floor(rng() * candidates.length)]!;
    picked.push(card);
    used.add(card.id);
    running += card.cost;
  }

  return picked;
}

export type ArenaEncounter = {
  seed: number;
  formationId: string;
  enemies: PartyMember[];
  fee: number;
  reward: number;
  tier: ArenaTier;
  enemyLevel: number;
  /** Actual enemy party total cost (for debug / fairness checks). */
  enemyTotalCost: number;
  /** Budget window used when picking. */
  costBudget: { min: number; max: number };
};

export type ArenaBuildOpts = {
  seed?: number;
  /** Sum of CARD_BY_ID[id].cost for the player's party. */
  playerTotalCost?: number;
  /** Max single-card cost in the player's party. */
  playerMaxCost?: number;
};

/**
 * Build a one-shot arena bout: cost-matched heroes in a random/basic formation,
 * count ≈ player size ±1 (clamped 3–5 and by open slots).
 */
export function buildArenaEncounter(
  playerCount: number,
  avgLevel: number,
  tier: ArenaTier,
  opts: ArenaBuildOpts = {},
): ArenaEncounter {
  const seed = opts.seed ?? ((Math.random() * 0xffffffff) >>> 0);
  const rng = mulberry32(seed || 1);
  const fee = arenaFee(tier, avgLevel);
  const reward = arenaReward(tier, fee);
  const enemyLevel = arenaEnemyLevel(avgLevel, tier);
  const form = pickFormation(rng);
  const open = form.slots.map((ok, i) => (ok ? i : -1)).filter((i) => i >= 0);
  // 互角: match player count; other tiers allow ±1 around 3–5.
  const desired =
    tier === "even"
      ? Math.max(1, Math.min(5, playerCount))
      : Math.max(3, Math.min(5, playerCount + (rng() < 0.5 ? -1 : 1)));
  const count = Math.max(1, Math.min(desired, open.length, heroPool().length || 1));
  const slots = shuffle(open, rng).slice(0, count);

  const playerCost = Math.max(1, opts.playerTotalCost ?? count * 3);
  const preferMax = (opts.playerMaxCost ?? 6) + 1;
  const mul = ARENA_COST_MUL[tier];
  const budgetMin = Math.max(1, Math.round(playerCost * mul.min));
  const budgetMax = Math.max(budgetMin, Math.round(playerCost * mul.max));
  // Roll a target inside the window so encounters vary within the tier band.
  const target = budgetMin + Math.floor(rng() * (budgetMax - budgetMin + 1));
  // Use target as soft max when picking so we cluster near the roll, but never
  // exceed the hard tier max.
  const pickMax = Math.min(budgetMax, Math.max(budgetMin, target));

  const heroes = pickHeroesForBudget(count, budgetMin, pickMax, preferMax, rng);
  const leaderIdx = heroes.length ? Math.floor(rng() * heroes.length) : 0;
  const enemies: PartyMember[] = heroes.map((card, i) => ({
    cardId: card.id,
    slot: slots[i]!,
    level: enemyLevel,
    skill1Lv: 1,
    isLeader: i === leaderIdx,
  }));
  const enemyTotalCost = heroes.reduce((s, c) => s + c.cost, 0);

  return {
    seed,
    formationId: form.id,
    enemies,
    fee,
    reward,
    tier,
    enemyLevel,
    enemyTotalCost,
    costBudget: { min: budgetMin, max: budgetMax },
  };
}
