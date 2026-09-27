/** プレイヤーの位。フィールドの広さは位で変わる。 */

export type PlayerRank = "rookie" | "middle" | "high" | "ace" | "master";

export const RANK_ORDER: PlayerRank[] = ["rookie", "middle", "high", "ace", "master"];

/** 2段ごとに次の位。マスターはそこから先も同じ広さ。 */
export const STAGES_PER_RANK = 2;

/** 段クリアごとの経験。閾値とコスト上限はあとで調整する。 */
export const XP_PER_CLEAR = 100;

export const RANK_META: Record<
  PlayerRank,
  { label: string; cells: number; strongholds: number; spread: number; xp: number; cost: number }
> = {
  rookie: { label: "ルーキー", cells: 30, strongholds: 5, spread: 0.62, xp: 0, cost: 10 },
  middle: { label: "ミドル", cells: 35, strongholds: 6, spread: 0.72, xp: 200, cost: 12 },
  high: { label: "ハイ", cells: 40, strongholds: 8, spread: 0.82, xp: 400, cost: 14 },
  ace: { label: "エース", cells: 45, strongholds: 9, spread: 0.9, xp: 600, cost: 17 },
  master: { label: "マスター", cells: 50, strongholds: 10, spread: 0.98, xp: 800, cost: 20 },
};

export function clampRank(v: unknown): PlayerRank {
  return RANK_ORDER.includes(v as PlayerRank) ? (v as PlayerRank) : "rookie";
}

export function rankIndex(rank: PlayerRank): number {
  return RANK_ORDER.indexOf(rank);
}

/** 所持経験から位。閾値は RANK_META.xp。 */
export function rankForXp(xp: number): PlayerRank {
  const n = Math.max(0, Math.floor(xp) || 0);
  let rank: PlayerRank = "rookie";
  for (const id of RANK_ORDER) {
    if (n >= RANK_META[id].xp) rank = id;
  }
  return rank;
}

export function costCapForRank(rank: PlayerRank): number {
  return RANK_META[rank].cost;
}

/** 旧セーブの段数から、同じ位になる経験へ寄せる。 */
export function xpForStage(stage: number): number {
  const clears = Math.max(0, (Math.floor(stage) || 1) - 1);
  return clears * XP_PER_CLEAR;
}

/** 第1段はルーキー。経験に直すと、2段クリアごとに次の位。 */
export function rankForStage(stage: number): PlayerRank {
  return rankForXp(xpForStage(stage));
}

export function rankLabel(rank: PlayerRank): string {
  return RANK_META[rank].label;
}
