import { CARD_BY_ID, FORMATIONS, cardBasicSkill, scaledStat, skillPowerScale } from "./data";
import { commonSkillName } from "./skillNames";
import {
  ATTACK_KINDS,
  cloneStatus,
  EFFECT_RANK,
  effectLvMult,
  effectMagnitude,
  hasStatus,
  STATUS_LEFT,
  tickStatus,
} from "./skill-effects";
import type {
  BattleEvent,
  BattleLog,
  Difficulty,
  ElementType,
  EnemyUnit,
  Formation,
  OwnedSkill2,
  Rarity,
  Side,
  Skill,
  Unit,
} from "./types";
import { scaleEnemyLevel } from "./difficulty";

const CRIT = 1.5;
const S_CRIT = 1.2;
const GUARD = 0.5;
const S_GUARD = 0.75;

export function typeMod(atk: ElementType, def: ElementType): number {
  if (atk === def) return 1;
  const table: Record<ElementType, Partial<Record<ElementType, number>>> = {
    power: { skill: CRIT, magic: GUARD, heaven: S_GUARD },
    skill: { magic: CRIT, power: GUARD, heaven: S_GUARD },
    magic: { power: CRIT, skill: GUARD, heaven: S_GUARD },
    void: { heaven: CRIT, earth: CRIT },
    heaven: {
      power: S_CRIT,
      skill: S_CRIT,
      magic: S_CRIT,
      earth: GUARD,
      void: GUARD,
    },
    earth: { heaven: CRIT, void: GUARD },
  };
  return table[atk][def] ?? 1;
}

export function modLabel(mod: number): "致命" | "強" | "防" | "耐" | null {
  if (mod >= 1.45) return "致命";
  if (mod >= 1.15) return "強";
  if (mod <= 0.55) return "防";
  if (mod <= 0.8) return "耐";
  return null;
}

/** Battle FX affinity label: type-up → クリティカル, type-down → ガード, neutral → none. */
export function affinityLabel(mod: number): "クリティカル" | "ガード" | null {
  if (mod > 1) return "クリティカル";
  if (mod < 1) return "ガード";
  return null;
}

export function rowOf(slot: number): number {
  return Math.floor(slot / 3);
}
export function colOf(slot: number): number {
  return slot % 3;
}

export function living(units: Unit[], side: Side): Unit[] {
  return units.filter((u) => u.side === side && u.alive);
}

function frontmostInRow(units: Unit[], side: Side, row: number): Unit | null {
  const rowUnits = living(units, side).filter((u) => rowOf(u.slot) === row);
  if (!rowUnits.length) return null;
  return rowUnits.sort((a, b) => colOf(b.slot) - colOf(a.slot))[0];
}

function pierceRow(units: Unit[], side: Side, row: number): Unit[] {
  return living(units, side)
    .filter((u) => rowOf(u.slot) === row)
    .sort((a, b) => colOf(b.slot) - colOf(a.slot));
}

function sweepFront(units: Unit[], side: Side): Unit[] {
  const ls = living(units, side);
  if (!ls.length) return [];
  const maxCol = Math.max(...ls.map((u) => colOf(u.slot)));
  return ls.filter((u) => colOf(u.slot) === maxCol);
}

function fisherYates<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(units: Unit[], side: Side, n: number): Unit[] {
  const pool = fisherYates(living(units, side));
  if (!pool.length) return [];
  const out: Unit[] = [];
  for (let i = 0; i < n; i++) out.push(pool[i % pool.length]);
  return out;
}

function lowestHpAlly(units: Unit[], side: Side): Unit | null {
  const ls = living(units, side).filter((u) => u.hp < u.maxHp);
  if (!ls.length) return living(units, side)[0] ?? null;
  return ls.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
}

function selectTargets(actor: Unit, units: Unit[], skill: Skill): Unit[] {
  const foe: Side = actor.side === "player" ? "enemy" : "player";
  const row = rowOf(actor.slot);
  switch (skill.kind) {
    case "front": {
      const same = frontmostInRow(units, foe, row);
      if (same) return [same];
      const all = living(units, foe).sort((a, b) => colOf(b.slot) - colOf(a.slot));
      return all[0] ? [all[0]] : [];
    }
    case "pierce": {
      const rowHits = pierceRow(units, foe, row);
      if (rowHits.length) return rowHits;
      return living(units, foe).slice(0, 1);
    }
    case "sweep":
      return sweepFront(units, foe);
    case "random":
      return pickRandom(units, foe, skill.hits ?? 2);
    case "all":
      return living(units, foe);
    case "heal": {
      const t = lowestHpAlly(units, actor.side);
      return t ? [t] : [];
    }
    case "haste":
      return living(units, actor.side);
    case "slow":
      return living(units, foe);
    default:
      return [];
  }
}

