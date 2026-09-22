import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/game/design.ts"), "utf8");

const wMatch = src.match(/export const DESIGN_W = (\d+);/);
const hMatch = src.match(/export const DESIGN_H = (\d+);/);
assert.ok(wMatch && hMatch, "DESIGN_W/H not found");
const DESIGN_W = Number(wMatch[1]);
const DESIGN_H = Number(hMatch[1]);

const fnMatch = src.match(
  /export function fitContainScale\(availW: number, availH: number\): number \{([\s\S]*?)\n\}/,
);
assert.ok(fnMatch, "fitContainScale not found");
const fitContainScale = new Function(
  "DESIGN_W",
  "DESIGN_H",
  `return function fitContainScale(availW, availH) {${fnMatch[1]}}`,
)(DESIGN_W, DESIGN_H);

describe("fitContainScale", () => {
  it("is exported and documents no max of 1", () => {
    assert.equal(DESIGN_W, 1280);
    assert.equal(DESIGN_H, 720);
    assert.match(src, /no max of 1/i);
  });

  it("upscales on 1080p (no artificial max of 1)", () => {
    assert.equal(fitContainScale(1920, 1080), 1.5);
  });

  it("upscales on 1440p", () => {
    assert.equal(fitContainScale(2560, 1440), 2);
  });

  it("downscales on phone landscape", () => {
    const s = fitContainScale(844, 390);
    assert.ok(s < 1);
    assert.equal(s, Math.min(844 / DESIGN_W, 390 / DESIGN_H));
  });

  it("fills the shorter side on non-16:9 (letterbox the rest)", () => {
    const s = fitContainScale(1180, 820);
    assert.equal(s, 1180 / DESIGN_W);
    assert.ok(DESIGN_H * s < 820);
  });

  it("never exceeds either available dimension", () => {
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
      [2560, 1080],
      [1, 1],
    ]) {
      const s = fitContainScale(w, h);
      assert.ok(DESIGN_W * s <= w + 1e-9);
      assert.ok(DESIGN_H * s <= h + 1e-9);
    }
  });

  it("GameApp uses fitContainScale (no inline capped Math.min)", () => {
    const app = readFileSync(join(root, "src/components/game/GameApp.tsx"), "utf8");
    assert.match(app, /fitContainScale\(/);
    assert.doesNotMatch(app, /Math\.min\(\s*aw\s*\/\s*DESIGN_W/);
  });
});
