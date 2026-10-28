import { test } from "node:test";
import assert from "node:assert/strict";
import { hitsWood } from "../src/surfaces.js";
import { maps } from "../src/maps.js";
const slots = maps[0].slots;
test("visible wood: facade, frame, shutter, sign, porch, barrel and crate", () => {
  for (const [x, y] of [
    [600, 270],
    [177, 253],
    [158, 253],
    [480, 90],
    [450, 470],
    [53, 430],
    [900, 420],
    [450, 500],
    [350, 450],
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

test("street wood matches cover and facades, with silent open doorways, dirt and sky", () => {
  const street = maps[1];
  for (const [x, y] of [[241, 315], [528, 319], [728, 380], [200, 200], [900, 210]]) {
    assert.equal(hitsWood(x, y, street.slots, "street"), true, `${x},${y}`);
  }
  for (const [x, y] of [[480, 100], [500, 500], [80, 180], [870, 180], [-1, 200], [NaN, 200]]) {
    assert.equal(hitsWood(x, y, street.slots, "street"), false, `${x},${y}`);
  }
  assert.equal(hitsWood(728, 340, street.slots, "street"), true);
});

test("added street and tavern obstacles make wooden impacts below their cover edges", () => {
  for (const map of maps.filter((map) => map.id !== "saloon")) {
    for (const slot of map.slots.filter((slot) => slot.prop)) {
      assert.equal(hitsWood(slot.x, slot.coverY + 8, map.slots, map.id), true);
    }
  }
});

test("tavern furniture and planks sound wooden; glass, rugs and dark passage do not", () => {
  const tavern = maps.find((map) => map.id === "tavern");
  for (const [x, y] of [[700, 270], [241, 320], [365, 280], [475, 240], [151, 260], [480, 420], [360, 120]]) {
    assert.equal(hitsWood(x, y, tavern.slots, "tavern"), true, `${x},${y}`);
  }
  for (const [x, y] of [[130, 150], [900, 100], [480, 180], [50, 350], [-1, 200], [NaN, 200]]) {
    assert.equal(hitsWood(x, y, tavern.slots, "tavern"), false, `${x},${y}`);
  }
});
