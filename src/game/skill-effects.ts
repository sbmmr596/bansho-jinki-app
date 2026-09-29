import type { Rarity, SkillEffect, SkillKind, Unit, UnitStatus } from "./types";

/**
 * 追加効果（攻撃＋状態異常／補助）。SkillKind（8種・固定）とは別の軸で、
 * どの攻撃方法にも1つだけ付けられる。原作（神羅万象フロンティア）の
 * 「正面攻撃＋状態異常」「ランダム攻撃＋補助効果」などと同じ考え方。
 * 出典メモ: docs/sinraf-skills.md
 */
export const SKILL_EFFECT_IDS = [
  "delay",
  "stop",
  "atkUp",
  "defDown",
  "guardIgnore",
] as const satisfies readonly SkillEffect[];

/** Editor / card detail label. */
export const SKILL_EFFECT_LABEL: Record<SkillEffect, string> = {
  delay: "ATB遅延",
  stop: "ATB停止",
  atkUp: "攻撃力アップ",
  defDown: "防御力ダウン",
  guardIgnore: "ガード無効",
};

/** Short compound form for kind＋effect, e.g. 乱撃＋防御ダウン. */
export const SKILL_EFFECT_SHORT: Record<SkillEffect, string> = {
  delay: "遅延",
  stop: "停止",
  atkUp: "攻撃アップ",
  defDown: "防御ダウン",
  guardIgnore: "ガード無効",
};

/** Battle popup text (same style family as クリティカル / ガード). */
export const SKILL_EFFECT_POP: Record<SkillEffect, string> = {
  delay: "遅延",
  stop: "停止",
  atkUp: "攻撃↑",
  defDown: "防御↓",
  guardIgnore: "ガード無効",
};

/** Buff goes to allies/self; the rest lands on hit foes (guardIgnore only changes damage). */
export function isBuffEffect(effect: SkillEffect): boolean {
  return effect === "atkUp";
}

/** Accepts ids and the Japanese labels (JSON is hand-edited on Drive). Unknown → undefined. */
export function parseSkillEffect(raw: unknown): SkillEffect | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  for (const id of SKILL_EFFECT_IDS) {
    if (t === id || t.toLowerCase() === id.toLowerCase()) return id;
    if (t === SKILL_EFFECT_LABEL[id] || t === SKILL_EFFECT_SHORT[id] || t === SKILL_EFFECT_POP[id]) return id;
  }
  const alias: Record<string, SkillEffect> = {
    遅らせる: "delay",
    行動遅延: "delay",
    行動不能: "stop",
    停止: "stop",
    攻撃アップ: "atkUp",
    与ダメージアップ: "atkUp",
    防御ダウン: "defDown",
    被ダメージアップ: "defDown",
    ガード不能: "guardIgnore",
  };
  return alias[t];
}

/** Attack kinds (damage-dealing SkillKinds). */
export const ATTACK_KINDS: ReadonlySet<SkillKind> = new Set<SkillKind>(["front", "pierce", "sweep", "random", "all"]);

/**
 * 技ランク係数（原作・技威力効果一覧）。
 * 基本技: 攻撃＋効果=10 / 効果のみ=20。必殺技: 序12 改13 真14 極15（レアリティ N/S/H/SP）。
 */
export const EFFECT_RANK = {
  basicAttack: 10,
  basicPure: 20,
  special: { N: 12, S: 13, H: 14, SP: 15 } as Record<Rarity, number>,
} as const;

/** 原作の技Lv倍率 Lv1..10。 */
const EFFECT_LV_MULT = [1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.5];

export function effectLvMult(lv: number): number {
  const i = Math.max(1, Math.min(EFFECT_LV_MULT.length, Math.round(lv || 1))) - 1;
  return EFFECT_LV_MULT[i]!;
}

/**
 * 本作の ATB は原作の約2倍速（spd100 で 2.5 秒/周、原作は約5秒）。
 * 行動不能の秒数はこの比で縮める。
 */
export const STOP_TIME_SCALE = 0.5;

export interface EffectMagnitude {
  /** atkUp / defDown: damage multiplier (e.g. 1.5). */
  mul: number;
  /** delay: fraction of the ATB gauge pushed back (0..1). */
  delay: number;
  /** stop: seconds frozen on the ATB rail (game time). */
  stopSec: number;
}

/** 効果量。原作の推定式をそのまま使う（docs/sinraf-skills.md §4）。 */
export function effectMagnitude(rank: number, lvMult = 1): EffectMagnitude {
  const r = rank * lvMult;
  return {
    mul: 1 + Math.floor((1.5 * r * 100) / 30) / 100,
    delay: Math.floor((0.75 * r * 100 * 10) / 30) / 1000,
    stopSec: (Math.floor(0.25 * r * 10) / 20) * STOP_TIME_SCALE,
  };
}

/** Status durations: consumed on use, and gone after the holder's next own action. */
export const STATUS_LEFT = 1;

export function cloneStatus(s: UnitStatus | undefined): UnitStatus | undefined {
  if (!s) return undefined;
  const out: UnitStatus = {};
  if (s.atkUp) out.atkUp = { ...s.atkUp };
  if (s.defDown) out.defDown = { ...s.defDown };
  if (s.stop && s.stop > 0) out.stop = s.stop;
  return out;
}

export function hasStatus(s: UnitStatus | undefined): boolean {
  return !!s && (!!s.atkUp || !!s.defDown || (s.stop ?? 0) > 0);
}

/**
 * Called when the holder starts an action. atkUp/defDown with left=0 expire;
 * otherwise left counts down (the status is still active for this action).
 * stop is time-based and not touched here.
 */
export function tickStatus(u: Pick<Unit, "status">): void {
  const s = u.status;
  if (!s) return;
  for (const key of ["atkUp", "defDown"] as const) {
    const b = s[key];
    if (!b) continue;
    if (b.left <= 0) delete s[key];
    else b.left -= 1;
  }
}

/** Short badges for units on the field (persist while active). */
export function statusBadges(s: UnitStatus | undefined): { text: string; tone: "buff" | "debuff" | "stop" }[] {
  if (!s) return [];
  const out: { text: string; tone: "buff" | "debuff" | "stop" }[] = [];
  if (s.atkUp) out.push({ text: "攻↑", tone: "buff" });
  if (s.defDown) out.push({ text: "防↓", tone: "debuff" });
  if ((s.stop ?? 0) > 0) out.push({ text: "停", tone: "stop" });
  return out;
}

/** 「乱撃＋防御ダウン」形式。effect なしなら kindLabel だけ。 */
export function kindWithEffectLabel(kindLabel: string, effect: SkillEffect | undefined): string {
  return effect ? `${kindLabel}＋${SKILL_EFFECT_SHORT[effect]}` : kindLabel;
}
