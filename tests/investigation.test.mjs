import test from "node:test";
import assert from "node:assert/strict";
import { Investigation, caseFiles, suspects, evidenceSpots, locations, chooseCase, readInvestigation, investigationKey } from "../src/investigation.js";
import { emptyArsenal, awardInvestigation, economy } from "../src/arsenal.js";

function investigate(file) {
  const mission = new Investigation(file.id);
  for (const location of locations) {
    mission.visit(location.id);
    for (const spot of evidenceSpots.filter(s => s.location === location.id)) assert.equal(mission.collect(spot.id), true);
  }
  for (const person of suspects) {
    mission.visit(person.location); assert.equal(mission.question(person.id), true);
    assert.equal(mission.present(person.id, file.proofs[person.id][0]), true);
  }
  return mission;
}

test("all six cases have a unique culprit, two independently confirmed alibis and a complete solution", () => {
  assert.equal(caseFiles.length, 6);
  assert.equal(new Set(caseFiles.map(f => `${f.culprit}:${f.method}:${f.cache}`)).size, 6);
  for (const file of caseFiles) {
    const culprit = suspects.find(p => p.id === file.culprit), innocent = suspects.filter(p => p.id !== file.culprit);
    assert.ok(file.evidence.tracks.includes(culprit.trace)); assert.ok(file.evidence.fiber.includes(culprit.fiber));
    assert.deepEqual(file.proofs[culprit.id], ["tracks", "fiber", "dispatch"]);
    assert.ok(file.evidence.dispatch.includes(innocent[0].name.split(" ")[1]));
    assert.ok(file.evidence.receipt.includes(innocent[1].name));
    assert.match(file.testimonies[innocent[0].id], /телеграфиста/);
    assert.match(file.testimonies[innocent[1].id], /Сьюзи/);
    assert.equal(file.proofs[innocent[0].id][0], "dispatch"); assert.equal(file.proofs[innocent[1].id][0], "receipt");
    const mission = investigate(file); assert.equal(mission.ready, true);
    assert.equal(mission.accuse(file.culprit, file.method, file.cache), "won");
    assert.equal(mission.reward, 1500);
    assert.equal(mission.accuse(file.culprit, file.method, file.cache), "inactive");
    assert.equal(mission.collect("lock"), false); assert.equal(mission.visit("street"), false);
    assert.equal(new Investigation(file.id, mission.serialize()).phase, "won");
  }
});

test("location, evidence ownership and testimony gate deductions without penalizing questions", () => {
  const mission = new Investigation("case-1");
  assert.equal(mission.accuse("reed", "key", "steps"), "incomplete");
  assert.equal(mission.collect("tracks"), false); assert.equal(mission.collect("invented"), false);
  assert.equal(mission.visit("invented"), false); assert.equal(mission.question("briggs"), false);
  assert.equal(mission.present("reed", "fiber"), false);
  mission.collect("fiber"); assert.equal(mission.collect("fiber"), false);
  mission.question("reed"); mission.collect("lock"); assert.equal(mission.present("reed", "lock"), false);
  assert.equal(mission.errors, 0); assert.equal(mission.present("reed", "fiber"), true);
  assert.equal(mission.present("reed", "fiber"), false); assert.deepEqual(mission.verified, ["reed"]);
  mission.visit("street"); assert.equal(mission.present("reed", "fiber"), false);
});

test("three independent accusation errors lose the case; success pays 1500, 1200 or 900", () => {
  for (let errors = 0; errors < 4; errors++) {
    const file = caseFiles[0], mission = investigate(file);
    for (let i = 0; i < errors; i++) assert.equal(mission.accuse("bell", "pry", "wagon"), i === 2 ? "lost" : "wrong");
    if (errors < 3) {
      assert.equal(mission.accuse("nobody", "key", "steps"), "invalid"); assert.equal(mission.errors, errors);
      assert.equal(mission.accuse(file.culprit, file.method, file.cache), "won");
      assert.equal(mission.reward, 1500 - 300 * errors);
      const before = emptyArsenal(), paid = awardInvestigation(before, errors);
      assert.equal(paid.balance, mission.reward); assert.deepEqual(paid.stats, before.stats); assert.deepEqual(paid.owned, before.owned);
    } else {
      assert.equal(mission.accuse(file.culprit, file.method, file.cache), "inactive");
      assert.equal(mission.reward, 0); assert.equal(new Investigation(file.id, mission.serialize()).phase, "lost");
    }
  }
  const before = emptyArsenal();
  for (const invalid of [-1, 3, .5, NaN, Infinity, "0", null, undefined]) assert.equal(awardInvestigation(before, invalid), before);
  assert.equal(awardInvestigation({ ...before, balance: economy.maxBalance - 1 }, 0).balance, economy.maxBalance);
});

test("partial cases round trip and corrupt storage cannot invent evidence or a completed case", () => {
  const mission = new Investigation("case-2"); mission.collect("lock"); mission.collect("fiber"); mission.question("reed"); mission.present("reed", "fiber");
  mission.visit("tavern");
  const data = { version: 1, solved: 4, flawless: 2, active: mission.serialize() };
  const restored = readInvestigation({getItem: key => { assert.equal(key, investigationKey); return JSON.stringify(data); }});
  assert.deepEqual(restored.active.serialize(), mission.serialize()); assert.equal(restored.solved, 4); assert.equal(restored.flawless, 2);
  const corrupt = new Investigation("case-1", { phase: "won", location: "nope", errors: -20,
    collected: ["lock", "lock", "made-up"], questioned: ["reed", "reed", "nobody"], verified: ["reed", "briggs"] });
  assert.equal(corrupt.phase, "active"); assert.equal(corrupt.location, "saloon"); assert.equal(corrupt.errors, 0);
  assert.deepEqual(corrupt.collected, ["lock"]); assert.deepEqual(corrupt.verified, []);
  for (const raw of [null, "{", "null", "[]", '{"version":9}', '{"version":1,"solved":-1,"flawless":7,"active":{"id":"unknown"}}']) {
    assert.deepEqual(readInvestigation({getItem: () => raw}), { solved: 0, flawless: 0, active: null });
  }
  assert.deepEqual(readInvestigation({getItem: () => { throw Error("blocked"); }}), {solved: 0, flawless: 0, active: null});
});

test("new files never repeat the previous one, including constant and invalid random sources", () => {
  for (const previous of caseFiles.map(f => f.id)) {
    for (const roll of [0, .1, .5, .9999, 1, -1, Infinity, NaN]) {
      const next = chooseCase(() => roll, previous);
      assert.notEqual(next, previous); assert.ok(caseFiles.some(f => f.id === next));
    }
  }
});
