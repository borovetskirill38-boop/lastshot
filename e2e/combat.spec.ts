import { test, expect, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { skipPrologue, skipIntro } from "./helpers";

async function start(page: Page, map: string) {
  await page.addInitScript(() => localStorage.setItem("lastshot-progress", JSON.stringify({ unlocked: 5, best: [] })));
  await page.goto("/"); await skipPrologue(page);
  await page.locator(`.map-card[data-map="${map}"]`).click();
  await page.getByRole("button", { name: /02.*Мирные жители/ }).click(); await skipIntro(page);
  await page.evaluate(async () => {
    const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
    s.nextSpawn = Infinity; for (const t of s.targets) t.view.destroy(); s.targets = [];
  });
}

for (const map of ["saloon", "street", "tavern"]) {
  test(`${map}: keyboard cover, reload, lateral travel and native aiming after movement`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await start(page, map);
    const canvas = await page.locator("canvas").boundingBox();
    await page.mouse.click(canvas!.x + canvas!.width * .02, canvas!.y + canvas!.height * .02);
    await expect(page.locator("#stats")).toContainText("Патроны 5/6");
    await page.keyboard.press("s");
    await expect(page.locator("#play")).toHaveAttribute("data-cover", "safe");
    await page.mouse.click(canvas!.x + canvas!.width * .02, canvas!.y + canvas!.height * .02);
    await expect(page.locator("#stats")).toContainText("Патроны 5/6");
    await page.keyboard.press("r");
    await expect(page.locator("#stats")).toContainText("Патроны 6/6");
    await page.locator("#move-left").click();
    await expect(page.locator("#cover-status")).toContainText("Переход");
    await expect(page.locator("#cover-status")).toContainText("За укрытием");
    await expect(page.locator("#cover-status")).toContainText("1/3");
    await page.screenshot({ path: `test-results/cover-${map}.png`, fullPage: true });
    await page.keyboard.press("w");
    const target = await page.evaluate(async () => {
      const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
      const p = s.slots[0]; s.targets = [{ ...p, slot: 0, civilian: false, expires: Infinity, view: s.person(p.x, p.y, false) }];
      return { x: p.x, y: p.y };
    });
    await expect.poll(() => page.evaluate(async () => {
      const { game } = await import("/src/main.ts"); return (game.scene.getScene("town") as any).movement.canShoot;
    })).toBe(true);
    const point = await page.evaluate(async p => {
      const { game } = await import("/src/main.ts"); return (game.scene.getScene("town") as any).world.getWorldTransformMatrix().transformPoint(p.x, p.y);
    }, target);
    const box = await page.locator("canvas").boundingBox();
    await page.mouse.click(box!.x + point.x / 960 * box!.width, box!.y + point.y / 540 * box!.height);
    await expect(page.locator("#stats")).toContainText("1/12");
    await page.locator("#pause").click();
    const status = await page.locator("#cover-status").textContent();
    await page.keyboard.press("d"); await page.keyboard.press("s");
    await expect(page.locator("#cover-status")).toHaveText(status!);
    expect(errors).toEqual([]);
  });

  test(`${map}: telegraphed animated enemy fire hurts exposed sheriff, hits cover or misses after a dodge`, async ({ page }) => {
    await start(page, map);
    await page.getByRole("button", { name: "Переключить звук" }).click();
    await expect(page.locator("#sound")).toHaveText("Звук: вкл.");
    const aiming = await page.evaluate(async () => {
      const { game } = await import("/src/main.ts"); const { planAttack } = await import("/src/combat.js");
      const s = game.scene.getScene("town") as any; const p = s.slots[0];
      const a = planAttack(s.clock);
      s.targets = [{ ...p, slot: 0, civilian: false, expires: Infinity, view: s.person(p.x, p.y, false), attack: a }];
      s.update(0, 300); s.update(0, 600); s.togglePause();
      return { frame: s.targets[0].view.getData("combat-image").frame.name, left: a.fireAt - s.clock, lives: s.lives };
    });
    expect(aiming).toMatchObject({ frame: "0-2", lives: 3 });
    expect(aiming.left).toBe(500);
    await expect(page.locator("#threat-notice")).toBeVisible();
    await page.screenshot({ path: `test-results/aiming-${map}.png`, fullPage: true });
    const result = await page.evaluate(async () => {
      const { game, gameAudio } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
      const sounds: string[] = []; const original = gameAudio.play.bind(gameAudio);
      gameAudio.play = (kind, pan) => { sounds.push(kind); original(kind, pan); };
      gameAudio.setPaused(false); await (gameAudio as any).context.resume();
      s.paused = false; s.update(0, 501);
      const hurt = { lives: s.lives, sounds: [...sounds], frame: s.targets[0].view.getData("combat-image").frame.name,
        pitch: [...(gameAudio as any).voices].find((v: any) => v.kind === "playerHurt")?.source.playbackRate.value };
      s.update(0, 100); const after = s.lives;
      const recoilFrame = s.targets[0].view.getData("combat-image").frame.name;
      s.stance(true); s.update(0, 200); sounds.length = 0;
      const recoveredFrame = s.targets[0].view.getData("combat-image").frame.name;
      s.receiveFire(s.slots[0].x, s.slots[0].y, 1);
      const cover = { lives: s.lives, sounds: [...sounds] };
      s.move(-1); s.update(0, 360); s.stance(false); s.update(0, 200); sounds.length = 0;
      s.receiveFire(s.slots[0].x, s.slots[0].y, 1);
      const dodge = { lives: s.lives, sounds: [...sounds] };
      s.togglePause(); gameAudio.play = original;
      return { hurt, after, cover, dodge, recoilFrame, recoveredFrame };
    });
    expect(result.hurt).toMatchObject({ lives: 2, sounds: ["enemyShot", "playerHurt"], frame: "0-2" });
    expect(result.recoilFrame).toBe("0-3");
    expect(result.recoveredFrame).toBe("0-0");
    expect(result.hurt.pitch).toBeCloseTo(2 ** (-3 / 12), 4);
    expect(result.after).toBe(2);
    expect(result.cover).toEqual({ lives: 2, sounds: ["enemyShot", "wood"] });
    expect(result.dodge).toEqual({ lives: 2, sounds: ["enemyShot", "wood"] });
  });
}

