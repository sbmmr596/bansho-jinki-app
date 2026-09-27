/** プレイヤーの位。フィールドの広さは位で変わる。 */

export type PlayerRank = "rookie" | "middle" | "high" | "ace" | "master";

export const RANK_ORDER: PlayerRank[] = ["rookie", "middle", "high", "ace", "master"];

/** 2段ごとに次の位。マスターはそこから先も同じ広さ。 */
export const STAGES_PER_RANK = 2;

export const RANK_META: Record<
  PlayerRank,
  { label: string; cells: number; strongholds: number; spread: number }
> = {
  rookie: { label: "ルーキー", cells: 30, strongholds: 5, spread: 0.62 },
  middle: { label: "ミドル", cells: 35, strongholds: 6, spread: 0.72 },
  high: { label: "ハイ", cells: 40, strongholds: 8, spread: 0.82 },
  ace: { label: "エース", cells: 45, strongholds: 9, spread: 0.9 },
  master: { label: "マスター", cells: 50, strongholds: 10, spread: 0.98 },
};

export function clampRank(v: unknown): PlayerRank {
  return RANK_ORDER.includes(v as PlayerRank) ? (v as PlayerRank) : "rookie";
}

export function rankIndex(rank: PlayerRank): number {
  return RANK_ORDER.indexOf(rank);
}

/** 第1段はルーキー。2段クリアするごとに位が上がる。 */
export function rankForStage(stage: number): PlayerRank {
  const n = Math.max(1, Math.floor(stage) || 1);
  const i = Math.min(RANK_ORDER.length - 1, Math.floor((n - 1) / STAGES_PER_RANK));
  return RANK_ORDER[i];
}

export function rankLabel(rank: PlayerRank): string {
  return RANK_META[rank].label;
}
