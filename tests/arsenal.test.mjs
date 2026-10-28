import { test } from "node:test";
import assert from "node:assert/strict";
import { arsenalKey, weapons, emptyArsenal, readArsenal, recordShot, selectWeapon, saveArsenal } from "../src/arsenal.js";

test("every shot has one outcome; civilian hits are included in hits and each weapon has its own totals", () => {
  const initial = emptyArsenal();
  let state = recordShot(initial, weapons[0].id, "enemy");
  state = recordShot(state, weapons[0].id, "civilian");
  state = recordShot(state, weapons[0].id, "miss");
  state = recordShot(state, weapons[1].id, "miss");
  assert.deepEqual(state.stats[weapons[0].id], { hits: 2, misses: 1, civilianHits: 1 });
  assert.deepEqual(state.stats[weapons[1].id], { hits: 0, misses: 1, civilianHits: 0 });
  assert.deepEqual(initial, emptyArsenal());
  assert.equal(recordShot(state, "unknown", "miss"), state);
  assert.equal(recordShot(state, weapons[0].id, "unknown"), state);
});

test("selection and all counters survive storage without modifying campaign progress", () => {
  const values = new Map([["lastshot-progress", '{"unlocked":4}']]);
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  const state = selectWeapon(recordShot(emptyArsenal(), weapons[2].id, "enemy"), weapons[2].id);
  assert.equal(saveArsenal(storage, state), true);
  assert.deepEqual(readArsenal(storage), state);
  assert.equal(values.get("lastshot-progress"), '{"unlocked":4}');
  assert.equal(selectWeapon(state, "unknown"), state);
});

test("corrupt saves, unknown selection and invalid counters are sanitized per weapon", () => {
  for (const value of ["{", "null", "[]", '{"version":2}']) {
    assert.deepEqual(readArsenal({ getItem: () => value }), emptyArsenal());
  }
  const saved = { version: 1, selected: "unknown", stats: {
    [weapons[0].id]: { hits: 3, misses: -5, civilianHits: 9 },
    [weapons[1].id]: { hits: 1.5, misses: "2", civilianHits: 1 },
    [weapons[2].id]: { hits: 6, misses: 4, civilianHits: 2 },
  } };
  const clean = readArsenal({ getItem: () => JSON.stringify(saved) });
  assert.equal(clean.selected, weapons[0].id);
  assert.deepEqual(clean.stats[weapons[0].id], { hits: 3, misses: 0, civilianHits: 3 });
  assert.deepEqual(clean.stats[weapons[1].id], { hits: 0, misses: 0, civilianHits: 0 });
  assert.deepEqual(clean.stats[weapons[2].id], saved.stats[weapons[2].id]);
});

test("blocked storage and counter overflow do not break the current session", () => {
  const blocked = { getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("quota"); } };
  let state = readArsenal(blocked);
  state.stats[weapons[0].id] = { hits: Number.MAX_SAFE_INTEGER, misses: Number.MAX_SAFE_INTEGER, civilianHits: 0 };
  state = recordShot(recordShot(state, weapons[0].id, "enemy"), weapons[0].id, "miss");
  assert.equal(state.stats[weapons[0].id].hits, Number.MAX_SAFE_INTEGER);
  assert.equal(state.stats[weapons[0].id].misses, Number.MAX_SAFE_INTEGER);
  assert.equal(saveArsenal(blocked, state), false);
  assert.equal(arsenalKey, "lastshot-arsenal");
});

test("three-revolver saves gain new weapons without losing selection or existing totals", () => {
  const legacy = { version: 1, selected: "long-watch", stats: {
    "last-word": { hits: 14, misses: 5, civilianHits: 2 },
    "dust-companion": { hits: 8, misses: 3, civilianHits: 1 },
    "long-watch": { hits: 25, misses: 7, civilianHits: 0 },
  } };
  const state = readArsenal({ getItem: () => JSON.stringify(legacy) });
  assert.equal(state.selected, legacy.selected);
  for (const [id, row] of Object.entries(legacy.stats)) assert.deepEqual(state.stats[id], row);
  for (const weapon of weapons.slice(3)) {
    assert.deepEqual(state.stats[weapon.id], { hits: 0, misses: 0, civilianHits: 0 });
  }
});

test("new long guns keep separate counters and selections after a storage round trip", () => {
  let state = emptyArsenal();
  for (const weapon of weapons.slice(3)) {
    state = selectWeapon(state, weapon.id);
    state = recordShot(recordShot(recordShot(state, weapon.id, "enemy"), weapon.id, "civilian"), weapon.id, "miss");
    assert.equal(state.selected, weapon.id);
    assert.deepEqual(state.stats[weapon.id], { hits: 2, misses: 1, civilianHits: 1 });
  }
  let saved;
  saveArsenal({ setItem: (_, value) => { saved = value; } }, state);
  assert.deepEqual(readArsenal({ getItem: () => saved }), state);
  assert.deepEqual(state.stats[weapons[0].id], { hits: 0, misses: 0, civilianHits: 0 });
});
