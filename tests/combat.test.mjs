import { test } from "node:test";
import assert from "node:assert/strict";
import { CoverMovement, combatTiming, playerCovers, planAttack, tickAttack } from "../src/combat.js";

test("crouching only protects after lowering; standing cannot fire until above cover", () => {
  const p = new CoverMovement();
  assert.equal(p.receive(1), "hit");
  p.stance(true, 0); p.tick(50);
  assert.equal(p.protected, false); assert.equal(p.canShoot, false);
  p.tick(200); assert.equal(p.receive(1), "cover");
  p.stance(false, 200); assert.equal(p.canShoot, false);
  p.tick(400); assert.equal(p.canShoot, true); assert.equal(p.receive(1), "hit");
});
test("moving between covers exposes a crouched sheriff; changing lane dodges a locked aim", () => {
  const p = new CoverMovement(); p.stance(true, 0); p.tick(200);
  assert.equal(p.move(-1, 200), true); p.tick(200 + combatTiming.move / 2);
  assert.equal(p.protected, false); assert.equal(p.receive(1), "hit");
  assert.equal(p.move(-1, 200 + combatTiming.move / 2), false);
  p.tick(200 + combatTiming.move); assert.equal(p.protected, true); assert.equal(p.lane, 0);
  assert.equal(p.receive(1), "dodge"); // A locked shot cannot follow us into another cover.
  assert.equal(p.receive(0), "cover");
  p.stance(false, 200 + combatTiming.move); p.tick(400 + combatTiming.move);
  assert.equal(p.receive(1), "dodge"); assert.equal(p.receive(0), "hit");
  assert.equal(p.move(-1, 400 + combatTiming.move), false);
});
test("warnings last a full reaction interval even after a delayed first update; a gun fires once", () => {
  const a = planAttack(0);
  assert.equal(tickAttack(a, 250, 1), null);
  assert.equal(tickAttack(a, 9000, 1), "aim");
  assert.equal(a.fireAt, 9000 + combatTiming.warning);
  assert.equal(tickAttack(a, a.fireAt - 1, 0), null);
  assert.equal(a.lane, 1);
  assert.equal(tickAttack(a, a.fireAt, 0), "fire");
  assert.equal(tickAttack(a, 99999, 0), null);
});
test("all three maps offer three named covers with map-specific furniture", () => {
  for (const covers of Object.values(playerCovers)) {
    assert.equal(covers.length, 3); assert.equal(new Set(covers.map(c => c.name)).size, 3);
  }
  assert.ok(playerCovers.saloon.some(c => c.frame === "barrels"));
  assert.ok(playerCovers.street.some(c => c.frame === "wagon"));
  assert.ok(playerCovers.tavern.some(c => c.frame === "table"));
});
