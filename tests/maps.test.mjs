import { test } from "node:test";
import assert from "node:assert/strict";
import { maps, readMap, hitsTarget, coverTopAt } from "../src/maps.js";
import { mapProps } from "../src/props.js";

test("saved location is validated, including unavailable storage", () => {
  for (const map of maps) assert.equal(readMap({ getItem: () => map.id }), map);
  for (const value of [null, "", "unknown", "__proto__"]) {
    assert.equal(readMap({ getItem: () => value }), maps[0]);
  }
  assert.equal(readMap({ getItem() { throw Error("denied"); } }), maps[0]);
});

test("curved table and slanted bar cover protect exactly the drawn upper edge", () => {
  const tavern = maps.find((map) => map.id === "tavern");
  const table = tavern.slots[1];
  assert.ok(coverTopAt(241, table) < coverTopAt(272, table));
  for (const target of tavern.slots) {
    const top = coverTopAt(target.x, target);
    assert.equal(hitsTarget(target.x, top + 2, target), false);
    assert.equal(hitsTarget(target.x, Math.min(target.y, top - 2), target), true);
  }
});

test("all spawn positions have visible hit areas inside the world and distinct target centers", () => {
  assert.equal(new Set(maps.map((map) => map.id)).size, maps.length);
  for (const map of maps) {
    assert.equal(map.slots.length, map.id === "saloon" ? 6 : 8);
    for (const position of map.slots) {
      assert.ok(position.x - 40 * position.scale >= 0);
      assert.ok(position.x + 40 * position.scale <= 960);
      assert.ok(position.bodyY - 56 * position.scale >= 0);
      assert.ok(position.coverY > position.y && position.coverY < 540);
      assert.equal(hitsTarget(position.x, position.y, position), true);
    }
    for (const position of map.slots) {
      assert.equal(map.slots.filter((slot) => hitsTarget(position.x, position.y, slot)).length, 1);
    }
  }
});

test("new obstacle edges protect the waist while leaving separate visible firing targets", () => {
  for (const map of maps.filter((map) => map.id !== "saloon")) {
    const added = map.slots.filter((slot) => slot.prop);
    assert.ok(added.length >= 2);
    for (const slot of added) for (const offset of [-30, 0, 30]) {
      const x = slot.x + offset * slot.scale;
      const edge = coverTopAt(x, slot);
      assert.ok(edge > slot.y);
      assert.equal(hitsTarget(x, edge + 3, slot), false);
      assert.equal(hitsTarget(x, slot.y, slot), true);
    }
  }
});

test("active cover can conceal an adult, and distant adults are smaller in every painting", () => {
  for (const map of maps) {
    for (const slot of map.slots) {
      assert.ok(slot.coverHeightM >= 0.75, `${map.id} cover at ${slot.x} is too low to conceal a person`);
      assert.ok(slot.coverHeightM < 1.8, `${map.id} cover at ${slot.x} conceals the whole adult`);
      assert.ok(slot.personHeightPx > 0 && slot.personHeightPx < 540);
      assert.ok(Number.isFinite(slot.distanceM) && slot.distanceM > 0);
    }
    const sorted = [...map.slots].sort((a, b) => a.distanceM - b.distanceM);
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(sorted[i].scale <= sorted[i - 1].scale + 1e-9,
        `${map.id}: a farther actor must not grow`);
    }
  }
});

test("saloon adults share one facade scale and its window sills stand above each floor", () => {
  const saloon = maps.find((map) => map.id === "saloon");
  const upper = saloon.slots.filter((slot) => slot.floorElevationM > 0);
  const lower = saloon.slots.filter((slot) => slot.floorElevationM === 0);
  assert.equal(upper.length, 3);
  assert.equal(lower.length, 3);
  for (const slot of saloon.slots) {
    assert.ok(Math.abs(slot.scale - lower[0].scale) < 1e-9);
    assert.ok(Math.abs(slot.distanceM - lower[0].distanceM) < 1e-9);
    assert.ok(slot.personHeightPx < (lower[0].groundY - upper[0].groundY) * 0.8,
      "a full adult must fit comfortably within one floor of the two-storey building");
    assert.ok(slot.groundY - slot.coverY >= slot.personHeightPx * 0.4,
      "the opening must have a substantial wall or doors beneath its sill");
  }
});

test("low trough and chest remain scenery while active supplies provide taller concealment", () => {
  for (const [id, decorativeFrame] of [["street", "trough"], ["tavern", "chest"]]) {
    const map = maps.find((map) => map.id === id);
    const decorative = mapProps[id].filter((prop) => prop.frame === decorativeFrame);
    assert.ok(decorative.length > 0);
    for (const prop of decorative) {
      assert.ok(!map.slots.some((slot) => slot.prop === prop.id));
      assert.ok(!prop.slot);
    }
    assert.ok(map.slots.filter((slot) => slot.prop).length >= 2);
  }
});

test("wagon and barrel cover stop bullets through the visible lower body; distance scales the hit area", () => {
  const street = maps[1];
  for (const position of [street.slots[1], street.slots[5]]) {
    assert.ok(position.coverY < position.bodyY + 43 * position.scale);
    assert.equal(hitsTarget(position.x, position.coverY - 2, position), true);
    assert.equal(hitsTarget(position.x, position.coverY + 2, position), false);
    assert.equal(hitsTarget(NaN, position.y, position), false);
  }
  const distant = street.slots[2];
  assert.equal(hitsTarget(distant.x + 45 * distant.scale, distant.y, distant), false);
  assert.equal(hitsTarget(distant.x + 20 * distant.scale, distant.y, distant), true);
  // Targets constructed by existing callers retain the original geometry.
  assert.equal(hitsTarget(230, 253, { x: 230, y: 253 }), true);
});
