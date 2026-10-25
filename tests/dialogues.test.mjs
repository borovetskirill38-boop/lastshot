import { test } from "node:test";
import assert from "node:assert/strict";
import { getIntroDialogue } from "../src/dialogues.js";
import { levels } from "../src/rules.js";
import { maps } from "../src/maps.js";

test("every level and location has a short alternating conversation with the appropriate opponent", () => {
  for (const map of maps) {
    const challenges = new Set();
    for (let level = 0; level < levels.length; level++) {
      const lines = getIntroDialogue(level, map.id);
      const opponent = level === 4 ? "boss" : "bandit";
      assert.deepEqual(lines.map((line) => line.speaker), ["hero", opponent, "hero", opponent]);
      assert.equal(lines[0].name, "Шериф");
      assert.equal(lines[1].name, level === 4 ? "Главарь" : "Бандит");
      for (const line of lines) assert.ok(line.text.length > 10 && line.text.length <= 120);
      challenges.add(lines[1].text);
    }
    assert.equal(challenges.size, levels.length);
  }
  assert.equal(new Set(maps.map((map) => getIntroDialogue(0, map.id)[0].text)).size, maps.length);
});

test("unknown inputs fall back safely and a replay gets fresh conversation data", () => {
  const original = getIntroDialogue(0, "saloon");
  for (const level of [-1, 5, 0.5, NaN, "4", null]) {
    assert.deepEqual(getIntroDialogue(level, "saloon"), original);
  }
  for (const location of ["unknown", "__proto__", "toString", null]) {
    assert.deepEqual(getIntroDialogue(0, location), original);
  }
  const edited = getIntroDialogue(0, "saloon");
  edited[0].text = "changed";
  edited.pop();
  assert.deepEqual(getIntroDialogue(0, "saloon"), original);
});
