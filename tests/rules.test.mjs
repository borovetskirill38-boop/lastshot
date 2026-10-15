import { test } from "node:test";
import assert from "node:assert/strict";
import { readProgress, recordWin, levels } from "../src/rules.js";
test("first win unlocks second level and survives storage reload", () => {
  let value = null;
  const storage = {
    getItem: () => value,
    setItem: (_, v) => {
      value = v;
    },
  };
  const p = recordWin(readProgress(storage), 0, 800);
  storage.setItem("", JSON.stringify(p));
  assert.equal(readProgress(storage).unlocked, 2);
  assert.equal(readProgress(storage).best[0], 800);
});
test("corrupt and out-of-range saves are safe", () => {
  assert.equal(readProgress({ getItem: () => "{" }).unlocked, 1);
  assert.equal(readProgress({ getItem: () => '{"unlocked":99}' }).unlocked, 5);
});
test("replays preserve unlocks and best score; final win stays in campaign", () => {
  const p = { unlocked: 5, best: [800, 0, 0, 0, 0] };
  assert.deepEqual(recordWin(p, 0, 100), p);
  assert.equal(recordWin(p, 4, 600).unlocked, 5);
  assert.deepEqual(
    levels.map((l) => l.goal),
    [8, 12, 16, 18, 6],
  );
});
