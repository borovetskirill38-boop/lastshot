import { test } from "node:test";
import assert from "node:assert/strict";
import { gunmanAnimation, gunmanPose, sampleGunmanFrame } from "../src/enemy-animation.js";

test("raising visits all 48 in-between frames then holds aim until the shot", () => {
  const frames = Array.from({ length: 48 }, (_, i) => sampleGunmanFrame(i / 47 * gunmanAnimation.raiseFraction, i * 16));
  assert.deepEqual(frames, Array.from({ length: 48 }, (_, i) => i));
  assert.equal(sampleGunmanFrame(0.95, 1000), 47);
  assert.equal(sampleGunmanFrame(1, 1100), 47);
});
test("recoil and lowering visit 48 frames and return exactly to the resting pose", () => {
  const firedAt = 1100;
  const frames = Array.from({ length: 48 }, (_, i) => sampleGunmanFrame(1, firedAt + i / 47 * 600, firedAt));
  assert.deepEqual(frames, Array.from({ length: 48 }, (_, i) => i + 48));
  assert.deepEqual(gunmanPose(47), gunmanPose(48));
  assert.deepEqual(gunmanPose(0), gunmanPose(95));
  assert.equal(sampleGunmanFrame(1, 100000, firedAt), 95);
});
test("the arm path has small bounded steps and sampling is independent of frame rate", () => {
  for (let i = 1; i < gunmanAnimation.frames; i++) {
    const a = gunmanPose(i - 1), b = gunmanPose(i);
    assert.ok(b.draw >= 0 && b.draw <= 2);
    assert.ok(b.kick >= 0 && b.kick <= 1);
    assert.ok(Math.abs(b.draw - a.draw) < .16);
    assert.ok(Math.abs(b.kick - a.kick) < .25);
  }
  const before = sampleGunmanFrame(.5, 500);
  for (let i = 0; i < 100; i++) assert.equal(sampleGunmanFrame(.5, 500), before);
  const skippedAhead = sampleGunmanFrame(1, 1550, 1100);
  assert.ok(skippedAhead > sampleGunmanFrame(1, 1200, 1100));
  assert.equal(sampleGunmanFrame(.5, 500), before);
});