export interface DamageOpts {
  /** 攻撃力アップ multiplier on the attacker (1 = none). */
  atkMul?: number;
  /** 防御力ダウン multiplier on the target (1 = none). */
  defMul?: number;
  /** ガード無効: type guard (<1) becomes neutral. Crits are kept. */
  guardIgnore?: boolean;
}

export function dealDamage(
  actor: Unit,
  target: Unit,
  skill: Skill,
  skillLv: number,
  opts: DamageOpts = {},
): { damage: number; mod: number; guardIgnored: boolean } {
  const typed = typeMod(actor.type, target.type);
  const guardIgnored = !!opts.guardIgnore && typed < 1;
  const mod = guardIgnored ? 1 : typed;
  const power = skill.power * skillPowerScale(skillLv);
  const raw = actor.atk * power;
  const reduced = raw * (90 / (90 + target.def));
  const boost = (opts.atkMul ?? 1) * (opts.defMul ?? 1);
  const damage = Math.max(1, Math.floor(reduced * mod * boost));
  return { damage, mod, guardIgnored };
}

export type ActionSkillSlot = "basic" | "s1" | "s2";

export interface PickedActionSkill {
  skill: Skill;
  skillLv: number;
  slot: ActionSkillSlot;
  /** Specials only: rarity that sets the effect rank (s1 = card, s2 = source card). */
  rarity?: Rarity;
}

/**
 * Action pick (two-step), rates scale with skill levels:
 * 1) Special chance = clamp(
 *      0.20 + 0.02*(skill1Lv-1) + (skill2 ? 0.015*(skill2Lv-1) : 0),
 *      0.18, 0.45)
 *    Examples: s1Lv1 no s2 → 20%; s1Lv5 → 28%; s1Lv10 → 38%;
 *              s1Lv10+s2Lv10 → min(45%, 38%+0.135)=45%
 * 2) If special fires and skill2 exists →
 *      p(s1) = skill1Lv / (skill1Lv + skill2Lv), else s1 100%
 * 3) Else the card's basicSkill (or shared 通常攻撃 when unset),
 *    at skillLv 1 with no power scale
 */
export function specialRate(skill1Lv: number, skill2Lv?: number): number {
  const s1 = Math.max(1, skill1Lv);
  const s2Bonus =
    skill2Lv != null && skill2Lv > 0 ? 0.015 * (Math.max(1, skill2Lv) - 1) : 0;
  const raw = 0.2 + 0.02 * (s1 - 1) + s2Bonus;
  return Math.min(0.45, Math.max(0.18, raw));
}

export const ACTION_RATES = {
  specialBase: 0.2,
  specialPerSkill1Lv: 0.02,
  specialPerSkill2Lv: 0.015,
  specialMin: 0.18,
  specialMax: 0.45,
  /** @see specialRate */
  specialRate,
} as const;

/** Pick which skill a unit uses this action (basic / s1 / s2). */
export function pickActionSkill(actor: Unit): PickedActionSkill {
  const s1Lv = Math.max(1, actor.skillLv);
  const hasS2 = !!actor.skill2;
  const s2Lv = hasS2 ? Math.max(1, actor.skill2!.lv) : undefined;
  const rate = specialRate(s1Lv, s2Lv);

  // Step 1: special vs basic
  if (Math.random() >= rate) {
    return { skill: cardBasicSkill(actor), skillLv: 1, slot: "basic" };
  }
  // Step 2: which special (weight by levels when skill2 equipped)
  if (hasS2 && s2Lv != null) {
    const pS1 = s1Lv / (s1Lv + s2Lv);
    if (Math.random() < pS1) {
      return { skill: actor.skill, skillLv: s1Lv, slot: "s1", rarity: cardRarity(actor) };
    }
    return { skill: actor.skill2!.skill, skillLv: s2Lv, slot: "s2", rarity: actor.skill2!.rarity };
  }
  return { skill: actor.skill, skillLv: s1Lv, slot: "s1", rarity: cardRarity(actor) };
}

