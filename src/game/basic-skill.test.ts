import { readFileSync } from "node:fs";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyCatalog,
  BASIC_SKILL,
  CARD_BY_ID,
  FORMATIONS,
  exportCatalogPayload,
  resetCatalog,
} from "./data.ts";
import { buildUnits, performAction, pickActionSkill, specialRate } from "./combat.ts";

function withRandom<T>(value: number, fn: () => T): T {
  const prev = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = prev;
  }
}

function member(cardId: string, slot: number, leader = false) {
  return { cardId, slot, level: 1, skill1Lv: 1, isLeader: leader };
}

after(() => {
  resetCatalog();
});

describe("basicSkill", () => {
  it("keeps the lottery and falls back to 通常攻撃 when basicSkill is missing", () => {
    assert.equal(specialRate(1), 0.2);
    resetCatalog();
    assert.equal(CARD_BY_ID.kaien?.basicSkill, undefined);
    assert.equal(CARD_BY_ID.mirei?.basicSkill?.kind, "heal");
    assert.equal(CARD_BY_ID.mirei?.skill.name, "金鱗の祈り");

    const actor = buildUnits("player", [member("kaien", 5, true)], FORMATIONS.basic)[0]!;
    const foe = buildUnits("enemy", [member("sora", 5, true)], FORMATIONS.basic)[0]!;
    const basic = withRandom(0.99, () => pickActionSkill(actor));
    assert.equal(basic.slot, "basic");
    assert.equal(basic.skill.name, BASIC_SKILL.name);
    assert.equal(basic.skillLv, 1);
    const special = withRandom(0, () => pickActionSkill(actor));
    assert.equal(special.slot, "s1");
    assert.equal(special.skill.name, "皇龍破");

    const events = withRandom(0.99, () => performAction(actor, [actor, foe]));
    const skillEv = events.find((e) => e.kind === "skill");
    assert.ok(skillEv && skillEv.kind === "skill");
    if (skillEv?.kind === "skill") {
      assert.equal(skillEv.skillName, "通常攻撃");
      assert.equal(skillEv.skillKind, "front");
      assert.equal(skillEv.slot, "basic");
    }
    assert.ok(events.some((e) => e.kind === "hit"));
    assert.equal(actor.skill.name, "皇龍破");
  });

  it("loads legacy skill-only JSON and still battles", () => {
    applyCatalog({
      replaceAll: true,
      chars: [
        {
          id: "legacy_only",
          name: "旧兵",
          faction: "tekki",
          type: "power",
          rarity: "N",
          skill: { name: "殴", kind: "front", power: 1.3, desc: "殴る" },
        },
      ],
    });
    const card = CARD_BY_ID.legacy_only;
    assert.ok(card);
    assert.equal(card.basicSkill, undefined);
    assert.equal(card.skill.name, "殴");
    const actor = buildUnits("player", [member("legacy_only", 5, true)], FORMATIONS.basic)[0]!;
    const foe = buildUnits("enemy", [member("sora", 5, true)], FORMATIONS.basic)[0]!;
    const events = withRandom(0, () => performAction(actor, [actor, foe]));
    const skillEv = events.find((e) => e.kind === "skill");
    assert.ok(skillEv && skillEv.kind === "skill" && skillEv.skillName === "殴" && skillEv.slot === "s1");
    assert.ok(events.some((e) => e.kind === "hit"));
  });

  it("uses a zero-damage support basicSkill for heal, haste, and slow", () => {
    applyCatalog({
      replaceAll: true,
      chars: [
        {
          id: "sup_heal",
          name: "癒",
          faction: "koryu",
          type: "heaven",
          rarity: "N",
          atk: 200,
          hp: 400,
          basicSkill: { name: "手当て", kind: "heal", power: 0, desc: "癒す" },
          skill: { name: "大癒", kind: "front", power: 1.4, desc: "殴る" },
        },
        {
          id: "sup_haste",
          name: "迅",
          faction: "tensho",
          type: "heaven",
          rarity: "N",
          basicSkill: { name: "追い風", kind: "haste", power: 0, desc: "速める" },
          skill: { name: "疾風", kind: "front", power: 1.2, desc: "斬る" },
        },
        {
          id: "sup_slow",
          name: "遅",
          faction: "yukei",
          type: "void",
          rarity: "N",
          basicSkill: { name: "足枷", kind: "slow", power: 0, desc: "遅らせる" },
          skill: { name: "鈍牙", kind: "front", power: 1.2, desc: "殴る" },
        },
      ],
    });

    const healer = buildUnits("player", [member("sup_heal", 5, true)], FORMATIONS.basic)[0]!;
    const ally = buildUnits("player", [member("sora", 4)], FORMATIONS.basic)[0]!;
    ally.hp = Math.floor(ally.maxHp / 2);
    const before = ally.hp;
    const healEvents = withRandom(0.99, () => performAction(healer, [healer, ally]));
    assert.ok(healEvents.some((e) => e.kind === "heal"));
    assert.equal(healEvents.some((e) => e.kind === "hit"), false);
    assert.ok(ally.hp > before);
    const skillEv = healEvents.find((e) => e.kind === "skill");
    assert.ok(
      skillEv && skillEv.kind === "skill" && skillEv.skillName === "手当て" && skillEv.skillKind === "heal",
    );

    const exported = exportCatalogPayload().chars.find((c) => c.id === "sup_heal");
    assert.deepEqual(exported?.basicSkill, { name: "手当て", kind: "heal", power: 0, desc: "癒す" });

    const party = buildUnits(
      "player",
      [member("sup_haste", 5, true), member("sora", 4)],
      FORMATIONS.basic,
    );
    const hasteEvents = withRandom(0.99, () => performAction(party[0]!, party));
    assert.ok(hasteEvents.some((e) => e.kind === "buff"));
    assert.equal(hasteEvents.some((e) => e.kind === "hit"), false);
    assert.ok(party.every((u) => u.haste === 1.15));

    const slower = buildUnits("player", [member("sup_slow", 5, true)], FORMATIONS.basic)[0]!;
    const enemy = buildUnits("enemy", [member("sora", 5, true)], FORMATIONS.basic)[0]!;
    const slowEvents = withRandom(0.99, () => performAction(slower, [slower, enemy]));
    assert.ok(slowEvents.some((e) => e.kind === "buff"));
    assert.equal(slowEvents.some((e) => e.kind === "hit"), false);
    assert.equal(enemy.haste, 0.85);
    assert.equal(slower.haste, 1);
  });

  it("ships support basicSkill in chars.json and does not damage on that roll", () => {
    const raw = JSON.parse(
      readFileSync(new URL("../../public/data/chars.json", import.meta.url), "utf8"),
    );
    applyCatalog(raw, { replaceAll: true });
    assert.equal(CARD_BY_ID.kaien?.basicSkill, undefined);
    assert.equal(CARD_BY_ID.mirei?.basicSkill?.name, "慈光");
    assert.equal(CARD_BY_ID.mirei?.skill.name, "金鱗の祈り");
    assert.equal(CARD_BY_ID.tensho_n_disciple1?.basicSkill?.kind, "haste");
    assert.equal(CARD_BY_ID.reiju_n_scout1?.basicSkill?.kind, "slow");

    const actor = buildUnits("player", [member("mirei", 5, true)], FORMATIONS.basic)[0]!;
    const ally = buildUnits("player", [member("sora", 4)], FORMATIONS.basic)[0]!;
    ally.hp = Math.floor(ally.maxHp / 2);
    const events = withRandom(0.99, () => performAction(actor, [actor, ally]));
    assert.equal(events.some((e) => e.kind === "hit"), false);
    assert.ok(events.some((e) => e.kind === "heal"));
  });

  it("ignores a broken basicSkill and keeps the special", () => {
    applyCatalog({
      replaceAll: true,
      chars: [
        {
          id: "bad_basic",
          name: "壊",
          faction: "koryu",
          type: "power",
          rarity: "N",
          basicSkill: { name: "", kind: "nope" },
          skill: { name: "斬", kind: "sweep", power: 1.1, desc: "薙ぐ" },
        },
      ],
    });
    assert.equal(CARD_BY_ID.bad_basic?.basicSkill, undefined);
    assert.equal(CARD_BY_ID.bad_basic?.skill.kind, "sweep");
  });
});
