import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyCatalog, CARD_BY_ID, exportCatalogPayload, FORMATIONS, resetCatalog } from "./data.ts";
import {
  advanceGauges,
  buildUnits,
  dealDamage,
  GAUGE_MAX,
  performAction,
  pickNextActor,
  simulateBattle,
  takeReadyActor,
} from "./combat.ts";
import { effectLvMult, effectMagnitude, parseSkillEffect, tickStatus } from "./skill-effects.ts";
import type { BattleEvent, Unit } from "./types.ts";

function withRandom<T>(value: number, fn: () => T): T {
  const prev = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = prev;
  }
}

const BASIC = 0.99; // lottery → 基本技
const SPECIAL = 0; // lottery → 必殺技1

function member(cardId: string, slot: number, leader = false, skill1Lv = 1) {
  return { cardId, slot, level: 1, skill1Lv, isLeader: leader };
}

function unit(side: "player" | "enemy", cardId: string, slot: number, leader = false, skill1Lv = 1): Unit {
  return buildUnits(side, [member(cardId, slot, leader, skill1Lv)], FORMATIONS.basic)[0]!;
}

const effects = (events: BattleEvent[]) =>
  events.filter((e): e is Extract<BattleEvent, { kind: "effect" }> => e.kind === "effect");
const hits = (events: BattleEvent[]) =>
  events.filter((e): e is Extract<BattleEvent, { kind: "hit" }> => e.kind === "hit");

function base(id: string, extra: Record<string, unknown>) {
  return {
    id,
    name: id,
    faction: "koryu",
    type: "void",
    rarity: "N",
    hp: 5000,
    atk: 200,
    def: 100,
    spd: 100,
    skill: { name: "斬", kind: "front", power: 1, desc: "" },
    ...extra,
  };
}

function loadTestCards() {
  applyCatalog({
    replaceAll: true,
    chars: [
      base("fx_rand_def", {
        basicSkill: { name: "乱牙", kind: "random", power: 0.5, hits: 3, effect: "defDown", desc: "" },
      }),
      base("fx_all_delay", {
        rarity: "SP",
        skill: { name: "天地遅滞", kind: "all", power: 0.6, effect: "遅延", desc: "" },
      }),
      base("fx_front_stop", { basicSkill: { name: "縛", kind: "front", power: 1, effect: "stop", desc: "" } }),
      base("fx_pure_stop", { basicSkill: { name: "凍", kind: "front", power: 0, effect: "stop", desc: "" } }),
      base("fx_atk", { basicSkill: { name: "昂", kind: "front", power: 1, effect: "攻撃力アップ", desc: "" } }),
      base("fx_guard", {
        type: "power",
        basicSkill: { name: "破", kind: "front", power: 1, effect: "guardIgnore", desc: "" },
      }),
      base("fx_heal_atk", { basicSkill: { name: "鼓舞", kind: "heal", power: 1, effect: "atkUp", desc: "" } }),
      base("fx_haste_atk", {
        skill: { name: "大号令", kind: "haste", power: 0, effect: "atkUp", desc: "" },
      }),
      base("fx_target", { type: "magic" }),
      base("fx_legacy", {}),
      base("fx_bad", { basicSkill: { name: "謎", kind: "front", power: 1, effect: "poison", desc: "" } }),
    ],
  });
}

after(() => resetCatalog());

describe("skill effects: catalog (optional + backward compatible)", () => {
  beforeEach(loadTestCards);

  it("parses ids and Japanese labels, ignores unknown, keeps legacy skills effect-free", () => {
    assert.equal(parseSkillEffect("defDown"), "defDown");
    assert.equal(parseSkillEffect("防御力ダウン"), "defDown");
    assert.equal(parseSkillEffect("ATB停止"), "stop");
    assert.equal(parseSkillEffect("ガード不能"), "guardIgnore");
    assert.equal(parseSkillEffect("なし"), undefined);
    assert.equal(parseSkillEffect(""), undefined);
    assert.equal(parseSkillEffect(3), undefined);
    assert.equal(CARD_BY_ID.fx_rand_def?.basicSkill?.effect, "defDown");
    assert.equal(CARD_BY_ID.fx_all_delay?.skill.effect, "delay");
    assert.equal(CARD_BY_ID.fx_atk?.basicSkill?.effect, "atkUp");
    assert.equal(CARD_BY_ID.fx_bad?.basicSkill?.effect, undefined);
    assert.equal(CARD_BY_ID.fx_bad?.basicSkill?.kind, "front");
    assert.equal("effect" in CARD_BY_ID.fx_legacy!.skill, false);
  });

  it("exports effect only when set and round-trips through applyCatalog", () => {
    const payload = exportCatalogPayload();
    const rand = payload.chars.find((c) => c.id === "fx_rand_def")!;
    assert.deepEqual(rand.basicSkill, { name: "乱牙", kind: "random", power: 0.5, desc: "", hits: 3, effect: "defDown" });
    const legacy = payload.chars.find((c) => c.id === "fx_legacy")!;
    assert.equal("effect" in (legacy.skill as object), false);
    applyCatalog(JSON.parse(JSON.stringify(payload)));
    assert.equal(CARD_BY_ID.fx_rand_def?.basicSkill?.effect, "defDown");
    assert.equal(CARD_BY_ID.fx_rand_def?.basicSkill?.hits, 3);
  });
});