function cardRarity(actor: Unit): Rarity {
  return CARD_BY_ID[actor.cardId]?.rarity ?? "N";
}

/** True when an attack-kind skill carries an effect and no damage (効果のみ). */
export function isPureEffectSkill(skill: Skill): boolean {
  return !!skill.effect && skill.effect !== "guardIgnore" && ATTACK_KINDS.has(skill.kind) && !(skill.power > 0);
}

/** Effect rank per the original: 基本技 10 (with attack) / 20 (effect only); specials by rarity. */
export function effectRankFor(picked: Pick<PickedActionSkill, "skill" | "slot" | "rarity">): number {
  if (picked.slot === "basic") {
    return isPureEffectSkill(picked.skill) || !ATTACK_KINDS.has(picked.skill.kind)
      ? EFFECT_RANK.basicPure
      : EFFECT_RANK.basicAttack;
  }
  return EFFECT_RANK.special[picked.rarity ?? "N"];
}

function uniqueAlive(list: Unit[]): Unit[] {
  const seen = new Set<string>();
  const out: Unit[] = [];
  for (const u of list) {
    if (!u.alive || seen.has(u.uid)) continue;
    seen.add(u.uid);
    out.push(u);
  }
  return out;
}

/**
 * Who receives the add-on effect.
 * - atkUp (buff): heal/haste → the skill's allies; attack with damage / slow → self;
 *   effect-only attack → all allies for 全体, else random ally(ies).
 * - debuffs: the foes this skill hit/targeted; heal/haste → the front foe.
 */
function effectRecipients(
  actor: Unit,
  units: Unit[],
  skill: Skill,
  primary: Unit[],
  pure: boolean,
): Unit[] {
  const effect = skill.effect;
  if (!effect || effect === "guardIgnore") return [];
  const ally = actor.side;
  if (effect === "atkUp") {
    if (skill.kind === "heal" || skill.kind === "haste") return uniqueAlive(primary);
    if (!pure) return actor.alive ? [actor] : [];
    if (skill.kind === "all") return living(units, ally);
    return uniqueAlive(pickRandom(units, ally, skill.kind === "random" ? (skill.hits ?? 1) : 1));
  }
  if (skill.kind === "heal" || skill.kind === "haste") {
    return uniqueAlive(selectTargets(actor, units, { ...skill, kind: "front" }));
  }
  return uniqueAlive(primary).filter((t) => t.side !== ally);
}

function applySkillEffect(actor: Unit, recipients: Unit[], picked: PickedActionSkill): BattleEvent[] {
  const effect = picked.skill.effect;
  if (!effect || effect === "guardIgnore") return [];
  const lvMult = picked.slot === "basic" ? 1 : effectLvMult(picked.skillLv);
  const mag = effectMagnitude(effectRankFor(picked), lvMult);
  const events: BattleEvent[] = [];
  for (const t of recipients) {
    if (!t.alive) continue;
    let value = 0;
    if (effect === "delay") {
      const amount = Math.round(mag.delay * GAUGE_MAX);
      value = Math.min(t.gauge, amount);
      t.gauge = Math.max(0, t.gauge - amount);
    } else if (effect === "stop") {
      value = mag.stopSec;
      const s = (t.status ??= {});
      // No stacking: keep whichever freeze lasts longer.
      s.stop = Math.max(s.stop ?? 0, mag.stopSec);
    } else {
      value = mag.mul;
      const s = (t.status ??= {});
      const prev = s[effect];
      // Overwrite (never stack): stronger multiplier wins, duration refreshes.
      s[effect] = { mul: Math.max(prev?.mul ?? 1, mag.mul), left: STATUS_LEFT };
    }
    events.push({
      kind: "effect",
      actorUid: actor.uid,
      targetUid: t.uid,
      effect,
      value,
      status: cloneStatus(t.status) ?? {},
    });
  }
  return events;
}

