import { skipIntro } from "./helpers";
import { test, expect, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const sizes = [
  [280, 653], [320, 568], [390, 844], [667, 375],
  [844, 390], [768, 1024], [1024, 768], [1920, 1080],
] as const;
const settle = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
async function fitsWidth(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function gameFits(page: Page) {
  await expect(page.locator(".saloon-transition")).toHaveCount(0);
  await settle(page);
  const layout = await page.evaluate(() => {
    const canvas = document.querySelector("canvas")!.getBoundingClientRect();
    const controls = document.querySelector(".controls")!.getBoundingClientRect();
    return {
      left: canvas.left, right: canvas.right, top: canvas.top, bottom: canvas.bottom,
      width: canvas.width, height: canvas.height, controlsTop: controls.top,
      controlsBottom: controls.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight,
    };
  });
  expect(layout.width).toBeGreaterThan(100);
  expect(layout.left).toBeGreaterThanOrEqual(-1);
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.top).toBeGreaterThanOrEqual(0);
  expect(layout.bottom).toBeLessThanOrEqual(layout.controlsTop + 1);
  expect(layout.controlsBottom).toBeLessThanOrEqual(layout.viewportHeight + 1);
  expect(layout.width / layout.height).toBeCloseTo(16 / 9, 1);
  await fitsWidth(page);
}

for (const [width, height] of sizes) {
  test(`menu, workshop, game and results adapt at ${width}×${height}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => {
      localStorage.setItem("lastshot-progress", JSON.stringify({ unlocked: 5, best: [] }));
      localStorage.setItem("lastshot-arsenal", JSON.stringify({ version: 1, selected: "last-word", stats: {
        "long-watch": { hits: 1234567890123456, misses: 1234567890123456, civilianHits: 1234567890123 },
      } }));
    });
    await page.goto("/");
    await expect(page.locator(".level").first()).toBeEnabled();
    await fitsWidth(page);
    const cardsFit = await page.locator(".level").evaluateAll((cards) => cards.every((card) => {
      const door = card.querySelector(".saloon-doors")!.getBoundingClientRect();
      const name = card.querySelector("span")!.getBoundingClientRect();
      const note = card.querySelector("small")!.getBoundingClientRect();
      return name.top >= door.bottom && note.top >= name.bottom && name.left >= 0 && name.right <= innerWidth;
    }));
    expect(cardsFit).toBe(true);
    await page.getByRole("button", { name: /^Арсенал/ }).click();
    await page.getByRole("button", { name: "Дальний дозор", exact: true }).click();
    await fitsWidth(page);
    expect(await page.locator(".weapon-statistics dd").evaluateAll((nodes) => nodes.every((node) => node.scrollWidth <= node.clientWidth + 1))).toBe(true);
    await page.getByRole("button", { name: "Взять оружие", exact: true }).click();
    await page.getByRole("button", { name: "← Главное меню", exact: true }).click();
    const mode = width === 280 || width === 844
      ? /Шериф против главаря/
      : width === 320 ? /04.*Шесть патронов/
        : width === 768 ? /03.*Быстрая рука/ : /02.*Мирные жители/;
    await page.getByRole("button", { name: mode }).click();
    await skipIntro(page);
    await page.getByRole("button", { name: "Пауза", exact: true }).click();
    await gameFits(page);
    await page.screenshot({ path: `test-results/responsive-game-${width}x${height}.png`, fullPage: true });
    await page.evaluate(async () => {
      const { game } = await import("/src/main.ts");
      (game.scene.getScene("town") as any).finish(false);
    });
    const modal = await page.locator(".result-card").boundingBox();
    expect(modal!.y).toBeGreaterThanOrEqual(0);
    expect(modal!.y + modal!.height).toBeLessThanOrEqual(height + 1);
    await fitsWidth(page);
    await page.getByRole("button", { name: "Выбор уровня", exact: true }).click();
    await expect(page.locator("#menu")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("aim stays aligned and the run survives window resizing and orientation changes", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("lastshot-progress", JSON.stringify({ unlocked: 5, best: [] })));
  await page.goto("/");
  await page.getByRole("button", { name: /02.*Мирные жители/ }).click();
  await skipIntro(page);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  let hits = 0;
  for (const [width, height] of [[320, 568], [844, 390], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    await gameFits(page);
    const before = await page.evaluate(async () => {
      const { game } = await import("/src/main.ts");
      const s = game.scene.getScene("town") as any;
      for (const target of s.targets) target.view.destroy();
      s.targets = [{ x: 230, y: 253, slot: 0, civilian: false, expires: Infinity, view: s.person(230, 253, false) }];
      s.nextSpawn = Infinity;
      return { ammo: s.ammo, hits: s.kills, paused: s.paused };
    });
    expect(before).toEqual({ ammo: 6 - hits, hits, paused: true });
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
    await settle(page);
    const canvas = await page.locator("canvas").boundingBox();
    await page.mouse.click(canvas!.x + canvas!.width * 230 / 960, canvas!.y + canvas!.height * 253 / 540);
    hits++;
    await expect(page.locator("#stats")).toContainText(`Патроны ${6 - hits}/6`);
    const kills = await page.evaluate(async () => {
      const { game } = await import("/src/main.ts");
      return (game.scene.getScene("town") as any).kills;
    });
    expect(kills).toBe(hits);
    await page.getByRole("button", { name: "Пауза", exact: true }).click();
  }
});

test("standalone HTML adapts offline during rotation and keeps touch and reload working", async ({ browser }) => {
  const context = await browser.newContext({ offline: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const requests: string[] = [], errors: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setContent(await readFile("lastshot.html", "utf8"));
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).tap();
  await skipIntro(page, true);
  let ammo = 6;
  for (const [width, height] of [[844, 390], [320, 568]]) {
    await page.setViewportSize({ width, height });
    await gameFits(page);
    const canvas = await page.locator("canvas").boundingBox();
    await page.touchscreen.tap(canvas!.x + canvas!.width * 0.03, canvas!.y + canvas!.height * 0.03);
    await expect(page.locator("#stats")).toContainText(`Патроны ${--ammo}/6`);
  }
  await page.getByRole("button", { name: /Перезарядить/ }).tap();
  await expect(page.locator("#stats")).toContainText("Патроны 6/6");
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});
