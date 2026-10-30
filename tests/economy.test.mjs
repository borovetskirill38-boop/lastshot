import { test } from "node:test";
import assert from "node:assert/strict";
import { economy, weapons, emptyArsenal, readArsenal, recordShot, selectWeapon, purchaseWeapon, nextWeapon, awardVictory, saveArsenal } from "../src/arsenal.js";
import { levels } from "../src/rules.js";

test("only an accepted enemy hit earns money; locked guns cannot be equipped or used for income", () => {
  let state = emptyArsenal();
  assert.equal(state.balance, 0);
  assert.deepEqual(state.owned, [weapons[0].id]);
  assert.equal(selectWeapon(state, weapons[1].id), state);
  assert.equal(recordShot(state, weapons[1].id, "enemy"), state);
  state = recordShot(state, weapons[0].id, "miss");
  state = recordShot(state, weapons[0].id, "civilian");
  assert.equal(state.balance, 0);
  state = recordShot(state, weapons[0].id, "enemy");
  assert.equal(state.balance, 100);
  assert.deepEqual(state.stats[weapons[0].id], { hits: 2, misses: 1, civilianHits: 1 });
});

test("sequential purchases atomically deduct the price, own and equip the gun, and never charge twice", () => {
  const initial = { ...emptyArsenal(), balance: weapons[1].price };
  Object.freeze(initial.owned); Object.freeze(initial);
  assert.equal(purchaseWeapon(initial, weapons[2].id), initial);
  assert.equal(purchaseWeapon(initial, "unknown"), initial);
  assert.equal(purchaseWeapon({ ...initial, balance: weapons[1].price - 1 }, weapons[1].id).owned.length, 1);
  const bought = purchaseWeapon(initial, weapons[1].id);
  assert.equal(bought.balance, 0);
  assert.equal(bought.selected, weapons[1].id);
  assert.deepEqual(bought.owned, [weapons[0].id, weapons[1].id]);
  assert.equal(purchaseWeapon(bought, weapons[1].id), bought);
  assert.equal(nextWeapon(bought).id, weapons[2].id);
  assert.equal(selectWeapon(bought, weapons[0].id).balance, 0);
  assert.equal(initial.balance, weapons[1].price);
});

test("a legacy save converts past bandit hits once, preserves all counters, and cannot grant unpurchased equipment", () => {
  const legacy = { version: 1, selected: weapons[2].id, stats: {
    [weapons[0].id]: { hits: 22, misses: 5, civilianHits: 2 },
    [weapons[2].id]: { hits: 3, misses: 4, civilianHits: 3 },
  } };
  const migrated = readArsenal({ getItem: () => JSON.stringify(legacy) });
  assert.equal(migrated.balance, 2000);
  assert.equal(migrated.selected, weapons[0].id);
  assert.deepEqual(migrated.stats[weapons[2].id], legacy.stats[weapons[2].id]);
  const bought = purchaseWeapon(migrated, weapons[1].id);
  let saved;
  saveArsenal({ setItem: (_, value) => { saved = value; } }, bought);
  for (let i = 0; i < 3; i++) {
    const restored = readArsenal({ getItem: () => saved });
    assert.deepEqual(restored, bought);
    assert.equal(restored.balance, 500);
  }
});

test("bad balances, broken ownership and overflow are sanitized without unlocking skipped lots", () => {
  for (const balance of [-1, 1.5, "1500", null, Infinity]) {
    const state = readArsenal({ getItem: () => JSON.stringify({ version: 2, balance,
      owned: [weapons[0].id, weapons[2].id], selected: weapons[2].id }) });
    assert.equal(state.balance, 0);
    assert.deepEqual(state.owned, [weapons[0].id]);
    assert.equal(state.selected, weapons[0].id);
  }
  let capped = { ...emptyArsenal(), balance: economy.maxBalance - 1 };
  capped = recordShot(capped, weapons[0].id, "enemy");
  capped = awardVictory(capped, 4);
  assert.equal(capped.balance, economy.maxBalance);
  assert.ok(Number.isSafeInteger(capped.balance));
  const legacy = readArsenal({ getItem: () => JSON.stringify({ version: 1,
    stats: { [weapons[0].id]: { hits: Number.MAX_SAFE_INTEGER, civilianHits: 0 } } }) });
  assert.equal(legacy.balance, economy.maxBalance);
});

test("each replay can earn its mode's clear bonus; endless and invalid modes have no clear bonus", () => {
  const state = emptyArsenal();
  for (const level of [0, -1, 6, 1.5, "1"]) assert.equal(awardVictory(state, level), state);
  for (let level = 1; level < economy.victoryBonuses.length; level++) {
    const rewarded = awardVictory(state, level);
    assert.equal(rewarded.balance, economy.victoryBonuses[level]);
    assert.equal(awardVictory(rewarded, level).balance, 2 * economy.victoryBonuses[level]);
  }
});

test("balance target: first purchase after two good runs, full collection after four five-mode circuits", () => {
  let state = emptyArsenal(), battle = 0, firstPurchase = 0, fullCollection = 0;
  for (let circuit = 0; circuit < 4; circuit++) for (let level = 0; level < levels.length; level++) {
    battle++;
    for (let hit = 0; hit < levels[level].goal; hit++) state = recordShot(state, state.selected, "enemy");
    state = awardVictory(state, level);
    while (nextWeapon(state) && state.balance >= nextWeapon(state).price) {
      state = purchaseWeapon(state, nextWeapon(state).id);
      firstPurchase ||= battle;
      if (state.owned.length === weapons.length) fullCollection = battle;
    }
  }
  assert.equal(weapons.reduce((sum, w) => sum + w.price, 0), 33000);
  assert.equal(firstPurchase, 2);
  assert.equal(fullCollection, 20);
  assert.equal(state.balance, 0);
  assert.deepEqual(state.owned, weapons.map(w => w.id));
  assert.equal(nextWeapon(state), undefined);
});
