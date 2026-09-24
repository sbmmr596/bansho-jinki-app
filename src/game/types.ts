export type ElementType = "power" | "skill" | "magic" | "void" | "heaven" | "earth";
export type Faction = "koryu" | "tekki" | "tensho" | "metsujin" | "reiju" | "yukei";
export type Rarity = "N" | "S" | "H" | "SP";
export type SkillKind = "front" | "pierce" | "sweep" | "random" | "all" | "heal" | "haste" | "slow";
export type Side = "player" | "enemy";
export type FieldKind = "grass" | "snow" | "magma" | "forest" | "waste";
/** Temporary 0.1 for ATB debug / verification — revert when done. */
export type BattleSpeed = 0.1 | 1 | 2 | 4;
export type NavSide = "left" | "right";
export type Difficulty = "easy" | "normal" | "hard";
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
  | "train"
  | "arena";

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
  /** 必殺技1. Legacy catalogs that only set this field keep working. */
  skill: Skill;
  /**
   * 基本技. Omitted on old data — combat falls back to the shared 通常攻撃.
   * Support cards may use heal / haste / slow here (no damage).
   */
  basicSkill?: Skill;
  portrait?: string;
  art?: string;
  bust?: string;
  fodder?: boolean;
}

export interface OwnedSkill2 {
  sourceCardId: string;
  lv: number;
}

export interface OwnedCard {
  level: number;
  count: number;
  /** 必殺技1 level 1..MAX_SKILL_LV */
  skill1Lv: number;
  /** Optional installed 必殺技2 from another card */
  skill2?: OwnedSkill2;
}

export type FuseKind = "skill1" | "skill2-install" | "skill2-level" | "skill2-replace";

export interface FuseResult {
  success: boolean;
  kind: FuseKind;
  newLv: number;
  rate?: number;
  message: string;
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
  /** 必殺技1 */
  skill: Skill;
  skillLv: number;
  /** 基本技. Missing → shared 通常攻撃 at action time. */
  basicSkill?: Skill;
  skill2?: { skill: Skill; lv: number; rarity: Rarity };
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
  | {
      kind: "skill";
      actorUid: string;
      skillName: string;
      side: Side;
      slot: "basic" | "s1" | "s2";
      /** Kind actually used this action (basic and special can differ). */
      skillKind: SkillKind;
    }
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
  arena?: boolean;
  waves?: number;
  kills?: number;
}

export const SAVE_VERSION = 1;

export interface SaveState {
  version: number;
  gold: number;
  /** 闘技場入場用の闘気（0..SPIRIT_MAX）。 */
  spirit: number;
  /** Epoch ms when spirit was last reconciled (regen clock). */
  spiritAt: number;
  owned: Record<string, OwnedCard>;
  party: (string | null)[];
  leaderId: string | null;
  captured: string[];
  battleSpeed: BattleSpeed;
  navSide: NavSide;
  /** Set at new game; continue uses saved value. Default normal for old saves. */
  difficulty: Difficulty;
}

export function clampBattleSpeed(n: unknown): BattleSpeed {
  // 0.1 is temporary for ATB debug / verification
  return n === 0.1 || n === 4 || n === 2 ? n : 1;
}

export function clampNavSide(v: unknown): NavSide {
  return v === "left" ? "left" : "right";
}

export function nextBattleSpeed(n: BattleSpeed): BattleSpeed {
  // Cycle includes temporary 0.1 for ATB debug / verification
  return n === 0.1 ? 1 : n === 1 ? 2 : n === 2 ? 4 : 0.1;
}
