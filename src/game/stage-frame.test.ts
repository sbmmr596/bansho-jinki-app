import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DESIGN_H,
  DESIGN_W,
  fitContainScale,
  fitContainScaleRotated,
  stageFrame,
} from "./design.ts";

describe("stageFrame", () => {
  it("keeps a non-zoomed visual viewport, including keyboard offset", () => {
    const box = stageFrame({
      innerWidth: 800,
      innerHeight: 360,
      visualWidth: 800,
      visualHeight: 220,
      offsetLeft: 0,
      offsetTop: 40,
      visualScale: 1,
    });
    assert.equal(box.frameLeft, 0);
    assert.equal(box.frameTop, 40);
    assert.equal(box.frameWidth, 800);
    assert.equal(box.frameHeight, 220);
    assert.equal(box.rotate90, false);
  });

  it("does not follow a pinch pan to the top-left", () => {
    const layout = stageFrame({
      innerWidth: 800,
      innerHeight: 360,
      visualScale: 1,
    });
    const pinched = stageFrame({
      innerWidth: 800,
      innerHeight: 360,
      visualWidth: 200,
      visualHeight: 90,
      offsetLeft: 0,
      offsetTop: 0,
      visualScale: 2,
    });
    assert.equal(pinched.frameLeft, 0);
    assert.equal(pinched.frameTop, 0);
    assert.equal(pinched.frameWidth, layout.frameWidth);
    assert.equal(pinched.frameHeight, layout.frameHeight);
    assert.equal(pinched.stageLeft, layout.stageLeft);
    assert.equal(pinched.stageTop, layout.stageTop);
    assert.ok(pinched.stageLeft > 0, "landscape phone letterboxes horizontally, not pinned to x=0");
  });

  it("ignores a pinch offset that would slide the frame", () => {
    const pinched = stageFrame({
      innerWidth: 390,
      innerHeight: 844,
      visualWidth: 180,
      visualHeight: 400,
      offsetLeft: 12,
      offsetTop: 80,
      visualScale: 1.8,
    });
    assert.equal(pinched.frameLeft, 0);
    assert.equal(pinched.frameTop, 0);
    assert.equal(pinched.frameWidth, 390);
    assert.equal(pinched.frameHeight, 844);
  });

  it("pseudo landscape rotates only in portrait frames", () => {
    const phone = stageFrame({
      innerWidth: 390,
      innerHeight: 844,
      pseudoLandscape: true,
    });
    assert.equal(phone.rotate90, true);
    assert.equal(phone.scale, fitContainScaleRotated(390, 844));
    assert.equal(phone.stageLeft, 390 / 2);
    assert.equal(phone.stageTop, 844 / 2);
    assert.ok(
      phone.scale > fitContainScale(390, 844),
      "rotated fit should use more of the tall frame than upright contain",
    );

    const desk = stageFrame({
      innerWidth: 1280,
      innerHeight: 720,
      pseudoLandscape: true,
    });
    assert.equal(desk.rotate90, false);
    assert.equal(desk.scale, fitContainScale(1280, 720));
  });

  it("pseudo landscape centers within safe-area pads", () => {
    const box = stageFrame({
      innerWidth: 390,
      innerHeight: 844,
      padL: 10,
      padR: 20,
      padT: 40,
      padB: 30,
      pseudoLandscape: true,
    });
    assert.equal(box.rotate90, true);
    assert.equal(box.scale, fitContainScaleRotated(360, 774));
    assert.equal(box.stageLeft, 10 + 360 / 2);
    assert.equal(box.stageTop, 40 + 774 / 2);
    assert.ok(box.scale * DESIGN_H <= 360 + 1e-9);
    assert.ok(box.scale * DESIGN_W <= 774 + 1e-9);
  });
});
