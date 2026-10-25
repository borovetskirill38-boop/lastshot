import { test } from "node:test";
import assert from "node:assert/strict";
import { maps, readMap, hitsTarget, coverTopAt } from "../src/maps.js";

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
  assert.equal(hitsTarget(241, 238, table), false);
  assert.equal(hitsTarget(272, 238, table), true);
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
      assert.ok(position.y - 56 * position.scale >= 0);
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
    assert.equal(added.length, 2);
    for (const slot of added) for (const offset of [-30, 0, 30]) {
      const x = slot.x + offset * slot.scale;
      const edge = coverTopAt(x, slot);
      assert.ok(edge > slot.y);
      assert.equal(hitsTarget(x, edge + 3, slot), false);
      assert.equal(hitsTarget(x, slot.y, slot), true);
    }
  }
});

test("wagon and barrel cover stop bullets through the visible lower body; distance scales the hit area", () => {
  const street = maps[1];
  for (const position of [street.slots[1], street.slots[5]]) {
    assert.ok(position.coverY < position.y + 43 * position.scale);
    assert.equal(hitsTarget(position.x, position.coverY - 2, position), true);
    assert.equal(hitsTarget(position.x, position.coverY + 2, position), false);
    assert.equal(hitsTarget(NaN, position.y, position), false);
  }
  const distant = street.slots[2];
  assert.equal(hitsTarget(distant.x + 35, distant.y, distant), false);
  assert.equal(hitsTarget(distant.x + 30, distant.y, distant), true);
  // Targets constructed by existing callers retain the original geometry.
  assert.equal(hitsTarget(230, 253, { x: 230, y: 253 }), true);
});
