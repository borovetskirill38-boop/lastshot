import { test } from "node:test";
import assert from "node:assert/strict";
import { hitsWood } from "../src/surfaces.js";
const slots = [
  { x: 230, y: 253 },
  { x: 480, y: 253 },
  { x: 730, y: 253 },
  { x: 230, y: 405 },
  { x: 480, y: 405 },
  { x: 730, y: 405 },
];
test("visible wood: facade, frame, shutter, sign, porch, barrel and crate", () => {
  for (const [x, y] of [
    [600, 320],
    [177, 253],
    [158, 253],
    [480, 90],
    [450, 470],
    [53, 430],
    [35, 480],
  ])
    assert.equal(hitsWood(x, y, slots), true, `${x},${y}`);
});
test("open windows and sky have no wood sound", () => {
  for (const s of slots) assert.equal(hitsWood(s.x, s.y, slots), false);
  for (const [x, y] of [
    [30, 30],
    [910, 100],
    [450, 520],
    [-1, 200],
    [NaN, 200],
  ])
    assert.equal(hitsWood(x, y, slots), false, `${x},${y}`);
});
