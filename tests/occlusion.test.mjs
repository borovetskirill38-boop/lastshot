import { test } from "node:test";
import assert from "node:assert/strict";
import { pointInPolygon, occludedByCover } from "../src/occlusion.js";

const barrier = [[0, 40], [80, 40], [80, 100], [0, 100]];

test("a nearer barrier stops shots through its body while leaving the head and sides clear", () => {
  const covers = [{ depth: 100, polygon: barrier }];
  assert.equal(occludedByCover(20, 60, 60, covers), true);
  assert.equal(occludedByCover(20, 20, 60, covers), false);
  assert.equal(occludedByCover(90, 60, 60, covers), false);
});

test("equal-depth or farther furniture cannot block a closer actor", () => {
  for (const depth of [30, 60, 60 + 1e-8]) {
    assert.equal(occludedByCover(20, 60, 60, [{ depth, polygon: barrier }]), false);
  }
  assert.equal(occludedByCover(20, 60, 60, [{ depth: 60.01, polygon: barrier }]), true);
});

test("concave furniture follows its outline rather than its bounding rectangle", () => {
  const outline = [[0, 0], [100, 0], [100, 40], [40, 40], [40, 100], [0, 100]];
  for (const polygon of [outline, [...outline].reverse()]) {
    assert.equal(pointInPolygon(20, 80, polygon), true);
    assert.equal(pointInPolygon(80, 20, polygon), true);
    assert.equal(pointInPolygon(80, 80, polygon), false);
    assert.equal(occludedByCover(80, 80, 40, [{ depth: 70, polygon }]), false);
  }
});

test("horizontal, vertical and diagonal edges and vertices consistently stop shots", () => {
  for (const [x, y] of [[0, 40], [80, 100], [30, 40], [0, 70], [80, 70], [40, 100]]) {
    assert.equal(pointInPolygon(x, y, barrier), true, `${x},${y}`);
    assert.equal(occludedByCover(x, y, 60, [{ depth: 100, polygon: barrier }]), true);
  }
  const triangle = [[0, 0], [10, 0], [0, 10]];
  assert.equal(pointInPolygon(5, 5, triangle), true);
  assert.equal(pointInPolygon(5, 5.001, triangle), false);
  assert.equal(pointInPolygon(-0.01, 70, barrier), false);
});

test("only a nearer polygon actually covering the shot can obscure the target", () => {
  const covers = [
    { depth: 40, polygon: barrier },
    { depth: 120, polygon: [[200, 200], [300, 200], [300, 300], [200, 300]] },
  ];
  assert.equal(occludedByCover(20, 60, 60, covers), false);
  assert.equal(occludedByCover(20, 60, 60, [...covers, { depth: 90, polygon: barrier }]), true);
});

test("empty or malformed geometry and non-finite coordinates cannot produce a blocker", () => {
  assert.equal(occludedByCover(20, 60, 60), false);
  assert.equal(occludedByCover(20, 60, 60, []), false);
  for (const polygon of [[], [[0, 0], [80, 80]], [[0, 0], [80, 0], [NaN, 80]]]) {
    assert.equal(pointInPolygon(20, 60, polygon), false);
  }
  assert.equal(pointInPolygon(NaN, 60, barrier), false);
  assert.equal(pointInPolygon(20, Infinity, barrier), false);
  assert.equal(occludedByCover(20, 60, NaN, [{ depth: 90, polygon: barrier }]), false);
});