test("killing a gunman cancels his attack and civilians never get a firing plan", async ({ page }) => {
  await start(page, "street");
  const result = await page.evaluate(async () => {
    const { game, gameAudio } = await import("/src/main.ts"); const { planAttack } = await import("/src/combat.js");
    const s = game.scene.getScene("town") as any; const p = s.slots[0];
    s.targets = [{ ...p, slot: 0, civilian: false, expires: Infinity, view: s.person(p.x, p.y, false), attack: planAttack(s.clock) }];
    s.update(0, 300); s.shoot(p.x, p.y);
    const sounds: string[] = []; const original = gameAudio.play.bind(gameAudio);
    gameAudio.play = kind => { sounds.push(kind); };
    s.update(0, 2000);
    const random = Math.random; Math.random = () => 0;
    s.nextSpawn = s.clock; s.update(0, 1); Math.random = random;
    const civilian = { civilian: s.targets[0].civilian, armed: !!s.targets[0].attack };
    s.targets[0].expires = s.clock; s.nextSpawn = Infinity; s.update(0, 1);
    s.togglePause(); gameAudio.play = original;
    return { lives: s.lives, kills: s.kills, sounds, civilian };
  });
  expect(result).toEqual({ lives: 3, kills: 1, sounds: [], civilian: { civilian: true, armed: false } });
});

test("cover stops Billy's shot on all three maps without damaging him or the hostage", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("lastshot-progress", JSON.stringify({ unlocked: 5, best: [] })));
  await page.goto("/"); await skipPrologue(page);
  for (const map of ["saloon", "street", "tavern"]) {
    await page.locator(`.map-card[data-map="${map}"]`).click();
    await page.getByRole("button", { name: /Шериф Картер против Билли Пули/ }).click(); await skipIntro(page);
    const state = await page.evaluate(async () => {
      const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
      s.encounter.phase = "exposed"; s.encounter.nextAt = s.clock + 1100; s.renderBoss();
      s.stance(true); s.update(0, 200); s.update(0, 901); s.togglePause();
      return { lives: s.lives, hp: s.bossHP, phase: s.encounter.phase, ammo: s.ammo };
    });
    expect(state).toEqual({ lives: 3, hp: 6, phase: "hidden", ammo: 6 });
    await page.locator("#back").click();
  }
});

test("offline touch controls can move, crouch and peek without spending a cartridge", async ({ browser }) => {
  const context = await browser.newContext({ offline: true, viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage(); const requests: string[] = [], errors: string[] = [];
    page.on("request", r => requests.push(r.url())); page.on("pageerror", e => errors.push(e.message));
    await page.setContent(await readFile("lastshot.html", "utf8")); await skipPrologue(page);
    await page.locator('.map-card[data-map="street"]').tap();
    await page.locator(".level").first().tap(); await skipIntro(page, true);
    await page.locator("#crouch").tap(); await expect(page.locator("#play")).toHaveAttribute("data-cover", "safe");
    await page.locator("#move-right").tap(); await expect(page.locator("#cover-status")).toContainText("3/3");
    await expect(page.locator("#play")).toHaveAttribute("data-cover", "safe");
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator("#peek").tap();
    await expect(page.locator("#stats")).toContainText("Патроны 6/6");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(requests).toEqual([]); expect(errors).toEqual([]);
  } finally { await context.close(); }
});
