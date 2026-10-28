import { skipPrologue, skipIntro } from "./helpers";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("single HTML runs offline with weapon and no external dependencies", async ({
  browser,
}) => {
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 1280, height: 1000 },
  });
  const page = await context.newPage();
  const errors: string[] = [],
    requests: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await page.evaluate(() => {
    (window as any).audioStarts = 0;
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (
      ...args: Parameters<AudioBufferSourceNode["start"]>
    ) {
      (window as any).audioStarts++;
      return original.apply(this, args);
    };
  });
  await page.setContent(await readFile("lastshot.html", "utf8"));
  await skipPrologue(page);
  await expect(page.locator("canvas")).toBeAttached();
  await page.getByRole("button", { name: "Переключить звук" }).click();
  await expect(page.locator("#sound")).toHaveText("Звук: вкл.");
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
  await skipIntro(page);
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const box = await page.locator("canvas").boundingBox();
  expect(box!.width).toBeGreaterThan(300);
  await page.mouse.move(box!.x + box!.width * 0.8, box!.y + box!.height * 0.4);
  await page.mouse.click(box!.x + box!.width * 0.8, box!.y + box!.height * 0.4);
  await expect(page.locator("#stats")).toContainText("Патроны 5/6");
  await page.getByRole("button", { name: /Перезарядить/ }).click();
  await expect(page.locator("#stats")).toContainText("Патроны 6/6");
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page.screenshot({
    path: "test-results/standalone-art.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() => (window as any).audioStarts),
  ).toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
  await context.close();
});

test("offline mobile workshop equips a weapon, uses its capacity and keeps shot totals without external requests", async ({ browser }) => {
  const context = await browser.newContext({ offline: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const requests: string[] = [], errors: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.evaluate(() => {
    const loops = new Map<AudioBufferSourceNode, number>();
    const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
    (window as any).activeMusic = () => [...loops.values()];
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<AudioBufferSourceNode["start"]>) {
      if (this.loop && this.buffer) loops.set(this, this.buffer.duration);
      return start.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function (...args: Parameters<AudioBufferSourceNode["stop"]>) {
      loops.delete(this); return stop.apply(this, args);
    };
  });
  await page.setContent(await readFile("lastshot.html", "utf8"));
  await skipPrologue(page);
  await page.locator("#sound").tap();
  await expect(page.locator("#sound")).toHaveText("Звук: вкл.");
  await page.getByRole("button", { name: /^Арсенал/ }).tap();
  const indoorMusic = await page.evaluate(() => (window as any).activeMusic() as number[]);
  expect(indoorMusic).toHaveLength(1);
  expect(indoorMusic[0]).toBeGreaterThan(215);
  expect(indoorMusic[0]).toBeLessThan(225);
  await page.getByRole("button", { name: "Дальний дозор", exact: true }).tap();
  await expect(page.locator("#weapon-capacity")).toHaveText("8");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Взять оружие", exact: true }).tap();
  await page.screenshot({ path: "test-results/arsenal-offline-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "← Главное меню", exact: true }).tap();
  const menuMusic = await page.evaluate(() => (window as any).activeMusic() as number[]);
  expect(menuMusic).toHaveLength(2);
  expect(Math.max(...menuMusic)).toBeGreaterThan(235);
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).tap();
  await skipIntro(page, true);
  expect(await page.evaluate(() => (window as any).activeMusic())).toEqual([]);
  await expect(page.locator("#stats")).toContainText("Патроны 8/8");
  const box = await page.locator("canvas").boundingBox();
  await page.touchscreen.tap(box!.x + 10, box!.y + 10);
  await expect(page.locator("#stats")).toContainText("Патроны 7/8");
  await page.getByRole("button", { name: /Перезарядить/ }).tap();
  await expect(page.locator("#stats")).toContainText("Патроны 8/8");
  await page.getByRole("button", { name: "← Уровни" }).tap();
  await page.getByRole("button", { name: /^Арсенал/ }).tap();
  await expect(page.locator("#weapon-name")).toHaveText("Дальний дозор");
  await expect(page.locator("#weapon-misses")).toHaveText("1");
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});
