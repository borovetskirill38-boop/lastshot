import { test, expect, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { skipIntro } from "./helpers";

const modes = ["Первый выстрел", "Мирные жители", "Быстрая рука", "Шесть патронов", "Шериф против главаря"];
const locations = [
  ["saloon", "Салун Полдень", "Салун"],
  ["street", "Улица городка Лёгкие сумерки", "Улица городка"],
  ["tavern", "Внутри салуна Свет керосиновых ламп", "Внутри салуна"],
] as const;
async function unlock(page: Page) {
  await page.addInitScript(() => localStorage.setItem("lastshot-progress", JSON.stringify({ unlocked: 5, best: [] })));
}
async function state(page: Page) {
  return page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    const scene = game.scene.getScene("town") as any;
    return {
      intro: scene.intro, ended: scene.ended, paused: scene.paused, reloading: scene.reloading,
      clock: scene.clock, ammo: scene.ammo, lives: scene.lives, targets: scene.targets.length,
      boss: scene.bossOpen, shells: scene.weapon.shells.length,
    };
  });
}

for (const [mapId, mapButton, mapName] of locations) {
  for (const [level, name] of modes.entries()) {
    test(`four clickable lines precede ${name} on ${mapId}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await unlock(page);
      await page.goto("/");
      await page.getByRole("button", { name: mapButton, exact: true }).click();
      await page.getByRole("button", { name: new RegExp(name) }).click();
      await expect(page.getByRole("dialog", { name: "Перед перестрелкой" })).toBeVisible();
      await expect(page.locator("#dialogue-context")).toHaveText(`${mapName} · ${name}`);
      const enemy = level === 4 ? "Главарь" : "Бандит";
      for (const [index, speaker] of ["Шериф", enemy, "Шериф", enemy].entries()) {
        await expect(page.locator("#dialogue-progress")).toHaveText(`${index + 1} / 4`);
        await expect(page.locator("#dialogue-speaker")).toHaveText(speaker);
        expect((await state(page)).intro).toBe(true);
        if (index === 3) {
          await expect(page.locator("#dialogue-next")).toHaveText("Начать перестрелку");
          // The full-screen conversation accepts a click outside the text card too.
          await page.mouse.click(4, 4);
        } else {
          await page.locator("#dialogue-line").click();
        }
      }
      await expect(page.locator("#intro-dialog")).not.toBeVisible();
      const ready = await state(page);
      expect(ready).toMatchObject({ intro: false, ended: false, paused: false, reloading: false, ammo: 6, lives: 3, shells: 0 });
      await expect.poll(async () => {
        const current = await state(page);
        return current.boss || current.targets > 0;
      }).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}

test("reading holds timers, blocks gameplay input and leaves ammunition and saves intact", async ({ page }) => {
  await page.goto("/");
  const saved = () => page.evaluate(() => [localStorage.getItem("lastshot-progress"), localStorage.getItem("lastshot-arsenal")]);
  const beforeSave = await saved();
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
  const before = await state(page);
  await page.waitForTimeout(1200); // Longer than the first enemy's normal spawn delay.
  await page.keyboard.press("r");
  await page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    const scene = game.scene.getScene("town") as any;
    scene.shoot(20, 20);
    scene.reload();
    scene.togglePause();
    scene.finish(false);
  });
  expect(await state(page)).toEqual(before);
  expect(before).toMatchObject({ intro: true, clock: 0, ammo: 6, lives: 3, targets: 0, boss: false });
  await expect(page.locator("#result")).toBeHidden();
  expect(await saved()).toEqual(beforeSave);
  await skipIntro(page);
  expect(await state(page)).toMatchObject({ intro: false, ammo: 6, lives: 3, shells: 0 });
  expect(await saved()).toEqual(beforeSave);
});

test("Escape and the back button cancel cleanly; keyboard advances lines and skip starts once", async ({ page }) => {
  await page.goto("/");
  const first = page.getByRole("button", { name: /01.*Первый выстрел/ });
  await first.click();
  await expect(page.locator("#dialogue-next")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#dialogue-skip")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#dialogue-back")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#dialogue-skip")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#dialogue-next")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.locator("#dialogue-progress")).toHaveText("2 / 4");
  await page.keyboard.press("Enter");
  await expect(page.locator("#dialogue-progress")).toHaveText("3 / 4");
  await page.keyboard.press("Escape");
  await expect(page.locator("#menu")).toBeVisible();
  await expect(first).toBeFocused();
  expect(await state(page)).toMatchObject({ intro: false, ended: true, paused: false });
  await first.click();
  await expect(page.locator("#dialogue-progress")).toHaveText("1 / 4");
  await page.getByRole("button", { name: "← Выбор уровня", exact: true }).click();
  await expect(page.locator("#menu")).toBeVisible();
  await first.click();
  await skipIntro(page);
  expect(await state(page)).toMatchObject({ intro: false, ended: false, paused: false, ammo: 6 });
});

test("next level and retry each open a fresh dialogue for the selected map and mode", async ({ page }) => {
  await unlock(page);
  await page.goto("/");
  await page.getByRole("button", { name: locations[2][1], exact: true }).click();
  await page.getByRole("button", { name: /02.*Мирные жители/ }).click();
  await skipIntro(page);
  await page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    (game.scene.getScene("town") as any).finish(true);
  });
  await page.getByRole("button", { name: "Следующий уровень →", exact: true }).click();
  await expect(page.locator("#dialogue-context")).toHaveText("Внутри салуна · Быстрая рука");
  await expect(page.locator("#dialogue-progress")).toHaveText("1 / 4");
  await skipIntro(page);
  await page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    (game.scene.getScene("town") as any).finish(false);
  });
  await page.getByRole("button", { name: "Ещё раз", exact: true }).click();
  await expect(page.locator("#dialogue-context")).toHaveText("Внутри салуна · Быстрая рука");
  await expect(page.locator("#dialogue-progress")).toHaveText("1 / 4");
  expect(await state(page)).toMatchObject({ intro: true, ammo: 6, lives: 3, targets: 0 });
});

test("offline touch dialogue fits narrow screens and rotation, then preserves the equipped weapon", async ({ browser }) => {
  const context = await browser.newContext({ offline: true, viewport: { width: 280, height: 653 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [], requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));
  await page.setContent(await readFile("lastshot.html", "utf8"));
  await page.getByRole("button", { name: /^Арсенал/ }).tap();
  await page.getByRole("button", { name: "Дальний дозор", exact: true }).tap();
  await page.getByRole("button", { name: "Взять оружие", exact: true }).tap();
  await page.getByRole("button", { name: "← Главное меню", exact: true }).tap();
  await page.getByRole("button", { name: locations[2][1], exact: true }).tap();
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).tap();
  await expect(page.locator(".saloon-transition")).toHaveCount(0);
  for (const [width, height] of [[280, 653], [320, 568], [390, 844], [844, 390], [1024, 768], [480, 240]]) {
    await page.setViewportSize({ width, height });
    expect(await page.locator("#intro-dialog").evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
    await page.locator("#dialogue-next").scrollIntoViewIfNeeded();
    const button = await page.locator("#dialogue-next").boundingBox();
    expect(button!.y).toBeGreaterThanOrEqual(0);
    expect(button!.y + button!.height).toBeLessThanOrEqual(height + 1);
    if (width === 280 || width === 844) await page.screenshot({ path: `test-results/dialogue-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 844, height: 390 });
  for (let line = 0; line < 4; line++) await page.locator("#dialogue-next").tap();
  await expect(page.locator("#intro-dialog")).not.toBeVisible();
  await expect(page.locator("#stats")).toContainText("Патроны 8/8");
  const canvas = await page.locator("canvas").boundingBox();
  await page.touchscreen.tap(canvas!.x + canvas!.width * 0.5, canvas!.y + canvas!.height * 0.1);
  await expect(page.locator("#stats")).toContainText("Патроны 7/8");
  await page.getByRole("button", { name: /Перезарядить/ }).tap();
  await expect(page.locator("#stats")).toContainText("Патроны 8/8");
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});
