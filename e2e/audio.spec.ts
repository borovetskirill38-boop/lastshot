import { test, expect } from "@playwright/test";

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
    const buffers = [...a.buffers.values()] as AudioBuffer[];
    const summaries = buffers.map((b) => {
      const data = b.getChannelData(0);
      let peak = 0,
        energy = 0;
      for (const value of data) {
        peak = Math.max(peak, Math.abs(value));
        energy += value * value;
      }
      return {
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
  expect(result.summaries).toHaveLength(13);
  for (const b of result.summaries) {
    expect(b.duration).toBeGreaterThan(0.18);
    expect(b.duration).toBeLessThan(13);
    expect(b.peak).toBeGreaterThan(0.1);
    expect(b.peak).toBeLessThan(1);
    expect(b.rms).toBeGreaterThan(0.001);
  }
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
  expect(boss.fatal).toEqual(["shot", "banditDeath"]);
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
