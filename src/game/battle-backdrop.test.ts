import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BACKDROP_ART,
  BACKDROP_H,
  BATTLE_FIELD_SRC,
  HORIZON_TARGET,
  MAX_ZOOM,
  backdropLayout,
} from "./battle-backdrop.ts";

describe("battle backdrop", () => {
  it("has horizon data for every battle background", () => {
    for (const src of Object.values(BATTLE_FIELD_SRC)) {
      assert.ok(BACKDROP_ART[src], src);
    }
  });

  it("lifts the ground line above the top row of units", () => {
    for (const [src, art] of Object.entries(BACKDROP_ART)) {
      const l = backdropLayout(art);
      assert.equal(l.horizonY, BACKDROP_H * HORIZON_TARGET);
      // Top-row feet sit near 35% of the stage; ground must start above that.
      assert.ok(l.horizonY < BACKDROP_H * 0.3, src);
      // Horizon was lower than the target in every original.
      assert.ok(art.horizon > HORIZON_TARGET, src);
      assert.ok(l.zoom >= 1 && l.zoom <= MAX_ZOOM, `${src} zoom ${l.zoom}`);
      assert.ok(l.stretch >= 0.999 && l.stretch < 2, `${src} stretch ${l.stretch}`);
      // Sky band keeps its aspect (cropped, never squashed).
      const skyScale = l.horizonY / l.sky.h;
      const xScale = 1280 / l.sky.w;
      assert.ok(Math.abs(skyScale - xScale) < 1e-6, `${src} sky aspect`);
      // Bands meet exactly at the source horizon.
      assert.ok(Math.abs(l.sky.y + l.sky.h - l.ground.y) < 1e-6, `${src} seam`);
      assert.ok(l.sky.y >= 0 && l.ground.y + l.ground.h <= art.h + 1e-6);
    }
  });
});