describe("skill effects: magnitudes follow the original formulas", () => {
  it("basic (attack+effect rank 10, effect-only rank 20) and specials by rarity × Lv", () => {
    const basic = effectMagnitude(10);
    assert.equal(basic.mul, 1.5);
    assert.equal(basic.delay, 0.25);
    assert.equal(basic.stopSec, 0.625);
    assert.equal(effectMagnitude(20).mul, 2);
    assert.equal(effectMagnitude(12).mul, 1.6);
    assert.equal(effectMagnitude(13).delay, 0.325);
    assert.equal(effectMagnitude(13).stopSec, 0.8);
    assert.equal(effectMagnitude(15).mul, 1.75);
    assert.equal(effectLvMult(1), 1);
    assert.equal(effectLvMult(10), 1.5);
    assert.equal(effectLvMult(99), 1.5);
  });
});

describe("skill effects: battle", () => {
  beforeEach(loadTestCards);

  it("乱撃＋防御ダウン: hits then debuffs every unique target once (no stacking)", () => {
    const actor = unit("player", "fx_rand_def", 5, true);
    const a = unit("enemy", "fx_target", 5);
    const b = unit("enemy", "fx_target", 2);
    b.uid = "enemy-b";
    const ev = withRandom(BASIC, () => performAction(actor, [actor, a, b]));
    assert.equal(hits(ev).length, 3);
    const fx = effects(ev);
    assert.deepEqual(fx.map((e) => e.effect), ["defDown", "defDown"]);
    assert.equal(new Set(fx.map((e) => e.targetUid)).size, 2);
    assert.equal(a.status?.defDown?.mul, 1.5);
    assert.equal(b.status?.defDown?.mul, 1.5);
    // Second application overwrites instead of multiplying.
    withRandom(BASIC, () => performAction(actor, [actor, a, b]));
    assert.equal(a.status?.defDown?.mul, 1.5);
  });

  it("防御力ダウン boosts the next hit ×mul and is consumed by it", () => {
    const actor = unit("player", "fx_legacy", 5, true);
    const t = unit("enemy", "fx_target", 5);
    const plain = dealDamage(actor, t, actor.skill, 1).damage;
    const boosted = dealDamage(actor, t, actor.skill, 1, { defMul: 1.5 }).damage;
    assert.ok(boosted > plain);
    t.status = { defDown: { mul: 1.5, left: 1 } };
    const ev = withRandom(SPECIAL, () => performAction(actor, [actor, t]));
    const h = hits(ev)[0]!;
    assert.equal(h.damage, boosted);
    assert.deepEqual(h.targetStatus, {});
    assert.equal(t.status?.defDown, undefined);
  });

  it("全体＋遅延 (SP 必殺技): pushes every foe back on the ATB rail, clamped at 0", () => {
    const actor = unit("player", "fx_all_delay", 5, true);
    const a = unit("enemy", "fx_target", 5);
    const b = unit("enemy", "fx_target", 4);
    b.uid = "enemy-b";
    a.gauge = 900;
    b.gauge = 100;
    const ev = withRandom(SPECIAL, () => performAction(actor, [actor, a, b]));
    assert.equal(hits(ev).length, 2);
    const amount = Math.round(effectMagnitude(15).delay * GAUGE_MAX); // 極 rank 15 → 37.5%
    assert.equal(amount, 375);
    assert.equal(a.gauge, 900 - amount);
    assert.equal(b.gauge, 0);
    assert.deepEqual(
      effects(ev).map((e) => [e.effect, e.value]),
      [
        ["delay", 375],
        ["delay", 100],
      ],
    );
  });

  it("ATB停止: stopped units do not fill or act until the freeze runs out", () => {
    const actor = unit("player", "fx_front_stop", 5, true);
    const t = unit("enemy", "fx_target", 5);
    withRandom(BASIC, () => performAction(actor, [actor, t]));
    assert.equal(t.status?.stop, 0.625);
    t.gauge = GAUGE_MAX;
    assert.equal(takeReadyActor([t]), null);
    t.gauge = 0;
    advanceGauges([t], 0.5);
    assert.equal(t.gauge, 0);
    assert.ok(Math.abs((t.status?.stop ?? 0) - 0.125) < 1e-9);
    advanceGauges([t], 0.625); // 0.125 s frozen, 0.5 s filling
    assert.equal(t.status?.stop, undefined);
    assert.equal(t.gauge, Math.min(GAUGE_MAX, t.spd * 4 * 0.5));
  });

  it("pickNextActor (pre-simulated battles) waits out ATB停止", () => {
    const fast = unit("player", "fx_legacy", 5, true);
    const slow = unit("enemy", "fx_target", 5);
    slow.spd = 50;
    fast.status = { stop: 10 };
    const first = pickNextActor([fast, slow]);
    assert.equal(first?.uid, slow.uid);
    assert.equal(fast.gauge, 0);
    assert.ok((fast.status?.stop ?? 0) > 0);
  });

  it("効果のみ (威力0) skills land the effect without any hit", () => {
    const actor = unit("player", "fx_pure_stop", 5, true);
    const t = unit("enemy", "fx_target", 5);
    const hp = t.hp;
    const ev = withRandom(BASIC, () => performAction(actor, [actor, t]));
    assert.equal(hits(ev).length, 0);
    assert.equal(t.hp, hp);
    assert.equal(effects(ev)[0]?.effect, "stop");
    assert.equal(t.status?.stop, effectMagnitude(20).stopSec); // effect-only basic = rank 20
  });

  it("攻撃力アップ on an attack buffs self, boosts the next damaging action once, then expires", () => {
    const actor = unit("player", "fx_atk", 5, true);
    const t = unit("enemy", "fx_target", 5);
    const ev1 = withRandom(BASIC, () => performAction(actor, [actor, t]));
    const plain = hits(ev1)[0]!.damage;
    assert.equal(effects(ev1)[0]?.targetUid, actor.uid);
    assert.equal(actor.status?.atkUp?.mul, 1.5);
    const ev2 = withRandom(BASIC, () => performAction(actor, [actor, t]));
    const boosted = dealDamage(actor, t, actor.basicSkill!, 1, { atkMul: 1.5 }).damage;
    assert.ok(boosted > plain);
    assert.equal(hits(ev2)[0]!.damage, boosted);
    // The skill event reports the spent buff; this action then re-applies it (overwrite, not stack).
    const sk = ev2.find((e) => e.kind === "skill");
    assert.ok(sk && sk.kind === "skill" && sk.actorStatus && !sk.actorStatus.atkUp);
    assert.equal(actor.status?.atkUp?.mul, 1.5);
  });

  it("unused buffs/debuffs expire after the holder's next action", () => {
    const u = unit("enemy", "fx_target", 5);
    u.status = { defDown: { mul: 1.5, left: 1 }, atkUp: { mul: 1.6, left: 1 } };
    tickStatus(u);
    assert.ok(u.status.defDown && u.status.atkUp);
    tickStatus(u);
    assert.deepEqual(u.status, {});
  });

  it("ガード無効 turns a type guard into a neutral hit", () => {
    const actor = unit("player", "fx_guard", 5, true); // power → magic = ガード (0.5)
    const t = unit("enemy", "fx_target", 5);
    const guarded = dealDamage(actor, t, actor.skill, 1);
    assert.equal(guarded.mod, 0.5);
    const ev = withRandom(BASIC, () => performAction(actor, [actor, t]));
    const h = hits(ev)[0]!;
    assert.equal(h.mod, 1);
    assert.equal(h.guardIgnored, true);
    assert.equal(effects(ev).length, 0);
  });

  it("回復＋攻撃アップ buffs the healed ally; 加速＋攻撃アップ buffs all allies", () => {
    const healer = unit("player", "fx_heal_atk", 5, true);
    const ally = unit("player", "fx_legacy", 4);
    ally.hp = 100;
    const ev = withRandom(BASIC, () => performAction(healer, [healer, ally]));
    assert.ok(ev.some((e) => e.kind === "heal"));
    assert.equal(effects(ev)[0]?.targetUid, ally.uid);
    assert.equal(ally.status?.atkUp?.mul, 2); // support basic = rank 20

    const party = buildUnits("player", [member("fx_haste_atk", 5, true), member("fx_legacy", 4)], FORMATIONS.basic);
    const foe = unit("enemy", "fx_target", 5);
    const ev2 = withRandom(SPECIAL, () => performAction(party[0]!, [...party, foe]));
    assert.equal(effects(ev2).length, 2);
    assert.ok(party.every((u) => u.status?.atkUp?.mul === 1.6)); // N 必殺技 = 序 rank 12
    assert.equal(foe.status, undefined);
  });

  it("pre-simulated battles with effects still resolve", () => {
    const log = simulateBattle(
      [member("fx_front_stop", 5, true), member("fx_all_delay", 4), member("fx_rand_def", 3)],
      [member("fx_pure_stop", 5, true), member("fx_atk", 4)],
      "basic",
      "basic",
    );
    assert.ok(log.events.some((e) => e.kind === "end"));
    assert.ok(log.events.some((e) => e.kind === "effect"));
  });
});
