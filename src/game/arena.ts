import { CARD_BY_ID, FORMATIONS, HERO_CARDS, MAX_LEVEL } from "./data";
import type { PartyMember } from "./combat";
import type { Card, Formation } from "./types";

/**
 * Fire-Emblem-style arena (separate from debug endless trial).
 *
 * Entry costs 闘気 (spirit): 互角1 / 剛腕2 / 鬼神3. Cap 5; +1 per minute.
 * Gold "fee" table still scales win-reward baseline with party average level
 * (anchors at avg Lv5 ≈ 80 / 150 / 280 × rewardMul). No gold deducted on entry.
 *
 * Balance levers:
 * - 互角: same unit count, exact cost budget, same total level sum, skill1Lv=1 (no skill2)
 * - 剛腕/鬼神: mild cost + level pool bumps and light skill1 bumps
 * - Win gold ≈ fee×rewardMul × clamp(enemyScore/playerScore, 0.85, 1.6)
 *   where score = totalCost×10 + totalLevel×3 + Σ skill1Lv
 */
export type ArenaTier = "even" | "strong" | "demon";

export const ARENA_TIERS: ArenaTier[] = ["even", "strong", "demon"];

/** Target enemy total cost as a multiple of player party cost. */
export const ARENA_COST_MUL: Record<ArenaTier, { min: number; max: number }> = {
  even: { min: 1.0, max: 1.0 },
  strong: { min: 1.05, max: 1.15 },
  demon: { min: 1.15, max: 1.3 },
};

/** Midpoint level-sum multiplier (UI + estimate). Actual roll uses the band below. */
export const ARENA_LEVEL_MUL_BAND: Record<ArenaTier, { min: number; max: number }> = {
  even: { min: 1.0, max: 1.0 },
  strong: { min: 1.1, max: 1.15 },
  demon: { min: 1.2, max: 1.35 },
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
    rewardMul: 0.6,
    blurb: "同コスト・同合計Lv・スキル1。互角の勝負。",
  },
  strong: {
    id: "strong",
    name: "剛腕",
    levelMul: 1.12,
    feeAnchor: 150,
    rewardMul: 1.2,
    blurb: "コスト・合計Lvをやや上乗せ。スキル1は1〜2。",
  },
  demon: {
    id: "demon",
    name: "鬼神",
    levelMul: 1.27,
    feeAnchor: 280,
    rewardMul: 2.0,
    blurb: "コスト・合計Lvをさらに上げる。スキル1は2〜3。",
  },
};

/** Strength-ratio clamp for win gold (enemy vs player). */
export const ARENA_STRENGTH_RATIO = { min: 0.85, max: 1.6 } as const;

export function partyAverageLevel(
  party: (string | null)[],
  owned: Record<string, { level: number }>,
): number {
  const levels = partyLevels(party, owned);
  if (!levels.length) return 1;
  return levels.reduce((a, b) => a + b, 0) / levels.length;
}

export function partyLevels(
  party: (string | null)[],
  owned: Record<string, { level?: number }>,
): number[] {
  return party
    .filter((id): id is string => !!id)
    .map((id) => Math.max(1, owned[id]?.level ?? 1));
}

export function partyTotalLevel(
  party: (string | null)[],
  owned: Record<string, { level?: number }>,
): number {
  return partyLevels(party, owned).reduce((a, b) => a + b, 0);
}

