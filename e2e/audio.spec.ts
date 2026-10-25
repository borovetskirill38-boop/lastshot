import { skipIntro } from "./helpers";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

test("recordings decode, produce an audio signal, and obey mute and voice limits", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Переключить звук" }).click();
  await expect(page.locator("#sound")).toHaveText("Звук: вкл.");
  const result = await page.evaluate(async () => {
    const { gameAudio } = await import("/src/main.ts");
    gameAudio.setMenu(false);
    const a = gameAudio as any;
    const buffers = [...a.buffers.entries()] as [string, AudioBuffer][];
    const summaries = buffers.map(([name, b]) => {
      const data = b.getChannelData(0);
      let peak = 0,
        energy = 0;
      for (const value of data) {
        peak = Math.max(peak, Math.abs(value));
        energy += value * value;
      }
      return {
        name,
        duration: b.duration,
        peak,
        rms: Math.sqrt(energy / data.length),
      };
    });
    const analyser = a.context.createAnalyser() as AnalyserNode;
    analyser.fftSize = 2048;
    a.master.connect(analyser);
    const waveform = new Float32Array(analyser.fftSize);
    let signal = 0;
    gameAudio.play("shot");
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 10));
      analyser.getFloatTimeDomainData(waveform);
      for (const value of waveform) signal = Math.max(signal, Math.abs(value));
    }
    a.master.disconnect(analyser);
    analyser.disconnect();
    for (let i = 0; i < 40; i++) gameAudio.play("pain");
    const active = gameAudio.state.active;
    await gameAudio.setEnabled(false);
    gameAudio.play("shot");
    return { summaries, signal, active, muted: gameAudio.state };
  });
  expect(result.summaries).toHaveLength(10);
  for (const b of result.summaries) {
    expect(b.duration).toBeGreaterThan(b.name === "hover" ? 0.06 : 0.18);
    expect(b.duration).toBeLessThan(60);
    expect(b.peak).toBeGreaterThan(0.005);
    expect(b.peak).toBeLessThan(1);
    expect(b.rms).toBeGreaterThan(0.001);
  }
  expect(
    result.summaries.find((b) => b.name === "menuMusic")!.duration,
  ).toBeGreaterThan(50);
  expect(result.signal).toBeGreaterThan(0.001);
  expect(result.active).toBeLessThanOrEqual(18);
  expect(result.muted.active).toBe(0);
  expect(result.muted.enabled).toBe(false);
  expect(result.muted.failed).toBe(false);
  expect(errors).toEqual([]);
});

test("hits route to the right material and reload audio pauses, resumes and cancels", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "lastshot-progress",
      JSON.stringify({ unlocked: 5, best: [] }),
    ),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Переключить звук" }).click();
  await expect(page.locator("#sound")).toHaveText("Звук: вкл.");
  await page.getByRole("button", { name: /02.*Мирные жители/ }).click();
  await skipIntro(page);
  const sounds = await page.evaluate(async () => {
    const { game, gameAudio } = await import("/src/main.ts");
    const s = game.scene.getScene("town") as any;
    for (const t of s.targets) t.view.destroy();
    s.targets = [];
    s.nextSpawn = Infinity;
    const events: string[] = [];
    const original = gameAudio.play.bind(gameAudio);
    gameAudio.play = (kind, pan) => {
      events.push(kind);
      original(kind, pan);
    };
    const run = (x: number, y: number) => {
      events.length = 0;
      s.shoot(x, y);
      return [...events];
    };
    const target = (civilian: boolean) =>
      s.targets.push({
        x: 230,
        y: 253,
        slot: 0,
        civilian,
        view: s.person(230, 253, civilian),
        expires: s.clock + 10000,
      });
    target(false);
    const enemy = run(230, 253),
      wood = run(600, 320),
      window = run(480, 253),
      sky = run(30, 30);
    target(true);
    const civilian = run(230, 253);
    gameAudio.stop();
    events.length = 0;
    s.reload();
    s.togglePause();
    return {
      enemy,
      wood,
      window,
      sky,
      civilian,
      reload: [...events],
      lives: s.lives,
    };
  });
  expect(sounds.enemy).toEqual(["shot", "banditDeath"]);
  expect(sounds.wood).toEqual(["shot", "wood"]);
  expect(sounds.window).toEqual(["shot"]);
  expect(sounds.sky).toEqual(["shot"]);
  expect(sounds.civilian).toEqual(["shot", "civilianDeath"]);
  expect(sounds.lives).toBe(2);
  expect(sounds.reload).toEqual(["reload"]);
  const state = () =>
    page.evaluate(async () => {
      const { gameAudio } = await import("/src/main.ts");
      return gameAudio.state;
    });
  await expect.poll(async () => (await state()).context).toBe("suspended");
  const before = await page.evaluate(async () => {
    const { gameAudio } = await import("/src/main.ts");
    return (gameAudio as any).context.currentTime;
  });
  await page.waitForTimeout(200);
  const after = await page.evaluate(async () => {
    const { gameAudio } = await import("/src/main.ts");
    return (gameAudio as any).context.currentTime;
  });
  expect(after - before).toBeLessThan(0.03);
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page.locator("#stats")).toContainText("Патроны 6/6");
  await expect.poll(async () => (await state()).active).toBe(0);
  await page.evaluate(async () => {
    const { game, gameAudio } = await import("/src/main.ts");
    const s = game.scene.getScene("town") as any;
    s.shoot(600, 320);
    s.reload();
  });
  await page.getByRole("button", { name: "Переключить звук" }).click();
  await expect(page.locator("#sound")).toHaveText("Звук: выкл.");
  expect((await state()).active).toBe(0);
  await page.getByRole("button", { name: "← Уровни" }).click();
  await page.getByRole("button", { name: /Шериф против главаря/ }).click();
  await skipIntro(page);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { game } = await import("/src/main.ts");
        return (game.scene.getScene("town") as any).bossOpen;
      }),
    )
    .toBe(true);
  const boss = await page.evaluate(async () => {
    const { game, gameAudio } = await import("/src/main.ts");
    const events: string[] = [];
    gameAudio.play = (kind) => {
      events.push(kind);
    };
    const s = game.scene.getScene("town") as any;
    s.shoot(480, 315);
    const wounded = [...events];
    s.bossHP = 1;
    events.length = 0;
    s.shoot(480, 315);
    return { wounded, fatal: [...events], ended: s.ended };
  });
  expect(boss.wounded).toEqual(["shot", "pain"]);
  expect(boss.fatal).toEqual(["shot", "bossDeath"]);
  expect(boss.ended).toBe(true);
  expect(errors).toEqual([]);
});

