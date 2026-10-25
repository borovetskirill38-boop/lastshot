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
async function placement(page: Page) {
  return page.evaluate(() => {
    const hero = document.getElementById("dialogue-hero")!.getBoundingClientRect();
    const enemy = document.getElementById("dialogue-enemy")!.getBoundingClientRect();
    const speech = document.querySelector(".dialogue-speech")!.getBoundingClientRect();
    return { heroLeft: hero.left, heroRight: hero.right, heroBottom: hero.bottom,
      enemyLeft: enemy.left, enemyRight: enemy.right, enemyBottom: enemy.bottom,
      speechLeft: speech.left, speechTop: speech.top };
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
      await expect(page.getByRole("img", { name: "Портрет шерифа", exact: true })).toBeVisible();
      await expect(page.getByRole("img", { name: level === 4 ? "Портрет главаря" : "Портрет бандита", exact: true })).toBeVisible();
      await expect(page.locator("#dialogue-enemy-name")).toHaveText(enemy);
      let heroBubble = 0;
      for (const [index, speaker] of ["Шериф", enemy, "Шериф", enemy].entries()) {
        await expect(page.locator("#dialogue-progress")).toHaveText(`${index + 1} / 4`);
        await expect(page.locator("#dialogue-speaker")).toHaveText(speaker);
        await expect(page.locator("#dialogue-hero")).toHaveAttribute("aria-current", String(index % 2 === 0));
        await expect(page.locator("#dialogue-enemy")).toHaveAttribute("aria-current", String(index % 2 === 1));
        const layout = await placement(page);
        expect(layout.heroRight).toBeLessThan(layout.enemyLeft);
        if (index === 0) heroBubble = layout.speechLeft;
        if (index % 2) expect(layout.speechLeft).toBeGreaterThan(heroBubble + 8);
        else expect(layout.speechLeft).toBeCloseTo(heroBubble, 0);
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
    const layout = await placement(page);
    expect(layout.heroLeft).toBeGreaterThanOrEqual(0);
    expect(layout.heroRight).toBeLessThan(layout.enemyLeft);
    expect(layout.enemyRight).toBeLessThanOrEqual(width);
    if (width <= 650 && height > width) {
      expect(layout.heroBottom).toBeLessThan(layout.speechTop);
      expect(layout.enemyBottom).toBeLessThan(layout.speechTop);
    }
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

test("embedded portrait artwork decodes and the right portrait switches from boss back to bandit", async ({ page }) => {
  await unlock(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Шериф против главаря/ }).click();
  await expect(page.locator("#intro-dialog")).toHaveAttribute("data-opponent", "boss");
  const portrait = await page.locator("#dialogue-enemy-portrait").evaluate(async (element) => {
    const style = getComputedStyle(element);
    const image = new Image();
    image.src = style.backgroundImage.slice(5, -2);
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight,
      inline: image.src.startsWith("data:image/webp"), position: style.backgroundPositionX };
  });
  expect(portrait.inline).toBe(true);
  expect(portrait.width).toBeGreaterThan(300);
  expect(portrait.width / portrait.height).toBe(3);
  expect(portrait.position).toBe("100%");
  // A click on either portrait advances the conversation exactly once.
  await page.getByRole("img", { name: "Портрет шерифа", exact: true }).click();
  await expect(page.locator("#dialogue-progress")).toHaveText("2 / 4");
  await expect(page.locator("#dialogue-enemy")).toHaveAttribute("aria-current", "true");
  await page.screenshot({ path: "test-results/dialogue-boss.png", fullPage: true });
  await page.getByRole("button", { name: "← Выбор уровня", exact: true }).click();
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
  await expect(page.locator("#intro-dialog")).toHaveAttribute("data-opponent", "bandit");
  await expect(page.getByRole("img", { name: "Портрет бандита", exact: true })).toBeVisible();
  expect(await page.locator("#dialogue-enemy-portrait").evaluate((element) => getComputedStyle(element).backgroundPositionX)).toBe("50%");
  await expect(page.locator("#dialogue-hero")).toHaveAttribute("aria-current", "true");
});
