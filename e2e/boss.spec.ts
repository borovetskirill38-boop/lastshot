import { test, expect, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { maps } from "../src/maps.js";
import { skipIntro, setBossRandom } from "./helpers";

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    const s = game.scene.getScene("town") as any;
    return { phase: s.encounter.phase, hp: s.bossHP, lives: s.lives, ammo: s.ammo,
      clock: s.clock, position: s.bossPosition, score: s.score, kills: s.kills,
      appearance: s.bossView?.getData("appearance") };
  });
}
async function shoot(page: Page, x: number, y: number, touch = false) {
  const canvas = await page.locator("canvas").boundingBox();
  const px = canvas!.x + canvas!.width * x / 960, py = canvas!.y + canvas!.height * y / 540;
  if (touch) await page.touchscreen.tap(px, py);
  else await page.mouse.click(px, py);
}
async function openBoss(page: Page, mapId: string) {
  await page.addInitScript(() => localStorage.setItem("lastshot-progress", JSON.stringify({ unlocked: 5, best: [] })));
  await page.goto("/");
  await page.locator(`.map-card[data-map="${mapId}"]`).click();
  await page.getByRole("button", { name: /Шериф Картер против Билли Пули/ }).click();
  await setBossRandom(page, [0.1, 0.9]);
}

test("Billy can appear alone first and repeat either pose without alternating", async ({ page }) => {
  await openBoss(page, "saloon");
  await setBossRandom(page, [0.8, 0.9, 0.1, 0.2, 0.8]);
  await skipIntro(page);
  for (let hit = 1; hit <= 2; hit++) {
    await expect.poll(async () => (await snapshot(page)).phase, { intervals: [50] }).toBe("exposed");
    await expect(page.locator("#boss-notice")).toContainText("Билли Пуля");
    const { position } = await snapshot(page);
    await shoot(page, position.x, position.y);
    expect(await snapshot(page)).toMatchObject({ phase: "hidden", hp: 6 - hit, lives: 3 });
  }
  for (let i = 0; i < 2; i++) {
    await expect.poll(async () => (await snapshot(page)).phase, { intervals: [50] }).toBe("hostage");
    await expect(page.locator("#boss-notice")).toContainText("Сьюззи в плену");
    await expect.poll(async () => (await snapshot(page)).phase, { intervals: [50] }).toBe("hidden");
    expect(await snapshot(page)).toMatchObject({ hp: 4, lives: 3 });
  }
  await expect.poll(async () => (await snapshot(page)).phase, { intervals: [50] }).toBe("exposed");
  const { position } = await snapshot(page);
  await shoot(page, position.x, position.y);
  expect(await snapshot(page)).toMatchObject({ phase: "hidden", hp: 3, lives: 3 });
});

