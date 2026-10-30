import { test } from "node:test";
import assert from "node:assert/strict";
import { coverAnchor, coverFrames, coverWorldView, projectPlayerCover, coverCamera } from "../src/cover-geometry.js";
import { playerCovers } from "../src/combat.js";

test("isolated full silhouettes do not include pixels from a neighbouring prop", () => {
  const frames = Object.values(coverFrames);
  for (const [index, [x, y, w, h]] of frames.entries()) {
    assert.ok(x > 0 && y > 0 && x + w < 1312 && y + h < 1199);
    for (const [otherIndex, other] of frames.entries()) {
      if (otherIndex === index) continue;
      const [ox, oy, ow, oh] = other;
      assert.ok(x + w < ox || ox + ow < x || y + h < oy || oy + oh < y);
    }
  }
});

test("all nine cover anchors are immutable, floor-standing and proportionate", () => {
  for (const [map, covers] of Object.entries(playerCovers)) for (const [lane, cover] of covers.entries()) {
    const anchor = coverAnchor(map, cover.frame, lane);
    assert.ok(Object.isFrozen(anchor));
    assert.ok(anchor.heightM > 1.25 && anchor.heightM < 1.35);
    assert.ok(anchor.z > 3 && anchor.z < coverCamera.backdropDistanceM);
    const p = projectPlayerCover(map, anchor, 1);
    assert.ok(p.groundY > 480 && p.groundY < 530);
    const [, , w, h] = coverFrames[cover.frame];
    assert.ok(Math.abs(p.width / p.height - w / h) < 1e-8);
  }
});

test("camera motion preserves contact with the painting's floor and never zooms on crouch", () => {
  for (const position of [0, .25, .5, 1, 1.5, 2]) {
    const standing = coverWorldView(position, 0), crouching = coverWorldView(position, 1);
    assert.equal(standing.zoom, crouching.zoom);
    assert.equal(standing.x, crouching.x);
    assert.ok(crouching.y < standing.y);
    for (const view of [standing, crouching]) {
      assert.ok(view.x <= 0 && view.y <= 0);
      assert.ok(view.x + 960 * view.zoom >= 960);
      assert.ok(view.y + 540 * view.zoom >= 540);
    }
  }
});

test("depth controls lateral parallax; a fixed cover returns to the exact same ground anchor", () => {
  for (const [map, covers] of Object.entries(playerCovers)) for (const [lane, cover] of covers.entries()) {
    const anchor = coverAnchor(map, cover.frame, lane);
    const middle = projectPlayerCover(map, anchor, 1);
    const side = projectPlayerCover(map, anchor, 0);
    assert.equal(middle.groundY, side.groundY);
    assert.equal(middle.width, side.width); assert.equal(middle.height, side.height);
    assert.ok(side.x > middle.x);
    const own = projectPlayerCover(map, anchor, lane), camera = coverWorldView(lane, 0);
    assert.ok(Math.abs(own.x * camera.zoom + camera.x - 480) < 1e-8);
    assert.deepEqual(projectPlayerCover(map, anchor, 1), middle);
  }
});
