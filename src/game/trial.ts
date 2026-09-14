import { advanceGauges, buildUnits, colOf, formationOfLeader, living, performAction, takeReadyActor } from "./combat";
import type { PartyMember } from "./combat";
import { CARD_BY_ID, FODDER_CARDS, FORMATIONS, HERO_CARDS, MAX_LEVEL, scaledStat, SPECIAL_FODDER } from "./data";
import type { BattleEvent, FieldKind, Unit } from "./types";

const FIELDS: FieldKind[] = ["grass", "forest", "waste", "snow", "magma"];
const MAX_ENEMY = 5;

export type TrialLive = {
  units: Unit[];
  spawnSeq: number;
  spawned: number;
  kills: number;
  field: FieldKind;
  started: boolean;
};

let ACTIVE: TrialLive | null = null;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function fodderLevel(kills: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor(Math.max(0, kills) / 50));
}

function makeEnemyUnit(cardId: string, slot: number, seq: number, hero: boolean, kills = 0): Unit | null {
  const card = CARD_BY_ID[cardId];
  if (!card) return null;
  const lv = hero ? 1 : fodderLevel(kills);
  const hp = scaledStat(card.hp, lv, 0);
  const atk = scaledStat(card.atk, lv, 0);
  const def = scaledStat(card.def, lv, 0);
  const spd = scaledStat(card.spd, lv, 0);
  return {
    uid: `e-${seq}`,
    cardId: card.id,
    name: card.name,
    side: "enemy",
    slot,
    isLeader: false,
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
    bust: hero,
  };
}

function packEnemies(units: Unit[]): BattleEvent[] {
  const events: BattleEvent[] = [];
  for (let iter = 0; iter < 3; iter++) {
    const foes = living(units, "enemy");
    if (!foes.length) break;
    const occ = new Set(foes.map((u) => colOf(u.slot)));
    let emptyCol = -1;
    for (let col = 2; col >= 1; col--) {
      if (!occ.has(col) && [...occ].some((c) => c < col)) {
        emptyCol = col;
        break;
      }
    }
    if (emptyCol < 0) break;
    for (const u of foes) {
      if (colOf(u.slot) < emptyCol) {
        const dest = u.slot + 1;
        events.push({ kind: "shift", uid: u.uid, slot: dest });
        u.slot = dest;
      }
    }
  }
  return events;
}

function emptyBackFirst(units: Unit[]): number[] {
  const used = new Set(living(units, "enemy").map((u) => u.slot));
  const empty = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((s) => !used.has(s));
  const byCol = new Map<number, number[]>();
  for (const s of empty) {
    const c = colOf(s);
    const list = byCol.get(c) ?? [];
    list.push(s);
    byCol.set(c, list);
  }
  const ordered: number[] = [];
  for (const col of [0, 1, 2]) {
    const list = byCol.get(col);
    if (!list) continue;
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    ordered.push(...list);
  }
  return ordered;
}

function namedCap(kills: number): number {
  return Math.min(MAX_ENEMY, 1 + Math.floor(Math.max(0, kills) / 500));
}

function livingNamed(units: Unit[]): number {
  return living(units, "enemy").filter((u) => !CARD_BY_ID[u.cardId]?.fodder).length;
}

function fillRearIfEmpty(live: TrialLive): BattleEvent[] {
  const foes = living(live.units, "enemy");
  if (foes.some((u) => colOf(u.slot) === 0)) return [];
  const need = MAX_ENEMY - foes.length;
  if (need <= 0) return [];
  const events: BattleEvent[] = [];
  const slots = emptyBackFirst(live.units).slice(0, need);
  let namedLeft = Math.max(0, namedCap(live.kills) - livingNamed(live.units));
  for (const slot of slots) {
    live.spawnSeq += 1;
    live.spawned += 1;
    const hero = namedLeft > 0 && Math.random() < 0.1;
    if (hero) namedLeft -= 1;
    const special = !hero && Math.random() < 0.04;
    const card = hero ? pick(HERO_CARDS) : special ? pick(SPECIAL_FODDER) : pick(FODDER_CARDS);
    const unit = makeEnemyUnit(card.id, slot, live.spawnSeq, hero, live.kills);
    if (!unit) continue;
    live.units.push(unit);
    events.push({ kind: "spawn", unit: { ...unit } });
  }
  return events;
}

export function setupTrial(player: PartyMember[]): TrialLive {
  const forms = Object.values(FORMATIONS);
  const form = pick(forms);
  const raw = form.slots.map((ok, i) => (ok ? i : -1)).filter((i) => i >= 0);
  for (let i = raw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [raw[i], raw[j]] = [raw[j], raw[i]];
  }
  const slots = raw.slice(0, MAX_ENEMY);
  const pf = formationOfLeader(player.find((p) => p.isLeader)?.cardId ?? null);
  const pUnits = buildUnits("player", player, pf);
  let spawnSeq = 0;
  const enemies: Unit[] = [];
  for (const slot of slots) {
    spawnSeq += 1;
    const unit = makeEnemyUnit(pick(FODDER_CARDS).id, slot, spawnSeq, false);
    if (unit) enemies.push(unit);
  }
  const units = [...pUnits, ...enemies];
  const live: TrialLive = {
    units,
    spawnSeq,
    spawned: enemies.length,
    kills: 0,
    field: pick(FIELDS),
    started: false,
  };
  fillRearIfEmpty(live);
  live.spawned = living(live.units, "enemy").length;
  return live;
}

export function beginTrial(player: PartyMember[]): TrialLive {
  ACTIVE = setupTrial(player);
  return ACTIVE;
}

export function activeTrial(): TrialLive | null {
  return ACTIVE;
}

export function clearTrial() {
  ACTIVE = null;
}

function healPlayerArmy(units: Unit[], ticks: number): BattleEvent[] {
  if (ticks <= 0) return [];
  const events: BattleEvent[] = [];
  for (const u of living(units, "player")) {
    const amount = Math.max(1, Math.floor(u.maxHp * 0.15 * ticks));
    const next = Math.min(u.maxHp, u.hp + amount);
    const gain = next - u.hp;
    if (gain <= 0) continue;
    u.hp = next;
    events.push({
      kind: "heal",
      actorUid: u.uid,
      targetUid: u.uid,
      amount: gain,
      hpAfter: u.hp,
    });
  }
  return events;
}

export function pumpTrial(live: TrialLive, dt = 0): BattleEvent[] {
  if (!living(live.units, "player").length) {
    return [{ kind: "end", winner: "enemy", reason: "wipe" }];
  }
  if (!live.started) {
    live.started = true;
    return [{ kind: "round", n: 1 }];
  }
  if (dt > 0) advanceGauges(live.units, dt);
  const actor = takeReadyActor(live.units);
  if (!actor) return [];
  const events = performAction(actor, live.units);
  const killed = events.filter((e) => {
    if (e.kind !== "ko") return false;
    const u = live.units.find((x) => x.uid === e.uid);
    return u?.side === "enemy";
  }).length;
  if (killed > 0) {
    const prev = live.kills;
    live.kills += killed;
    const ticks = Math.floor(live.kills / 50) - Math.floor(prev / 50);
    events.push(...healPlayerArmy(live.units, ticks));
    events.push(...packEnemies(live.units));
    events.push(...fillRearIfEmpty(live));
  }
  if (!living(live.units, "player").length) {
    events.push({ kind: "end", winner: "enemy", reason: "wipe" });
  }
  return events;
}
