import type { Skill, SkillKind } from "./types";

/**
 * Common granted skill names for 異名合成 (skill2) by SkillKind.
 * Naming inspired by Shinra Bansho Frontier 付与必殺技:
 * https://w.atwiki.jp/sinraf/pages/453.html
 * Presentation/matching layer only — do not rewrite card.skill.name.
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

/** Short kind labels for material picker / detail (e.g. 渾身の一撃（正面）). */
export const SKILL_KIND_LABEL: Record<SkillKind, string> = {
  front: "正面",
  pierce: "貫通",
  sweep: "薙ぎ",
  random: "乱撃",
  all: "全体",
  heal: "回復",
  haste: "加速",
  slow: "減速",
};

export function commonSkillName(skill: Skill | SkillKind): string {
  const kind = typeof skill === "string" ? skill : skill.kind;
  return COMMON_SKILL_NAME[kind];
}

/** Display label: unique card name by default; common granted name when opts.common. */
export function skillLabel(skill: Skill, opts?: { common?: boolean }): string {
  return opts?.common ? commonSkillName(skill) : skill.name;
}

/** Material picker line: common name + kind, e.g. 渾身の一撃（正面）. */
export function materialSkillLabel(skill: Skill): string {
  return `${commonSkillName(skill)}（${SKILL_KIND_LABEL[skill.kind]}）`;
}
