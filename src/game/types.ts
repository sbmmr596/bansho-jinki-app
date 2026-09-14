export type ElementType = "power" | "skill" | "magic" | "void" | "heaven" | "earth";
export type Faction = "koryu" | "tekki" | "tensho" | "metsujin" | "reiju" | "yukei";
export type Rarity = "N" | "R" | "SR" | "UR";
export type SkillKind = "front" | "pierce" | "sweep" | "random" | "all" | "heal" | "haste" | "slow";
export type Side = "player" | "enemy";
export type FieldKind = "grass" | "snow" | "magma" | "forest" | "waste";
export type BattleSpeed = 1 | 2 | 4;
export type NavSide = "left" | "right";
export type Screen =
  | "title"
  | "palace"
  | "collection"
  | "formation"
  | "map"
  | "scout"
  | "battle"
  | "result"
  | "summon"
  | "train";

export interface Skill {
  name: string;
  kind: SkillKind;
  power: number;
  hits?: number;
  desc: string;
}

export interface Formation {
  id: string;
  name: string;
  slots: boolean[];
  bonus: {
    hp?: number;
    atk?: number;
    def?: number;
    spd?: number;
    frontAtk?: number;
  };
  desc: string;
}

export interface Card {
  id: string;
  name: string;
  title: string;
  faction: Faction;
  type: ElementType;
  rarity: Rarity;
  cost: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  formation: string;
  skill: Skill;
  portrait?: string;
  art?: string;
  bust?: string;
  fodder?: boolean;
}

export interface OwnedCard {
  level: number;
  rank: number;
  count: number;
}

export interface EnemyUnit {
  cardId: string;
  slot: number;
  level: number;
  leader?: boolean;
}

export interface MapNode {
  id: string;
  name: string;
  short: string;
  blurb: string;
  x: number;
  y: number;
  neighbors: string[];
  hint: ElementType;
  field: FieldKind;
  enemy: EnemyUnit[];
  reward: { gold: number; cardId?: string };
  home?: boolean;
}

export interface Unit {
  uid: string;
  cardId: string;
  name: string;
  side: Side;
  slot: number;
  isLeader: boolean;
  type: ElementType;
  faction: Faction;
  skill: Skill;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  alive: boolean;
  portrait?: string;
  gauge: number;
  haste: number;
  bust?: boolean;
}

export type BattleEvent =
  | { kind: "round"; n: number }
  | { kind: "skill"; actorUid: string; skillName: string; side: Side }
  | {
      kind: "hit";
      actorUid: string;
      targetUid: string;
      damage: number;
      mod: number;
      hpAfter: number;
    }
  | {
      kind: "heal";
      actorUid: string;
      targetUid: string;
      amount: number;
      hpAfter: number;
    }
  | { kind: "ko"; uid: string; wasLeader: boolean }
  | { kind: "shift"; uid: string; slot: number }
  | { kind: "spawn"; unit: Unit }
  | { kind: "buff"; actorUid: string; mode: "haste" | "slow" }
  | { kind: "end"; winner: Side | "draw"; reason: "leader" | "wipe" | "timeout" };

export interface BattleLog {
  units: Unit[];
  events: BattleEvent[];
}

export interface BattleResult {
  winner: Side | "draw";
  reason: "leader" | "wipe" | "timeout";
  goldGain: number;
  cardGain: string | null;
  cardWasNew: boolean;
  leveled: string[];
  nodeName: string;
  trial?: boolean;
  waves?: number;
  kills?: number;
}

export const SAVE_VERSION = 1;

export interface SaveState {
  version: number;
  gold: number;
  owned: Record<string, OwnedCard>;
  party: (string | null)[];
  leaderId: string | null;
  captured: string[];
  battleSpeed: BattleSpeed;
  navSide: NavSide;
}

export function clampBattleSpeed(n: unknown): BattleSpeed {
  return n === 4 || n === 2 ? n : 1;
}

export function clampNavSide(v: unknown): NavSide {
  return v === "left" ? "left" : "right";
}

export function nextBattleSpeed(n: BattleSpeed): BattleSpeed {
  return n === 1 ? 2 : n === 2 ? 4 : 1;
}