test("unavailable Web Audio does not break shooting", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    Object.defineProperty(window, "AudioContext", {
      value: class {
        constructor() {
          throw new Error("Audio unavailable");
        }
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Переключить звук" }).click();
  await expect(page.locator("#sound")).toHaveText("Звук недоступен");
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
  await skipIntro(page);
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const box = await page.locator("canvas").boundingBox();
  await page.mouse.click(box!.x + 20, box!.y + 20);
  await expect(page.locator("#stats")).toContainText("Патроны 5/6");
  expect(errors).toEqual([]);
});

test("menu music and ambience are unique loops, stop for play, mute and hide, and return cleanly", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Переключить звук" }).click();
  await expect(page.locator("#sound")).toHaveText("Звук: вкл.");
  const state = () =>
    page.evaluate(async () => {
      const { gameAudio } = await import("/src/main.ts");
      return gameAudio.state;
    });
  expect((await state()).background).toEqual(["menuMusic", "menuAmbience"]);
  const loops = await page.evaluate(async () => {
    const { gameAudio } = await import("/src/main.ts");
    const a = gameAudio as any;
    gameAudio.setMenu(true);
    gameAudio.setMenu(true);
    return [...a.beds.entries()].map(([name, bed]: any) => ({
      name,
      loop: bed.source.loop,
      duration: bed.source.buffer.duration,
    }));
  });
  expect(loops).toHaveLength(2);
  for (const loop of loops) {
    expect(loop.loop).toBe(true);
    expect(loop.duration).toBeGreaterThan(10);
  }
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await state()).context).toBe("suspended");
  expect((await state()).hidden).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await state()).context).toBe("running");
  expect((await state()).background).toHaveLength(2);
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
  await skipIntro(page);
  expect((await state()).background).toEqual([]);
  await page.getByRole("button", { name: "← Уровни" }).click();
  expect((await state()).background).toHaveLength(2);
  await page.getByRole("button", { name: "Переключить звук" }).click();
  expect((await state()).background).toEqual([]);
  await page.getByRole("button", { name: "Переключить звук" }).click();
  await expect(page.locator("#sound")).toHaveText("Звук: вкл.");
  expect((await state()).background).toHaveLength(2);
  expect(errors).toEqual([]);
});

