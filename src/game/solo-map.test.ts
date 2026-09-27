import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CARD_BY_ID, FODDER_CARDS, FORMATIONS } from "./data.ts";
import { SORTIE_SPIRIT } from "./arena.ts";
import { hpGaugeColor } from "./hp-gauge.ts";
import { RANK_META, RANK_ORDER, XP_PER_CLEAR, costCapForRank, rankForStage, rankForXp } from "./rank.ts";
import { SOLO_FIELDS, applyVictory, soloStage, STRONGHOLD_WINS } from "./solo-map.ts";
import { WAR_CONCEPT, warConceptBalanced } from "./war-concept.ts";

const fodderIds = new Set(FODDER_CARDS.map((c) => c.id));

describe("solo map", () => {
  it("scales cell count and spread with rank", () => {
    for (const rank of RANK_ORDER) {
      const map = soloStage(rank, 1);
      const meta = RANK_META[rank];
      assert.equal(map.nodes.length, meta.cells);
      assert.equal(map.nodes.filter((n) => (n.holdNeed ?? 1) > 1).length, meta.strongholds);
      assert.equal(map.nodes.filter((n) => n.home).length, 1);
      const fields = new Set(map.nodes.map((n) => n.field));
      assert.equal(fields.size, 1);
      const xs = map.nodes.map((n) => n.x);
      const span = Math.max(...xs) - Math.min(...xs);
      assert.ok(span > 20, `${rank} span ${span}`);
    }
    const rook = soloStage("rookie", 1);
    const master = soloStage("master", 1);
    const span = (nodes: { x: number }[]) => Math.max(...nodes.map((n) => n.x)) - Math.min(...nodes.map((n) => n.x));
    assert.ok(span(master.nodes) > span(rook.nodes));
  });

  it("stays inside 30 to 50 cells and 5 to 10 strongholds", () => {
    for (const rank of RANK_ORDER) {
      const m = RANK_META[rank];
      assert.ok(m.cells >= 30 && m.cells <= 50);
      assert.ok(m.strongholds >= 5 && m.strongholds <= 10);
    }
  });

  it("is a connected network of fodder-only fights", () => {
    const map = soloStage("middle", 3);
    const seen = new Set<string>();
    const q = [map.homeId];
    while (q.length) {
      const id = q.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const nb of map.byId[id].neighbors) q.push(nb);
    }
    assert.equal(seen.size, map.nodes.length);
    const formations = new Set<string>();
    for (const n of map.nodes) {
      if (n.home) {
        assert.equal(n.enemy.length, 0);
        continue;
      }
      assert.equal(n.enemy.length, 2, "test foes stay small");
      assert.ok(n.enemyFormation, "leader formation stored");
      formations.add(n.enemyFormation!);
      assert.equal(n.enemy.filter((e) => e.leader).length, 1);
      const lead = n.enemy.find((e) => e.leader)!;
      const leadCard = CARD_BY_ID[lead.cardId];
      assert.ok(leadCard, lead.cardId);
      assert.equal(
        n.enemyFormation,
        leadCard.formation,
        "enemy formation must match the leader card",
      );
      const form = FORMATIONS[n.enemyFormation!];
      assert.ok(form, n.enemyFormation);
      for (const e of n.enemy) {
        assert.ok(fodderIds.has(e.cardId), e.cardId);
        assert.equal(e.level, 1, "test foes stay Lv1");
        assert.ok(form.slots[e.slot], `${e.cardId} slot ${e.slot} outside ${n.enemyFormation}`);
      }
    }
    assert.ok(formations.size >= 2, "formations vary across nodes");
  });

  it("is stable for the same rank and stage", () => {
    const a = soloStage("high", 4);
    const b = soloStage("high", 4);
    assert.equal(a.nodes.map((n) => `${n.id}:${n.x}:${n.y}`).join("|"), b.nodes.map((n) => `${n.id}:${n.x}:${n.y}`).join("|"));
  });

  it("needs several wins to take a stronghold", () => {
    const map = soloStage("rookie", 1);
    const hold = map.nodes.find((n) => (n.holdNeed ?? 1) === STRONGHOLD_WINS)!;
    let captured = [map.homeId];
    let wins = {};
    for (let i = 1; i < STRONGHOLD_WINS; i++) {
      const step = applyVictory(hold, captured, wins);
      assert.equal(step.took, false);
      assert.equal(step.have, i);
      captured = step.captured;
      wins = step.holdWins;
    }
    const last = applyVictory(hold, captured, wins);
    assert.equal(last.took, true);
    assert.ok(last.captured.includes(hold.id));
  });

  it("spreads evenly with home on the west edge", () => {
    const map = soloStage("rookie", 1);
    const xs = map.nodes.map((n) => n.x);
    const ys = map.nodes.map((n) => n.y);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 40);
    assert.ok(Math.max(...ys) - Math.min(...ys) > 40);
    const home = map.byId[map.homeId];
    assert.ok(home.x < 35, `home x ${home.x}`);
    assert.ok(Math.abs(home.y - 50) < 30, `home y ${home.y}`);
  });

  it("uses one terrain per stage, with no extra rule", () => {
    const seen = [1, 2, 3, 4, 5, 6].map((stage) => soloStage("rookie", stage).field);
    assert.deepEqual(seen, SOLO_FIELDS);
    for (const rank of RANK_ORDER) {
      const fields = new Set(soloStage(rank, 1).nodes.map((n) => n.field));
      assert.equal(fields.size, 1);
    }
  });
  it("raises rank from experience, and rank raises the cost cap", () => {
    assert.equal(rankForStage(1), "rookie");
    assert.equal(rankForStage(2), "rookie");
    assert.equal(rankForStage(3), "middle");
    assert.equal(rankForStage(9), "master");
    assert.equal(rankForStage(20), "master");
    assert.equal(rankForXp(0), "rookie");
    assert.equal(rankForXp(XP_PER_CLEAR), "rookie");
    assert.equal(rankForXp(XP_PER_CLEAR * 2), "middle");
    assert.equal(costCapForRank("rookie"), 10);
    assert.ok(costCapForRank("master") > costCapForRank("rookie"));
    assert.ok(costCapForRank("ace") > costCapForRank("high"));
    assert.equal(SORTIE_SPIRIT, 1);
    assert.match(hpGaugeColor(100), /hsl\(122 /);
    assert.match(hpGaugeColor(0), /hsl\(0 /);
    const mid = hpGaugeColor(50);
    assert.match(mid, /hsl\(61 /);
  });
});

describe("war concept", () => {
  it("uses a -100 to 100 field with balanced counts", () => {
    assert.equal(warConceptBalanced(), true);
    assert.equal(WAR_CONCEPT.status, "concept");
  });
});