function applyFormation(
  hp: number,
  atk: number,
  def: number,
  spd: number,
  slot: number,
  formation: Formation,
): { hp: number; atk: number; def: number; spd: number } {
  const b = formation.bonus;
  if (b.hp) hp = Math.round(hp * (1 + b.hp));
  if (b.atk) atk = Math.round(atk * (1 + b.atk));
  if (b.def) def = Math.round(def * (1 + b.def));
  if (b.spd) spd = Math.round(spd * (1 + b.spd));
  if (b.frontAtk && colOf(slot) === 2) atk = Math.round(atk * (1 + b.frontAtk));
  return { hp, atk, def, spd };
}

export interface PartyMember {
  cardId: string;
  slot: number;
  level: number;
  /** @deprecated ignored for stats */
  rank?: number;
  skill1Lv: number;
  skill2?: OwnedSkill2;
  isLeader: boolean;
}

export function buildUnits(
  side: Side,
  members: PartyMember[],
  formation: Formation,
): Unit[] {
  const units: Unit[] = [];
  for (const m of members) {
    const card = CARD_BY_ID[m.cardId];
    if (!card) continue;
    let hp = scaledStat(card.hp, m.level);
    let atk = scaledStat(card.atk, m.level);
    let def = scaledStat(card.def, m.level);
    let spd = scaledStat(card.spd, m.level);
    ({ hp, atk, def, spd } = applyFormation(hp, atk, def, spd, m.slot, formation));
    const skill1Lv = Math.max(1, m.skill1Lv ?? 1);
    let skill2: Unit["skill2"];
    if (m.skill2?.sourceCardId) {
      const src = CARD_BY_ID[m.skill2.sourceCardId];
      if (src) {
        skill2 = {
          skill: src.skill,
          lv: Math.max(1, m.skill2.lv ?? 1),
          rarity: src.rarity,
        };
      }
    }
    units.push({
      uid: `${side}-${m.slot}`,
      cardId: card.id,
      name: card.name,
      side,
      slot: m.slot,
      isLeader: !!m.isLeader,
      type: card.type,
      faction: card.faction,
      skill: card.skill,
      skillLv: skill1Lv,
      ...(card.basicSkill ? { basicSkill: card.basicSkill } : {}),
      skill2,
      hp,
      maxHp: hp,
      atk,
      def,
      spd,
      alive: true,
      portrait: card.portrait,
      gauge: 0,
      haste: 1,
    });
  }
  return units;
}

export function enemyToMembers(enemy: EnemyUnit[], difficulty: Difficulty = "normal"): PartyMember[] {
  return enemy.map((e) => ({
    cardId: e.cardId,
    slot: e.slot,
    level: scaleEnemyLevel(e.level, difficulty),
    skill1Lv: 1,
    isLeader: !!e.leader,
  }));
}

