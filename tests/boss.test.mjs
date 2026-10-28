import { test } from "node:test";
import assert from "node:assert/strict";
import { BossEncounter, bossTiming } from "../src/boss.js";
import { maps, coverTopAt } from "../src/maps.js";

function expose(encounter) {
  for (let i = 0; i < 5 && encounter.phase !== "exposed"; i++) encounter.tick(encounter.nextAt);
  assert.equal(encounter.phase, "exposed");
}

test("every map uses multiple valid cover positions without consecutive repeats, even with constant random input", () => {
  for (const map of maps) for (const roll of [0, 0.99, 1, NaN]) {
    const boss = new BossEncounter(map.slots, 0, () => roll);
    let previous = -1;
    const visited = new Set();
    for (let i = 0; i < 20; i++) {
      while (boss.phase !== "hidden") boss.tick(boss.nextAt);
      boss.tick(boss.nextAt);
      assert.notEqual(boss.index, previous);
      assert.equal(boss.position, map.slots[boss.index]);
      visited.add(boss.index);
      previous = boss.index;
    }
    assert.equal(visited.size, map.slots.length);
  }
});

test("hostage phase blocks every part of the pair, preserves HP and allows safe waiting", () => {
  const boss = new BossEncounter(maps[0].slots, 0, () => 0);
  assert.equal(boss.tick(bossTiming.first - 1), null);
  assert.equal(boss.tick(bossTiming.first), "appeared");
  assert.equal(boss.phase, "hostage");
  const p = boss.position;
  for (const [x, y] of [[p.x, p.y], [p.x - 30 * p.scale, p.y], [p.x + 30 * p.scale, p.y]]) {
    assert.equal(boss.fire(x, y, bossTiming.first), "hostage");
    assert.equal(boss.hp, 6);
  }
  assert.equal(boss.fire(20, 20, bossTiming.first), "miss");
  assert.equal(boss.tick(boss.nextAt), "retreated");
  assert.equal(boss.phase, "hidden");
  assert.equal(boss.hp, 6);
});

test("each appearance rolls its own pose, allowing either first pose and consecutive repeats", () => {
  for (const map of maps) {
    const rolls = [0.8, 0.5, 0.1, 0.49, 0.9, 0];
    const randomValues = rolls.flatMap((roll) => [0.35, roll]);
    const boss = new BossEncounter(map.slots, 0, () => {
      assert.ok(randomValues.length > 0);
      return randomValues.shift();
    });
    const phases = [];
    for (const roll of rolls) {
      const appearedAt = boss.nextAt;
      assert.equal(boss.tick(appearedAt), "appeared");
      phases.push(boss.phase);
      assert.equal(boss.nextAt, appearedAt + bossTiming[boss.phase]);
      assert.equal(boss.phase, roll < 0.5 ? "hostage" : "exposed");
      assert.equal(boss.tick(boss.nextAt), roll < 0.5 ? "retreated" : "attack");
    }
    assert.deepEqual(phases, ["exposed", "exposed", "hostage", "hostage", "exposed", "hostage"]);
    assert.equal(randomValues.length, 0);
  }
});

test("only exposed hits damage the boss; one wound causes retreat and six wounds rescue Suzzie", () => {
  for (const map of maps) {
    const boss = new BossEncounter(map.slots, 0, () => 0.6);
    assert.equal(boss.fire(boss.position.x, boss.position.y, 0), "miss");
    for (let hit = 1; hit <= 6; hit++) {
      expose(boss);
      const p = boss.position;
      const now = boss.nextAt - 1;
      assert.equal(boss.fire(p.x, coverTopAt(p.x, p) + 2, now), "miss");
      assert.equal(boss.fire(p.x, p.y, now), hit === 6 ? "defeated" : "hit");
      assert.equal(boss.hp, 6 - hit);
      assert.equal(boss.fire(p.x, p.y, now), "miss");
    }
    assert.equal(boss.phase, "defeated");
    assert.equal(boss.tick(Infinity), null);
  }
});

test("missing an exposed attack window costs one life event; a delayed frame cannot stack attacks", () => {
  const boss = new BossEncounter(maps[0].slots, 0, () => 0.6);
  expose(boss);
  assert.equal(boss.tick(boss.nextAt - 1), null);
  assert.equal(boss.tick(boss.nextAt + 10000), "attack");
  assert.equal(boss.phase, "hidden");
  assert.equal(boss.tick(boss.nextAt - 1), null);
  assert.equal(boss.hp, 6);
});