export function partySkill1Lvs(
  party: (string | null)[],
  owned: Record<string, { skill1Lv?: number }>,
): number[] {
  return party
    .filter((id): id is string => !!id)
    .map((id) => Math.max(1, owned[id]?.skill1Lv ?? 1));
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

/** score = totalCost×10 + totalLevel×3 + Σ skill1Lv */
export function strengthScore(
  totalCost: number,
  levels: number[],
  skill1Lvs: number[],
): number {
  const totalLevel = levels.reduce((a, b) => a + b, 0);
  const skillSum = skill1Lvs.reduce((a, b) => a + Math.max(1, b), 0);
  return Math.max(1, totalCost) * 10 + totalLevel * 3 + skillSum;
}

export function partyStrengthScore(
  party: (string | null)[],
  owned: Record<string, { level?: number; skill1Lv?: number }>,
): number {
  const levels = partyLevels(party, owned);
  const skills = partySkill1Lvs(party, owned);
  return strengthScore(partyTotalCost(party), levels, skills);
}

/** Midpoint estimate for UI ("相手目安コスト ~N"). */
export function arenaCostHint(playerCost: number, tier: ArenaTier): number {
  const { min, max } = ARENA_COST_MUL[tier];
  const mid = playerCost * ((min + max) / 2);
  return Math.max(1, Math.round(mid));
}

/** Midpoint estimate for UI ("相手目安合計Lv ~N"). */
export function arenaLevelSumHint(playerLevelSum: number, tier: ArenaTier): number {
  const { min, max } = ARENA_LEVEL_MUL_BAND[tier];
  const mid = playerLevelSum * ((min + max) / 2);
  return Math.max(1, Math.round(mid));
}

/** Scale fee anchors so Lv5 ≈ listed fees; grows linearly with avg level. */
export function arenaFee(tier: ArenaTier, avgLevel: number): number {
  const scale = Math.max(0.5, avgLevel / 5);
  return Math.max(20, Math.round(ARENA_TIER_META[tier].feeAnchor * scale));
}

/** Legacy fixed mul (no strength ratio). Prefer arenaRewardFromStrength. */
export function arenaReward(tier: ArenaTier, fee: number): number {
  return Math.max(1, Math.round(fee * ARENA_TIER_META[tier].rewardMul));
}

/**
 * Win gold from fee baseline × strength ratio (enemy vs player).
 * 互角 perfect match → ~fee×0.6; harder foes pay more within the clamp.
 */
export function arenaRewardFromStrength(
  tier: ArenaTier,
  avgLevel: number,
  playerScore: number,
  enemyScore: number,
): number {
  const fee = arenaFee(tier, avgLevel);
  const base = fee * ARENA_TIER_META[tier].rewardMul;
  const ratio = Math.max(
    ARENA_STRENGTH_RATIO.min,
    Math.min(ARENA_STRENGTH_RATIO.max, enemyScore / Math.max(1, playerScore)),
  );
  return Math.max(1, Math.round(base * ratio));
}

/** UI estimate before the bout is rolled (uses mid cost/level/skill). */
export function arenaRewardEstimate(
  tier: ArenaTier,
  avgLevel: number,
  playerCost: number,
  playerLevels: number[],
  playerSkill1Lvs?: number[],
): number {
  const count = Math.max(1, playerLevels.length);
  const pSkills =
    playerSkill1Lvs && playerSkill1Lvs.length === playerLevels.length
      ? playerSkill1Lvs
      : Array.from({ length: count }, () => 1);
  const pScore = strengthScore(playerCost, playerLevels, pSkills);

  const costMid = arenaCostHint(playerCost, tier);
  const levelMid = arenaLevelSumHint(
    playerLevels.reduce((a, b) => a + b, 0) || Math.round(avgLevel) * count,
    tier,
  );
  // Expected average skill1Lv per unit for the tier band.
  const skillAvg = tier === "even" ? 1 : tier === "strong" ? 1.3 : 2.5;
  const eSkills = Array.from({ length: count }, () => skillAvg);
  // Spread levelMid across `count` for the score (sum matters, not distribution).
  const eLevels = allocateLevels(count, levelMid, () => 0.5);
  const eScore = strengthScore(costMid, eLevels, eSkills);
  return arenaRewardFromStrength(tier, avgLevel, pScore, eScore);
}

/** 闘技場入場に使う闘気（スタミナ）。互角1・剛腕2・鬼神3。 */
export const SPIRIT_MAX = 5;
/** 1分で互角1回分（+1）回復。 */
export const SPIRIT_REGEN_MS = 60_000;

export const ARENA_SPIRIT_COST: Record<ArenaTier, number> = {
  even: 1,
  strong: 2,
  demon: 3,
};

export function arenaSpiritCost(tier: ArenaTier): number {
  return ARENA_SPIRIT_COST[tier];
}

export function clampSpirit(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(SPIRIT_MAX, Math.floor(n)));
}

/**
 * Apply accrued regen from spiritAt → now (floor minutes), clamp to max.
 * Preserves partial-minute progress by advancing spiritAt by whole ticks.
 * When at max, spiritAt snaps to now so future undershoot starts clean.
 */
export function applySpiritRegen(
  spirit: number,
  spiritAt: number,
  now = Date.now(),
): { spirit: number; spiritAt: number } {
  let cur = clampSpirit(spirit);
  let at = typeof spiritAt === "number" && Number.isFinite(spiritAt) ? spiritAt : now;
  if (cur >= SPIRIT_MAX) {
    return { spirit: SPIRIT_MAX, spiritAt: now };
  }
  const elapsed = Math.max(0, now - at);
  const gained = Math.floor(elapsed / SPIRIT_REGEN_MS);
  if (gained <= 0) {
    return { spirit: cur, spiritAt: at };
  }
  const next = Math.min(SPIRIT_MAX, cur + gained);
  const nextAt = next >= SPIRIT_MAX ? now : at + gained * SPIRIT_REGEN_MS;
  return { spirit: next, spiritAt: nextAt };
}

