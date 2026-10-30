import { test } from "node:test";
import assert from "node:assert/strict";
import { createRelayBoard, signalPath, turnContact, TelegraphMission, telegraphMode,
  readTelegraphRecord, recordTelegraphWin, formatRelayTime } from "../src/telegraph.js";
import { getIntroDialogue } from "../src/dialogues.js";
import { solveRelay, turnsFor } from "./relay-solver.mjs";

function solve(mission, station, now) {
  const board = mission.boards[station], solution = solveRelay(board);
  assert.ok(solution, "generated board must be independently solvable");
  for (const { cell, mask } of solution) {
    const turns = turnsFor(board.tiles[cell], mask);
    for (let i = 0; i < turns; i++) assert.equal(mission.turn(station, cell, now), true);
  }
  assert.equal(signalPath(board).connected, true);
}

test("fresh boards always start disconnected and an independent search can solve all random and degenerate variants", () => {
  let seed = 1;
  const seeded = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 2 ** 32);
  for (const random of [() => 0, () => .5, () => .99999, () => NaN, () => -1, seeded]) {
    for (let i = 0; i < 40; i++) {
      const board = createRelayBoard(random, i % 3);
      assert.equal(board.tiles.length, 16); assert.equal(signalPath(board).connected, false);
      const solution = solveRelay(board); assert.ok(solution);
      for (const { cell, mask } of solution) board.tiles[cell] = mask;
      assert.equal(signalPath(board).connected, true);
    }
  }
  const variants = new TelegraphMission(() => 0).boards.map(board => `${board.entry}:${board.exit}:${board.tiles}`);
  assert.equal(new Set(variants).size, 3);
});

test("connectivity checks reciprocal ports and both terminals, not visual proximity or wrapped rows", () => {
  const board = { entry: 1, exit: 1, tiles: Array(16).fill(5) };
  for (const cell of [4, 5, 6, 7]) board.tiles[cell] = 10;
  assert.deepEqual(signalPath(board), { connected: true, powered: [4, 5, 6, 7] });
  board.tiles[5] = 5; assert.equal(signalPath(board).connected, false);
  board.tiles[5] = 10; board.exit = 2; assert.equal(signalPath(board).connected, false);
  board.entry = 0; board.exit = 1; board.tiles[0] = 6; assert.equal(signalPath(board).connected, false);
  for (const invalid of [null, {}, { ...board, tiles: [] }, { ...board, entry: 4 }, { ...board, tiles: Array(16).fill(15) }]) {
    assert.deepEqual(signalPath(invalid), { connected: false, powered: [] });
  }
  for (const mask of [3, 6, 9, 12, 5, 10]) {
    let value = mask; for (let i = 0; i < 4; i++) value = turnContact(value);
    assert.equal(value, mask);
  }
});

test("all three circuits, not kills, win; confirmed circuits cannot be edited or credited again", () => {
  const m = new TelegraphMission(() => .5);
  assert.equal(m.turn(0, 0, 0), false); assert.equal(m.connect(0, 0), false);
  m.start(1000); m.start(9999); assert.equal(m.deadline, 121000);
  for (const [index, station] of [1, 0, 2].entries()) {
    assert.equal(m.connect(station, 2000), false);
    solve(m, station, 2000 + index * 1000);
    assert.equal(m.connect(station, 2000 + index * 1000), true);
    assert.equal(m.restored, index + 1);
    assert.equal(m.connect(station, 4000), false);
    assert.equal(m.turn(station, 0, 4000), false);
  }
  assert.equal(m.phase, "won"); assert.equal(m.elapsed, 3000);
  assert.equal(m.tick(999999), null); assert.equal(m.remaining(999999), 117000);
});

test("the clock starts after dialogue, uses only supplied scene time, and timeout wins a deadline race", () => {
  const m = new TelegraphMission(() => .5);
  assert.equal(m.remaining(999999), telegraphMode.duration);
  m.start(200); const frozen = m.remaining(900);
  assert.equal(m.remaining(900), frozen);
  assert.equal(m.tick(m.deadline - 1), null);
  assert.equal(m.tick(m.deadline), "timeout"); assert.equal(m.remaining(m.deadline + 999), 0);
  assert.equal(m.connect(0, m.deadline), false); assert.equal(m.turn(0, 0, m.deadline), false);
  assert.equal(m.tick(m.deadline + 9999), null);
  const fresh = new TelegraphMission(); assert.equal(fresh.phase, "ready"); assert.equal(fresh.restored, 0);
  fresh.start(100); fresh.stop(1100);
  assert.equal(fresh.remaining(999999), telegraphMode.duration - 1000);
  assert.equal(fresh.turn(0, 0, 1200), false);
});

test("invalid actions cannot alter another cell or station; work survives closing and revisiting a board", () => {
  const m = new TelegraphMission(); m.start(0);
  const before = JSON.stringify(m.boards);
  for (const station of [-1, 3, NaN, "1"]) assert.equal(m.turn(station, 0, 1), false);
  for (const cell of [-1, 16, 1.5, NaN, "2"]) assert.equal(m.turn(0, cell, 1), false);
  assert.equal(JSON.stringify(m.boards), before);
  const old = m.boards[0].tiles[0]; m.turn(0, 0, 1);
  assert.equal(m.boards[0].tiles[0], turnContact(old));
  m.turn(1, 2, 1000); assert.equal(m.boards[0].tiles[0], turnContact(old));
});

test("independent time records sanitize storage and never replace a faster run with a slower one", () => {
  for (const data of ["{", "null", '{"wins":-1,"bestMs":-1}']) {
    assert.deepEqual(readTelegraphRecord({ getItem: () => data }), { wins: 0, bestMs: null });
  }
  let record = recordTelegraphWin({ wins: 0, bestMs: null }, 50000);
  record = recordTelegraphWin(record, 60000); record = recordTelegraphWin(record, 40000);
  assert.deepEqual(record, { wins: 3, bestMs: 40000 });
  for (const elapsed of [0, -1, NaN, Infinity, telegraphMode.duration]) assert.equal(recordTelegraphWin(record, elapsed), record);
  assert.equal(formatRelayTime(120000), "2:00"); assert.equal(formatRelayTime(1), "0:01");
  assert.equal(formatRelayTime(0), "0:00");
  const lines = getIntroDialogue(5, "tavern");
  assert.equal(lines.length, 4); assert.ok(lines.some(line => /коммутатора/.test(line.text)));
});
