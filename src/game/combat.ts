import { CARD_BY_ID, FORMATIONS, scaledStat } from "./data";
import type {
  BattleEvent,
  BattleLog,
  ElementType,
  EnemyUnit,
  Formation,
  Side,
  Unit,
} from "./types";

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

function dealDamage(actor: Unit, target: Unit): { damage: number; mod: number } {
  const mod = typeMod(actor.type, target.type);
  const raw = actor.atk * actor.skill.power;
  const reduced = raw * (90 / (90 + target.def));
  const damage = Math.max(1, Math.floor(reduced * mod));
  return { damage, mod };
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
  rank: number;
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
    let hp = scaledStat(card.hp, m.level, m.rank);
    let atk = scaledStat(card.atk, m.level, m.rank);
    let def = scaledStat(card.def, m.level, m.rank);
    let spd = scaledStat(card.spd, m.level, m.rank);
    ({ hp, atk, def, spd } = applyFormation(hp, atk, def, spd, m.slot, formation));
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

export function enemyToMembers(enemy: EnemyUnit[]): PartyMember[] {
  return enemy.map((e) => ({
    cardId: e.cardId,
    slot: e.slot,
    level: e.level,
    rank: 0,
    isLeader: !!e.leader,
  }));
}

export function performAction(actor: Unit, units: Unit[]): BattleEvent[] {
  const events: BattleEvent[] = [
    { kind: "skill", actorUid: actor.uid, skillName: actor.skill.name, side: actor.side },
  ];
  let targets = selectTargets(actor, units);
  if (actor.skill.kind === "heal") {
    targets = targets.filter((t) => t.side === actor.side);
  } else {
    targets = targets.filter((t) => t.side !== actor.side && t.alive);
  }
  if (actor.skill.kind === "heal") {
    const t = targets[0];
    if (t && t.hp < t.maxHp) {
      const raw = Math.floor(actor.atk * actor.skill.power * 0.3);
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
    return events;
  }
  if (actor.skill.kind === "haste" || actor.skill.kind === "slow") {
    const mul = actor.skill.kind === "haste" ? 1.15 : 0.85;
    for (const t of targets) {
      t.haste = Math.max(0.5, Math.min(2, (t.haste ?? 1) * mul));
    }
    events.push({ kind: "buff", actorUid: actor.uid, mode: actor.skill.kind });
    return events;
  }
  for (const t of targets) {
    if (!t.alive) continue;
    const { damage, mod } = dealDamage(actor, t);
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
