import { test } from "node:test";
import assert from "node:assert/strict";
import { getIntroDialogue } from "../src/dialogues.js";
import { levels } from "../src/rules.js";
import { maps } from "../src/maps.js";

test("every mode has short character lines and the boss conversation includes Suzie's calls for help", () => {
  for (const map of maps) {
    const challenges = new Set();
    for (let level = 0; level < levels.length; level++) {
      const lines = getIntroDialogue(level, map.id);
      const speakers = level === 4 ? ["hero", "boss", "hostage", "hero", "boss", "hostage", "hero"]
        : ["hero", "bandit", "hero", "bandit"];
      assert.deepEqual(lines.map((line) => line.speaker), speakers);
      assert.equal(lines[0].name, "Шериф Картер");
      assert.equal(lines[1].name, level === 4 ? "Билли Пуля" : "Бандит");
      for (const line of lines) assert.ok(line.text.length > 10 && line.text.length <= 120);
      challenges.add(lines[1].text);
      if (level === 4) {
        assert.ok(lines.filter((line) => line.name === "Сьюзи").length >= 2);
        assert.ok(lines.some((line) => /Помоги|спаси/.test(line.text)));
      }
    }
    assert.equal(challenges.size, levels.length);
  }
  assert.equal(new Set(maps.map((map) => getIntroDialogue(0, map.id)[0].text)).size, maps.length);
});

test("unknown inputs fall back safely and a replay gets fresh conversation data", () => {
  const original = getIntroDialogue(0, "saloon");
  for (const level of [-1, 6, 0.5, NaN, "4", null]) {
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
