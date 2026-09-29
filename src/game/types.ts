export type ElementType = "power" | "skill" | "magic" | "void" | "heaven" | "earth";
export type Faction = "koryu" | "tekki" | "tensho" | "metsujin" | "reiju" | "yukei";
export type Rarity = "N" | "S" | "H" | "SP";
export type SkillKind = "front" | "pierce" | "sweep" | "random" | "all" | "heal" | "haste" | "slow";
/**
 * Optional add-on effect for any skill (基本技・必殺技). Orthogonal to SkillKind
 * (the 8 kinds stay fixed). See src/game/skill-effects.ts.
 */
export type SkillEffect = "delay" | "stop" | "atkUp" | "defDown" | "guardIgnore";
export type Side = "player" | "enemy";
export type FieldKind =
  | "grass"
  | "desert"
  | "snow"
  | "ice"
  | "forest"
  | "volcano"
  | "waste"
  | "magma";
export type BattleSpeed = 1 | 2 | 4;
export type NavSide = "left" | "right";
export type Difficulty = "easy" | "normal" | "hard";
export type { PlayerRank } from "./rank";
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
  /** 追加効果. Omitted = none (old JSON stays valid). */
  effect?: SkillEffect;
  desc: string;
}

/** Temporary battle status. Buff/debuff are one-shot and never stack (overwrite). */
export interface UnitStatus {
  /** 攻撃力アップ: next damaging action ×mul. left = own actions before it expires. */
  atkUp?: { mul: number; left: number };
  /** 防御力ダウン: next hit taken ×mul. */
  defDown?: { mul: number; left: number };
  /** ATB停止: seconds of ATB time left frozen. */
  stop?: number;
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
  /** Enemy formation id. Always the enemy leader's card formation for solo nodes. */
  enemyFormation?: string;
  reward: { gold: number; cardId?: string };
  home?: boolean;
  /** 占領に必要な勝利回数。省略時は 1。拠点は 2 以上。 */
  holdNeed?: number;
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
  /** 攻撃力アップ／防御力ダウン／ATB停止. */
  status?: UnitStatus;
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
      skillEffect?: SkillEffect;
      /** Actor status after the action-start tick / atkUp consumption. */
      actorStatus?: UnitStatus;
    }
  | {
      kind: "hit";
      actorUid: string;
      targetUid: string;
      damage: number;
      mod: number;
      hpAfter: number;
      /** ガード無効 turned a type guard into a normal hit. */
      guardIgnored?: boolean;
      /** Target status after this hit (defDown consumed). */
      targetStatus?: UnitStatus;
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
  | {
      kind: "effect";
      actorUid: string;
      targetUid: string;
      effect: Exclude<SkillEffect, "guardIgnore">;
      /** delay: gauge amount pushed back; stop: seconds; atkUp/defDown: multiplier. */
      value: number;
      /** Target status after applying. */
      status: UnitStatus;
    }
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
  /** 拠点を削っただけで、まだ占領していない。 */
  holdProgress?: { have: number; need: number };
  /** この段のマスと拠点をすべて占領した。 */
  stageClear?: boolean;
  rankUpLabel?: string | null;
  /** 段クリアで入った経験。 */
  xpGain?: number;
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
  /** 一人用の段。 */
  stage: number;
  /** 段クリアで溜まる経験。位とコスト上限はここから決まる。 */
  xp: number;
  /** 拠点への勝利回数。占領すると消える。 */
  holdWins: Record<string, number>;
}

export function clampBattleSpeed(n: unknown): BattleSpeed {
  // Legacy 0.1 (ATB debug) maps to 1.
  return n === 4 || n === 2 ? n : 1;
}

export function clampNavSide(v: unknown): NavSide {
  return v === "left" ? "left" : "right";
}

export function nextBattleSpeed(n: BattleSpeed): BattleSpeed {
  return n === 1 ? 2 : n === 2 ? 4 : 1;
}