export function performAction(actor: Unit, units: Unit[]): BattleEvent[] {
  const picked = pickActionSkill(actor);
  const { skill, skillLv, slot } = picked;
  // Action start: expire / count down the actor's one-shot buffs & debuffs.
  const hadStatus = hasStatus(actor.status);
  tickStatus(actor);
  const pure = isPureEffectSkill(skill);
  const dealsDamage = ATTACK_KINDS.has(skill.kind) && !pure;
  const atkUp = dealsDamage ? actor.status?.atkUp : undefined;
  if (atkUp && actor.status) delete actor.status.atkUp;
  const events: BattleEvent[] = [
    {
      kind: "skill",
      actorUid: actor.uid,
      skillName: slot === "s2" && actor.skill2 ? commonSkillName(skill, actor.skill2.rarity) : skill.name,
      side: actor.side,
      slot,
      skillKind: skill.kind,
      ...(skill.effect ? { skillEffect: skill.effect } : {}),
      ...(hadStatus || hasStatus(actor.status) ? { actorStatus: cloneStatus(actor.status) ?? {} } : {}),
    },
  ];
  let targets = selectTargets(actor, units, skill);
  // haste buffs allies; slow and damage hit foes. (Previously haste was filtered out.)
  if (skill.kind === "heal" || skill.kind === "haste") {
    targets = targets.filter((t) => t.side === actor.side && t.alive);
  } else {
    targets = targets.filter((t) => t.side !== actor.side && t.alive);
  }
  if (skill.kind === "heal") {
    const t = targets[0];
    if (t && t.hp < t.maxHp) {
      const power = skill.power * skillPowerScale(skillLv);
      const raw = Math.floor(actor.atk * power * 0.3);
      const cap = Math.floor(t.maxHp * 0.14);
      const amount = Math.max(1, Math.min(raw, cap, t.maxHp - t.hp));
      t.hp = Math.min(t.maxHp, t.hp + amount);
      events.push({
        kind: "heal",
        actorUid: actor.uid,
        targetUid: t.uid,
        amount,
        hpAfter: t.hp,
      });
    }
    events.push(...applySkillEffect(actor, effectRecipients(actor, units, skill, targets, pure), picked));
    return events;
  }
  if (skill.kind === "haste" || skill.kind === "slow") {
    const mul = skill.kind === "haste" ? 1.15 : 0.85;
    for (const t of targets) {
      t.haste = Math.max(0.5, Math.min(2, (t.haste ?? 1) * mul));
    }
    events.push({ kind: "buff", actorUid: actor.uid, mode: skill.kind });
    events.push(...applySkillEffect(actor, effectRecipients(actor, units, skill, targets, pure), picked));
    return events;
  }
  if (pure) {
    // 効果のみ（威力0）: no hit events, just the effect on the targeted units.
    events.push(...applySkillEffect(actor, effectRecipients(actor, units, skill, targets, pure), picked));
    return events;
  }
  const guardIgnore = skill.effect === "guardIgnore";
  targets.forEach((t, i) => {
    if (!t.alive) return;
    // 原作: 与ダメアップは連続攻撃なら1撃目だけ。範囲攻撃は全員に乗る。
    const atkMul = atkUp && (skill.kind !== "random" || i === 0) ? atkUp.mul : 1;
    const defDown = t.status?.defDown;
    if (defDown && t.status) delete t.status.defDown;
    const { damage, mod, guardIgnored } = dealDamage(actor, t, skill, skillLv, {
      atkMul,
      defMul: defDown?.mul ?? 1,
      guardIgnore,
    });
    t.hp = Math.max(0, t.hp - damage);
    events.push({
      kind: "hit",
      actorUid: actor.uid,
      targetUid: t.uid,
      damage,
      mod,
      hpAfter: t.hp,
      ...(guardIgnored ? { guardIgnored: true } : {}),
      ...(defDown ? { targetStatus: cloneStatus(t.status) ?? {} } : {}),
    });
    if (t.hp <= 0 && t.alive) {
      t.alive = false;
      events.push({ kind: "ko", uid: t.uid, wasLeader: t.isLeader });
    }
  });
  events.push(...applySkillEffect(actor, effectRecipients(actor, units, skill, targets, pure), picked));
  return events;
}

export const GAUGE_MAX = 1000;
/** spd 100 で約 2.5 秒で一周。haste で加速・減速できる。 */
export const ATB_PER_SEC = 4;

export function atbRate(u: Unit): number {
  return Math.max(1, u.spd * Math.max(0.1, u.haste ?? 1));
}

/** Remaining ATB停止 seconds (0 when not stopped). */
export function stopLeft(u: Pick<Unit, "status">): number {
  return Math.max(0, u.status?.stop ?? 0);
}

/**
 * Gauge + stop after `sec` seconds of ATB time. ATB停止 eats time first,
 * then the gauge fills at the normal rate.
 */
export function gaugeAfter(u: Unit, sec: number): { gauge: number; stop: number } {
  const t = Math.max(0, sec);
  const s = stopLeft(u);
  const run = Math.max(0, t - s);
  return {
    gauge: Math.min(GAUGE_MAX, (u.gauge ?? 0) + atbRate(u) * ATB_PER_SEC * run),
    stop: Math.max(0, s - t),
  };
}

/** Immutable variant for view state: returns the same object when nothing changed. */
export function stepUnitGauge(u: Unit, sec: number): Unit {
  const { gauge, stop } = gaugeAfter(u, sec);
  const s = stopLeft(u);
  if (gauge === u.gauge && stop === s) return u;
  if (stop === s) return { ...u, gauge };
  const status = { ...(u.status ?? {}) };
  if (stop > 0) status.stop = stop;
  else delete status.stop;
  return { ...u, gauge, status };
}

function setStop(u: Unit, stop: number) {
  if (stop > 0) (u.status ??= {}).stop = stop;
  else if (u.status) delete u.status.stop;
}