test("the same centered gun take overlaps every hit instead of replacing it", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "lastshot-progress",
      JSON.stringify({ unlocked: 5, best: [] }),
    ),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Переключить звук" }).click();
  await expect(page.locator("#sound")).toHaveText("Звук: вкл.");
  await page.getByRole("button", { name: /02.*Мирные жители/ }).click();
  await skipIntro(page);
  const result = await page.evaluate(async () => {
    const { game, gameAudio } = await import("/src/main.ts");
    const a = gameAudio as any,
      s = game.scene.getScene("town") as any;
    const starts = new Map<AudioBufferSourceNode, number>();
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (
      when = 0,
      offset = 0,
      duration?: number,
    ) {
      starts.set(this, when);
      return original.call(this, when, offset, duration);
    };
    s.nextSpawn = Infinity;
    const rows = [];
    for (const target of ["air", "wood", "bandit", "civilian"]) {
      gameAudio.stop();
      for (const t of s.targets) t.view.destroy();
      s.targets = [];
      s.ammo = 6;
      if (target === "bandit" || target === "civilian")
        s.targets.push({
          x: 230,
          y: 253,
          slot: 0,
          civilian: target === "civilian",
          view: s.person(230, 253, target === "civilian"),
          expires: s.clock + 10000,
        });
      s.shoot(
        target === "air" ? 30 : target === "wood" ? 600 : 230,
        target === "air" ? 30 : target === "wood" ? 320 : 253,
      );
      const voices = [...a.voices] as any[];
      const gun = voices.find((v) => v.kind === "shot"),
        hit = voices.find((v) => v.kind !== "shot");
      rows.push({
        target,
        same: gun.source.buffer === a.buffers.get("shot"),
        rate: gun.source.playbackRate.value,
        pan: gun.pan?.pan.value ?? 0,
        gunStart: starts.get(gun.source)!,
        gunDuration: gun.source.buffer.duration,
        hitKind: hit?.kind,
        hitStart: hit ? starts.get(hit.source) : null,
      });
    }
    AudioBufferSourceNode.prototype.start = original;
    return { rows, separate: a.shotOutput !== a.effectOutput };
  });
  expect(result.separate).toBe(true);
  for (const row of result.rows) {
    expect(row.same).toBe(true);
    expect(row.rate).toBe(1);
    expect(row.pan).toBe(0);
    if (row.hitStart !== null) {
      expect(Math.abs(row.hitStart - row.gunStart)).toBeLessThan(0.025);
      expect(row.hitStart).toBeLessThan(row.gunStart + row.gunDuration);
    }
  }
  expect(result.rows.map((r) => r.hitKind ?? null)).toEqual([
    null,
    "wood",
    "banditDeath",
    "civilianDeath",
  ]);
});

test("mode hover cues fire once per button entry and selection opens the saloon doors", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "lastshot-progress",
      JSON.stringify({ unlocked: 3, best: [] }),
    ),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Переключить звук" }).click();
  await expect(page.locator("#sound")).toHaveText("Звук: вкл.");
  await page.evaluate(async () => {
    const { gameAudio } = await import("/src/main.ts");
    (window as any).cues = [];
    const play = gameAudio.play.bind(gameAudio);
    gameAudio.play = (kind, pan) => {
      (window as any).cues.push(kind);
      play(kind, pan);
    };
  });
  const cues = () => page.evaluate(() => (window as any).cues as string[]);
  const modes = page.locator(".level");
  await modes.nth(0).hover();
  expect(await cues()).toEqual(["hover"]);
  await modes.nth(0).locator("span").hover();
  expect(await cues()).toEqual(["hover"]);
  await modes.nth(1).hover();
  expect(await cues()).toEqual(["hover", "hover"]);
  await modes.nth(4).hover();
  expect(await cues()).toEqual(["hover", "hover"]);
  await modes.nth(1).click();
  expect((await cues()).filter((c) => c === "door")).toHaveLength(1);
  const active = await page.evaluate(async () => {
    const { gameAudio } = await import("/src/main.ts");
    const a = gameAudio as any;
    return {
      background: gameAudio.state.background,
      door: [...a.voices].some((v: any) => v.kind === "door"),
    };
  });
  expect(active.background).toEqual([]);
  expect(active.door).toBe(true);
});

test("bandits share the boss hurt voice, civilians raise its pitch, and boss recordings stay intact", async ({
  page,
}) => {
  // Preserve both boss recordings byte for byte, including its separate fatal cry.
  for (const [file, hash] of [
    [
      "pain.mp3",
      "ab7d4587581350314ac954d33712b85635c54678498a0740200133a1f3a83516",
    ],
    [
      "bandit-death.mp3",
      "a565b7f6495698d79e96cba6ae36e969fc8a17826aa89de90bed12190a3428f6",
    ],
  ]) {
    const bytes = await readFile(`src/audio/${file}`);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Переключить звук" }).click();
  await expect(page.locator("#sound")).toHaveText("Звук: вкл.");
  const voices = await page.evaluate(async () => {
    const { gameAudio } = await import("/src/main.ts");
    gameAudio.setMenu(false);
    const a = gameAudio as any;
    const original = AudioParam.prototype.linearRampToValueAtTime;
    let level = 0;
    AudioParam.prototype.linearRampToValueAtTime = function (value, time) {
      level = value;
      return original.call(this, value, time);
    };
    try {
      const kinds = ["pain", "banditDeath", "civilianDeath", "bossDeath"] as const;
      return kinds.map((kind) => {
        gameAudio.stop();
        gameAudio.play(kind);
        const voice = [...a.voices][0] as any;
        return {
          kind,
          hurt: voice.source.buffer === a.buffers.get("pain"),
          fatal: voice.source.buffer === a.buffers.get("bossDeath"),
          rate: voice.source.playbackRate.value,
          level,
        };
      });
    } finally {
      AudioParam.prototype.linearRampToValueAtTime = original;
      gameAudio.stop();
    }
  });
  expect(voices.map((v) => v.hurt)).toEqual([true, true, true, false]);
  expect(voices.map((v) => v.fatal)).toEqual([false, false, false, true]);
  expect(voices.map((v) => v.level)).toEqual([0.55, 0.55, 0.55, 0.68]);
  expect(voices[0].rate).toBe(1);
  expect(voices[1].rate).toBe(1);
  expect(voices[2].rate).toBeCloseTo(2 ** (2 / 12), 5);
  expect(voices[3].rate).toBe(1);
});