for (const map of maps) {
  test(`hostage hits are penalized, waiting is safe, and the boss moves on ${map.id}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openBoss(page, map.id);
    // Keep the actual portrait's data URL inside the page for a pixel-source identity check.
    await page.locator("#dialogue-enemy-portrait").evaluate((element) => {
      (window as any).bossPortraitSource = getComputedStyle(element).backgroundImage.slice(5, -2);
    });
    await skipIntro(page);
    await expect.poll(async () => (await snapshot(page)).phase).toBe("hostage");
    await expect(page.locator("#boss-notice")).toContainText("НЕ СТРЕЛЯЙТЕ");
    await page.getByRole("button", { name: "Пауза", exact: true }).click();
    const before = await snapshot(page);
    await page.waitForTimeout(250);
    expect(await snapshot(page)).toEqual(before);
    expect(before).toMatchObject({ hp: 6, lives: 3, ammo: 6, appearance: "shield" });
    await page.screenshot({ path: `test-results/hostage-${map.id}.png`, fullPage: true });
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
    const p = before.position;
    await shoot(page, p.x - 25 * p.scale, p.y - 30 * p.scale); // Even the boss's side is protected.
    await shoot(page, p.x + 20 * p.scale, p.y - 20 * p.scale); // Suzzie is visibly in front.
    expect(await snapshot(page)).toMatchObject({ hp: 6, lives: 1, ammo: 4, score: 0, kills: 0 });
    await expect.poll(async () => (await snapshot(page)).phase, { timeout: 6000 }).toBe("exposed");
    const exposed = await snapshot(page);
    expect(exposed.lives).toBe(1); // Waiting through a shield phase does not inflict another penalty.
    expect(`${exposed.position.x},${exposed.position.y}`).not.toBe(`${p.x},${p.y}`);
    expect(exposed.appearance).toBe("boss");
    const samePortrait = await page.evaluate(async () => {
      const { game } = await import("/src/main.ts");
      const s = game.scene.getScene("town") as any;
      const sprite = s.bossView.list.find((child: any) => child.type === "Image");
      return sprite.texture.key === "boss-encounter" && sprite.frame.name === "boss"
        && sprite.texture.getSourceImage().src === (window as any).bossPortraitSource;
    });
    expect(samePortrait).toBe(true);
    await shoot(page, exposed.position.x, exposed.position.y);
    expect(await snapshot(page)).toMatchObject({ phase: "hidden", hp: 5, lives: 1, score: 100, kills: 1 });
    await shoot(page, exposed.position.x, exposed.position.y); // A burst cannot hit him after retreat.
    expect(await snapshot(page)).toMatchObject({ hp: 5, lives: 1, ammo: 2, score: 100 });
    const stats = await page.evaluate(() => JSON.parse(localStorage.getItem("lastshot-arsenal")!).stats["last-word"]);
    expect(stats).toEqual({ hits: 3, misses: 1, civilianHits: 2 });
    expect(errors).toEqual([]);
  });
}

test("three shield hits end the fight without damaging the boss or counting extra shots", async ({ page }) => {
  await openBoss(page, "saloon");
  await skipIntro(page);
  await expect.poll(async () => (await snapshot(page)).phase).toBe("hostage");
  const p = (await snapshot(page)).position;
  for (let i = 0; i < 3; i++) await shoot(page, p.x, p.y);
  await expect(page.locator("#result")).toBeVisible();
  expect(await snapshot(page)).toMatchObject({ hp: 6, lives: 0, score: 0, ammo: 3, kills: 0 });
  await page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    const s = game.scene.getScene("town") as any;
    s.shoot(s.bossPosition.x, s.bossPosition.y);
  });
  expect(await snapshot(page)).toMatchObject({ hp: 6, lives: 0, ammo: 3 });
  const stats = await page.evaluate(() => JSON.parse(localStorage.getItem("lastshot-arsenal")!).stats["last-word"]);
  expect(stats).toEqual({ hits: 3, misses: 0, civilianHits: 3 });
});

test("the boss encounter, Suzzie dialogue and touch penalties work offline after rotation", async ({ browser }) => {
  const context = await browser.newContext({ offline: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [], requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));
  await page.evaluate(() => {
    const values = new Map([["lastshot-progress", JSON.stringify({ unlocked: 5, best: [] })]]);
    Object.defineProperty(window, "localStorage", { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } });
    Math.random = () => (window as any).exposeBoss ? 0.99 : 0;
  });
  await page.setContent(await readFile("lastshot.html", "utf8"));
  await page.locator('.map-card[data-map="tavern"]').tap();
  await page.getByRole("button", { name: /Шериф Картер против Билли Пули/ }).tap();
  await page.locator("#dialogue-next").tap();
  await page.locator("#dialogue-next").tap();
  await expect(page.getByRole("img", { name: "Портрет Сьюззи, официантки", exact: true })).toBeVisible();
  await expect(page.locator("#dialogue-line")).toContainText("Помоги мне");
  await skipIntro(page, true);
  await expect(page.locator("#boss-notice")).toHaveAttribute("data-phase", "hostage");
  await page.getByRole("button", { name: "Пауза", exact: true }).tap();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: "test-results/hostage-offline-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Продолжить", exact: true }).tap();
  const tavern = maps.find((map) => map.id === "tavern")!;
  await shoot(page, tavern.slots[0].x, tavern.slots[0].y, true);
  await expect(page.locator("#life-count")).toHaveText("2/3");
  await expect(page.locator("#boss-notice")).toContainText("6/6");
  await expect(page.locator("#stats")).toContainText("Патроны 5/6");
  // Future appearances use fresh rolls rather than the previous pose.
  await page.evaluate(() => { (window as any).exposeBoss = true; });
  await expect(page.locator("#boss-notice")).toHaveAttribute("data-phase", "exposed");
  await shoot(page, tavern.slots.at(-1)!.x, tavern.slots.at(-1)!.y, true);
  await expect(page.locator("#boss-notice")).toContainText("5/6");
  await expect(page.locator("#life-count")).toHaveText("2/3");
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});
