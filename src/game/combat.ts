import { BASIC_SKILL, CARD_BY_ID, FORMATIONS, scaledStat, skillPowerScale } from "./data";
import type {
  BattleEvent,
  BattleLog,
  Difficulty,
  ElementType,
  EnemyUnit,
  Formation,
  OwnedSkill2,
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

function selectTargets(actor: Unit, units: Unit[]): Unit[] {
  const foe: Side = actor.side === "player" ? "enemy" : "player";
  const row = rowOf(actor.slot);
  switch (actor.skill.kind) {
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
      return pickRandom(units, foe, actor.skill.hits ?? 2);
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

function dealDamage(actor: Unit, target: Unit, skill: Skill, skillLv: number): { damage: number; mod: number } {
  const mod = typeMod(actor.type, target.type);
  const power = skill.power * skillPowerScale(skillLv);
  const raw = actor.atk * power;
  const reduced = raw * (90 / (90 + target.def));
  const damage = Math.max(1, Math.floor(reduced * mod));
  return { damage, mod };
}

export type ActionSkillSlot = "basic" | "s1" | "s2";

export interface PickedActionSkill {
  skill: Skill;
  skillLv: number;
  slot: ActionSkillSlot;
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
 * 3) Else basic (通常攻撃 / BASIC_SKILL at skillLv 1, no power scale)
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
    return { skill: BASIC_SKILL, skillLv: 1, slot: "basic" };
  }
  // Step 2: which special (weight by levels when skill2 equipped)
  if (hasS2 && s2Lv != null) {
    const pS1 = s1Lv / (s1Lv + s2Lv);
    if (Math.random() < pS1) {
      return { skill: actor.skill, skillLv: s1Lv, slot: "s1" };
    }
    return { skill: actor.skill2!.skill, skillLv: s2Lv, slot: "s2" };
  }
  return { skill: actor.skill, skillLv: s1Lv, slot: "s1" };
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
        skill2 = { skill: src.skill, lv: Math.max(1, m.skill2.lv ?? 1) };
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
  const { skill, skillLv, slot } = pickActionSkill(actor);
  // Temporarily bind chosen skill so selectTargets reads actor.skill.kind
  const prev = actor.skill;
  actor.skill = skill;
  const events: BattleEvent[] = [
    { kind: "skill", actorUid: actor.uid, skillName: skill.name, side: actor.side, slot },
  ];
  let targets = selectTargets(actor, units);
  if (skill.kind === "heal") {
    targets = targets.filter((t) => t.side === actor.side);
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
    actor.skill = prev;
    return events;
  }
  if (skill.kind === "haste" || skill.kind === "slow") {
    const mul = skill.kind === "haste" ? 1.15 : 0.85;
    for (const t of targets) {
      t.haste = Math.max(0.5, Math.min(2, (t.haste ?? 1) * mul));
    }
    events.push({ kind: "buff", actorUid: actor.uid, mode: skill.kind });
    actor.skill = prev;
    return events;
  }
  for (const t of targets) {
    if (!t.alive) continue;
    const { damage, mod } = dealDamage(actor, t, skill, skillLv);
    t.hp = Math.max(0, t.hp - damage);
    events.push({
      kind: "hit",
      actorUid: actor.uid,
      targetUid: t.uid,
      damage,
      mod,
      hpAfter: t.hp,
    });
    if (t.hp <= 0 && t.alive) {
      t.alive = false;
      events.push({ kind: "ko", uid: t.uid, wasLeader: t.isLeader });
    }
  }
  actor.skill = prev;
  return events;
}

export const GAUGE_MAX = 1000;
/** spd 100 で約 2.5 秒で一周。haste で加速・減速できる。 */
export const ATB_PER_SEC = 4;

export function atbRate(u: Unit): number {
  return Math.max(1, u.spd * Math.max(0.1, u.haste ?? 1));
}

export function advanceGauges(units: Unit[], dt: number) {
  const k = ATB_PER_SEC * Math.max(0, dt);
  for (const u of units) {
    if (!u.alive) continue;
    u.gauge = Math.min(GAUGE_MAX, u.gauge + atbRate(u) * k);
  }
}

export function takeReadyActor(units: Unit[]): Unit | null {
  const ready = units.filter((u) => u.alive && u.gauge >= GAUGE_MAX);
  if (!ready.length) return null;
  ready.sort((a, b) => atbRate(b) - atbRate(a) || (a.side === "player" ? -1 : 1));
  const actor = ready[0]!;
  return actor;
}

export function pickNextActor(units: Unit[]): Unit | null {
  const alive = units.filter((u) => u.alive);
  if (!alive.length) return null;
  let best = alive[0];
  let bestT = (GAUGE_MAX - best.gauge) / atbRate(best);
  for (const u of alive) {
    const t = (GAUGE_MAX - u.gauge) / atbRate(u);
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
    u.gauge = Math.min(GAUGE_MAX, u.gauge + bestT * atbRate(u));
  }
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