/** @deprecated Prefer allocateLevels from a total pool; kept for callers/UI. */
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

function pickFormation(rng: () => number, minOpen = 3): Formation {
  // Formations may only expose 3–5 open slots; clamp picker bounds accordingly.
  const lo = Math.max(3, Math.min(5, minOpen));
  const ids = Object.keys(FORMATIONS);
  const withRoom = ids
    .map((id) => FORMATIONS[id]!)
    .filter((f) => {
      const n = f.slots.filter(Boolean).length;
      return n >= lo && n <= 5;
    });
  const pool = withRoom.length ? withRoom : [FORMATIONS.basic];
  // Bias toward basic when it has enough open slots.
  if (FORMATIONS.basic.slots.filter(Boolean).length >= lo && rng() < 0.45) {
    return FORMATIONS.basic;
  }
  return pool[Math.floor(rng() * pool.length)]! ?? FORMATIONS.basic;
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
    // Keep a soft floor so early cheap picks cannot make budgetMin unreachable.
    const slotsLeft = remainingAfter + 1;
    const avgNeeded = (budgetMin - running) / slotsLeft;
    const minSpend =
      remainingAfter === 0
        ? Math.max(0, budgetMin - running)
        : Math.max(0, Math.ceil(avgNeeded) - 1);

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

/**
 * Distribute integer levels across `count` units so they sum to `totalSum`
 * (clamped to [count, count×MAX_LEVEL]). When `mirror` has the same length,
 * start from that distribution and nudge to hit the sum.
 */
export function allocateLevels(
  count: number,
  totalSum: number,
  rng: () => number,
  mirror?: number[],
): number[] {
  if (count <= 0) return [];
  const lo = 1;
  const hi = MAX_LEVEL;
  const target = Math.max(count * lo, Math.min(count * hi, Math.round(totalSum)));

  let levels: number[];
  if (mirror && mirror.length === count) {
    levels = mirror.map((l) => Math.max(lo, Math.min(hi, Math.round(l))));
  } else {
    const base = Math.floor(target / count);
    const rem = target - base * count;
    levels = Array.from({ length: count }, (_, i) =>
      Math.max(lo, Math.min(hi, base + (i < rem ? 1 : 0))),
    );
  }

  let sum = levels.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (sum < target && guard++ < count * MAX_LEVEL) {
    const order = shuffle(
      levels.map((_, i) => i),
      rng,
    );
    let stepped = false;
    for (const i of order) {
      if (levels[i]! < hi) {
        levels[i]!++;
        sum++;
        stepped = true;
        break;
      }
    }
    if (!stepped) break;
  }
  while (sum > target && guard++ < count * MAX_LEVEL * 2) {
    const order = shuffle(
      levels.map((_, i) => i),
      rng,
    );
    let stepped = false;
    for (const i of order) {
      if (levels[i]! > lo) {
        levels[i]!--;
        sum--;
        stepped = true;
        break;
      }
    }
    if (!stepped) break;
  }
  return levels;
}

function rollLevelSum(playerSum: number, tier: ArenaTier, rng: () => number): number {
  const band = ARENA_LEVEL_MUL_BAND[tier];
  const mul = band.min + rng() * (band.max - band.min);
  return Math.max(1, Math.round(playerSum * mul));
}

function rollSkill1Lv(tier: ArenaTier, rng: () => number): number {
  if (tier === "even") return 1;
  if (tier === "strong") {
    // Mostly 1, some 2.
    return rng() < 0.3 ? 2 : 1;
  }
  // demon: 2–3
  return rng() < 0.5 ? 2 : 3;
}

export type ArenaEncounter = {
  seed: number;
  formationId: string;
  enemies: PartyMember[];
  fee: number;
  reward: number;
  tier: ArenaTier;
  /** Mean enemy level (for debug / legacy UI). */
  enemyLevel: number;
  /** Actual enemy party total cost (for debug / fairness checks). */
  enemyTotalCost: number;
  /** Actual enemy total level sum. */
  enemyTotalLevel: number;
  /** Budget window used when picking. */
  costBudget: { min: number; max: number };
  /** Strength scores used for the reward ratio. */
  strength: { player: number; enemy: number; ratio: number };
};

export type ArenaBuildOpts = {
  seed?: number;
  /** Sum of CARD_BY_ID[id].cost for the player's party. */
  playerTotalCost?: number;
  /** Max single-card cost in the player's party. */
  playerMaxCost?: number;
  /** Per-unit levels of the player's party (order does not need to match slots). */
  playerLevels?: number[];
  /** Per-unit skill1Lv of the player's party (for strength score). */
  playerSkill1Lvs?: number[];
};

/**
 * Build a one-shot arena bout: cost-matched heroes in a random/basic formation.
 * 互角 matches player count / cost / total level / skill1=1.
 * Higher tiers scale cost + level pool mildly and bump skill1.
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
  // Match player count so cost/level budgets stay balanced (strength comes from mul/skills).
  // Enemy unit count / formation opens stay in the 3–5 band (formations never have 6+).
  const desired =
    tier === "even"
      ? Math.max(1, Math.min(5, playerCount))
      : Math.max(3, Math.min(5, playerCount));
  const form = pickFormation(rng, desired);
  const open = form.slots.map((ok, i) => (ok ? i : -1)).filter((i) => i >= 0);
  const count = Math.max(1, Math.min(desired, open.length, heroPool().length || 1));
  const slots = shuffle(open, rng).slice(0, count);

  const playerCost = Math.max(1, opts.playerTotalCost ?? count * 3);
  // Allow slightly higher single-card cost on tougher tiers so budget bands stay hittable.
  const preferMax = (opts.playerMaxCost ?? 6) + (tier === "even" ? 1 : tier === "strong" ? 2 : 3);
  const mul = ARENA_COST_MUL[tier];
  const budgetMin = Math.max(1, Math.round(playerCost * mul.min));
  const budgetMax = Math.max(budgetMin, Math.round(playerCost * mul.max));
  // Roll a target inside the window so encounters vary within the tier band.
  const target = budgetMin + Math.floor(rng() * (budgetMax - budgetMin + 1));
  // Use target as soft max when picking so we cluster near the roll, but never
  // exceed the hard tier max.
  const pickMax = Math.min(budgetMax, Math.max(budgetMin, target));

  const heroes = pickHeroesForBudget(count, budgetMin, pickMax, preferMax, rng);

  const playerLevels =
    opts.playerLevels && opts.playerLevels.length
      ? opts.playerLevels.map((l) => Math.max(1, Math.min(MAX_LEVEL, Math.round(l))))
      : Array.from({ length: Math.max(1, playerCount) }, () =>
          Math.max(1, Math.round(avgLevel)),
        );
  const playerLevelSum = playerLevels.reduce((a, b) => a + b, 0) || Math.max(1, Math.round(avgLevel) * count);
  const levelSum = rollLevelSum(playerLevelSum, tier, rng);
  const mirror = playerLevels.length === heroes.length ? playerLevels : undefined;
  const levels = allocateLevels(heroes.length, levelSum, rng, mirror);
  const skills = heroes.map(() => rollSkill1Lv(tier, rng));

  const leaderIdx = heroes.length ? Math.floor(rng() * heroes.length) : 0;
  const enemies: PartyMember[] = heroes.map((card, i) => ({
    cardId: card.id,
    slot: slots[i]!,
    level: levels[i] ?? 1,
    skill1Lv: skills[i] ?? 1,
    // No skill2 on arena foes (互角 explicit; higher tiers still rare/absent).
    isLeader: i === leaderIdx,
  }));
  const enemyTotalCost = heroes.reduce((s, c) => s + c.cost, 0);
  const enemyTotalLevel = enemies.reduce((s, e) => s + e.level, 0);
  const enemyLevel =
    enemies.length > 0 ? Math.round(enemyTotalLevel / enemies.length) : arenaEnemyLevel(avgLevel, tier);

  const pSkills =
    opts.playerSkill1Lvs && opts.playerSkill1Lvs.length === playerLevels.length
      ? opts.playerSkill1Lvs.map((s) => Math.max(1, s))
      : playerLevels.map(() => 1);
  const playerScore = strengthScore(playerCost, playerLevels, pSkills);
  const enemyScore = strengthScore(
    enemyTotalCost,
    enemies.map((e) => e.level),
    enemies.map((e) => e.skill1Lv),
  );
  const ratio = Math.max(
    ARENA_STRENGTH_RATIO.min,
    Math.min(ARENA_STRENGTH_RATIO.max, enemyScore / Math.max(1, playerScore)),
  );
  const reward = arenaRewardFromStrength(tier, avgLevel, playerScore, enemyScore);

  return {
    seed,
    formationId: form.id,
    enemies,
    fee,
    reward,
    tier,
    enemyLevel,
    enemyTotalCost,
    enemyTotalLevel,
    costBudget: { min: budgetMin, max: budgetMax },
    strength: { player: playerScore, enemy: enemyScore, ratio },
  };
}
