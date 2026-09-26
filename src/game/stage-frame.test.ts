import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stageFrame } from "./design.ts";

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
});
