import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isStockSkillDesc, SKILL_KIND_DESC } from "./skillNames.ts";

describe("skill kind default desc", () => {
  it("treats empty and stock blurbs as auto-replaceable", () => {
    assert.equal(isStockSkillDesc(""), true);
    assert.equal(isStockSkillDesc("  "), true);
    assert.equal(isStockSkillDesc(SKILL_KIND_DESC.pierce), true);
    assert.equal(isStockSkillDesc(SKILL_KIND_DESC.front), true);
    assert.equal(isStockSkillDesc("独自の説明文"), false);
  });
});