export function advanceGauges(units: Unit[], dt: number) {
  const sec = Math.max(0, dt);
  for (const u of units) {
    if (!u.alive) continue;
    const { gauge, stop } = gaugeAfter(u, sec);
    u.gauge = gauge;
    if (stop !== stopLeft(u)) setStop(u, stop);
  }
}

export function takeReadyActor(units: Unit[]): Unit | null {
  const ready = units.filter((u) => u.alive && u.gauge >= GAUGE_MAX && stopLeft(u) <= 0);
  if (!ready.length) return null;
  ready.sort((a, b) => atbRate(b) - atbRate(a) || (a.side === "player" ? -1 : 1));
  const actor = ready[0]!;
  return actor;
}

export function pickNextActor(units: Unit[]): Unit | null {
  const alive = units.filter((u) => u.alive);
  if (!alive.length) return null;
  // Time here is in "rate units" (gauge += t * atbRate); ATB停止 seconds convert by ATB_PER_SEC.
  const timeToAct = (u: Unit) => stopLeft(u) * ATB_PER_SEC + (GAUGE_MAX - u.gauge) / atbRate(u);
  let best = alive[0];
  let bestT = timeToAct(best);
  for (const u of alive) {
    const t = timeToAct(u);
    if (t < bestT - 1e-9) {
      best = u;
      bestT = t;
    } else if (Math.abs(t - bestT) < 1e-9) {
      if (atbRate(u) > atbRate(best) || (u.spd === best.spd && u.side === "player" && best.side !== "player")) {
        best = u;
        bestT = t;
      }
    }
  }
  for (const u of alive) {
    const { gauge, stop } = gaugeAfter(u, bestT / ATB_PER_SEC);
    u.gauge = gauge;
    if (stop !== stopLeft(u)) setStop(u, stop);
  }
  best.gauge = GAUGE_MAX;
  setStop(best, 0);
  return best;
}

export function simulateBattle(
  player: PartyMember[],
  enemy: PartyMember[],
  playerFormationId: string,
  enemyFormationId: string,
): BattleLog {
  const pf = FORMATIONS[playerFormationId] ?? FORMATIONS.basic;
  const ef = FORMATIONS[enemyFormationId] ?? FORMATIONS.basic;
  const units = [...buildUnits("player", player, pf), ...buildUnits("enemy", enemy, ef)];
  const events: BattleEvent[] = [];
  const MAX_ACTIONS = 48;

  const leaderAlive = (side: Side) => {
    const lead = units.find((u) => u.side === side && u.isLeader);
    if (!lead) return living(units, side).length > 0;
    return lead.alive;
  };

  const finish = (winner: Side | "draw", reason: "leader" | "wipe" | "timeout") => {
    events.push({ kind: "end", winner, reason });
  };

  events.push({ kind: "round", n: 1 });
  for (let n = 1; n <= MAX_ACTIONS; n++) {
    const actor = pickNextActor(units);
    if (!actor) break;
    if (n > 1 && (n - 1) % 6 === 0) events.push({ kind: "round", n: Math.floor((n - 1) / 6) + 1 });
    events.push(...performAction(actor, units));
    actor.gauge = 0;
    if (!leaderAlive("player")) {
      finish("enemy", "leader");
      break;
    }
    if (!leaderAlive("enemy")) {
      finish("player", "leader");
      break;
    }
    if (!living(units, "player").length) {
      finish("enemy", "wipe");
      break;
    }
    if (!living(units, "enemy").length) {
      finish("player", "wipe");
      break;
    }
  }

  if (!events.some((e) => e.kind === "end")) {
    const php = units.filter((u) => u.side === "player" && u.alive).reduce((s, u) => s + u.hp, 0);
    const ehp = units.filter((u) => u.side === "enemy" && u.alive).reduce((s, u) => s + u.hp, 0);
    if (php > ehp) finish("player", "timeout");
    else if (ehp > php) finish("enemy", "timeout");
    else finish("draw", "timeout");
  }

  const snapshot = buildUnits("player", player, pf).concat(buildUnits("enemy", enemy, ef));
  return { units: snapshot, events };
}

export function formationOfLeader(leaderId: string | null): Formation {
  if (!leaderId) return FORMATIONS.basic;
  const card = CARD_BY_ID[leaderId];
  if (!card) return FORMATIONS.basic;
  return FORMATIONS[card.formation] ?? FORMATIONS.basic;
}
