import { MAX_LEVEL } from "./data";
import type { Difficulty } from "./types";

/** Flavor name + plain reading for UI. */
export const DIFFICULTY_META: Record<
  Difficulty,
  { id: Difficulty; flavor: string; plain: string; blurb: string }
> = {
  easy: {
    id: "easy",
    flavor: "閑話",
    plain: "かんたん",
    blurb: "敵レベルがやや低い。初めての征途向け。",
  },
  normal: {
    id: "normal",
    flavor: "正伝",
    plain: "ふつう",
    blurb: "想定どおりの敵強さ。標準の正伝。",
  },
  hard: {
    id: "hard",
    flavor: "修羅",
    plain: "むずかしい",
    blurb: "敵レベルが高い。修羅の道。",
  },
};

export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

export function clampDifficulty(v: unknown): Difficulty {
  return v === "easy" || v === "hard" || v === "normal" ? v : "normal";
}

/**
 * Scale a map/scout enemy's authored level by save difficulty.
 * easy ≈ 0.85× (floor, min 1); normal 1.0×; hard ≈ 1.25× (ceil, cap MAX_LEVEL).
 */
export function scaleEnemyLevel(baseLevel: number, difficulty: Difficulty): number {
  const base = Math.max(1, Math.floor(baseLevel));
  if (difficulty === "easy") {
    return Math.max(1, Math.floor(base * 0.85));
  }
  if (difficulty === "hard") {
    return Math.min(MAX_LEVEL, Math.ceil(base * 1.25));
  }
  return Math.min(MAX_LEVEL, base);
}

export function difficultyLabel(d: Difficulty): string {
  const m = DIFFICULTY_META[d];
  return `${m.flavor}（${m.plain}）`;
}
