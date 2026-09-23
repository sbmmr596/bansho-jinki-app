import type { Rarity, Skill, SkillKind } from "./types";

/**
 * Common granted skill names for 異名合成 (skill2) by SkillKind.
 * Naming inspired by Shinra Bansho Frontier 付与必殺技:
 * https://w.atwiki.jp/sinraf/pages/453.html
 * Presentation/matching layer only — do not rewrite card.skill.name.
 *
 * Display form: base name + rarity suffix (原作風), e.g. 渾身の一撃・序
 */
export const COMMON_SKILL_NAME: Record<SkillKind, string> = {
  front: "渾身の一撃",
  pierce: "破砕の貫き",
  sweep: "旋風烈破",
  random: "神気の乱弾",
  all: "天地驚動",
  heal: "光輝の癒し",
  haste: "電光石火の大号令",
  slow: "心慌意乱",
};

/** Rarity → 原作風 suffix (N→序, S→改, H→真, SP→極). */
export const RARITY_SUFFIX: Record<Rarity, string> = {
  N: "序",
  S: "改",
  H: "真",
  SP: "極",
};

const SKILL_KIND_IDS = [
  "front",
  "pierce",
  "sweep",
  "random",
  "all",
  "heal",
  "haste",
  "slow",
] as const satisfies readonly SkillKind[];

const DEFAULT_SKILL_KIND_LABEL: Record<SkillKind, string> = {
  front: "正面",
  pierce: "貫通",
  sweep: "薙ぎ",
  random: "乱撃",
  all: "全体",
  heal: "回復",
  haste: "加速",
  slow: "減速",
};

/** Mutable labels — user catalog may override via `skillKinds` in payload. */
export const SKILL_KIND_LABEL: Record<SkillKind, string> = { ...DEFAULT_SKILL_KIND_LABEL };

/** Apply known SkillKind keys only; invalid/unknown keys ignored; missing keep current. */
export function applySkillKindLabels(raw: unknown) {
  if (!raw || typeof raw !== "object") return;
  const r = raw as Record<string, unknown>;
  for (const id of SKILL_KIND_IDS) {
    const v = r[id];
    if (typeof v === "string" && v.trim()) SKILL_KIND_LABEL[id] = v.trim();
  }
}

export function resetSkillKindLabels() {
  for (const id of SKILL_KIND_IDS) SKILL_KIND_LABEL[id] = DEFAULT_SKILL_KIND_LABEL[id];
}

/** Common granted name with rarity suffix, e.g. 渾身の一撃・序 */
export function commonSkillName(skill: Skill | SkillKind, rarity: Rarity): string {
  const kind = typeof skill === "string" ? skill : skill.kind;
  return `${COMMON_SKILL_NAME[kind]}・${RARITY_SUFFIX[rarity]}`;
}

/** Display label: unique card name by default; common granted name when opts.common + rarity. */
export function skillLabel(
  skill: Skill,
  opts?: { common?: boolean; rarity?: Rarity },
): string {
  return opts?.common && opts.rarity != null
    ? commonSkillName(skill, opts.rarity)
    : skill.name;
}

/** Material picker line: common name + rarity + kind, e.g. 渾身の一撃・序（正面）. */
export function materialSkillLabel(skill: Skill, rarity: Rarity): string {
  return `${commonSkillName(skill, rarity)}（${SKILL_KIND_LABEL[skill.kind]}）`;
}

/** True when material matches current skill2 identity (same kind + same rarity). */
export function skill2SameIdentity(
  skill2Kind: SkillKind,
  skill2Rarity: Rarity,
  materialKind: SkillKind,
  materialRarity: Rarity,
): boolean {
  return skill2Kind === materialKind && skill2Rarity === materialRarity;
}
