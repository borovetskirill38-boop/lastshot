import { test, expect, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const streetButton = (page: Page) => page.getByRole("button", { name: "Улица городка Лёгкие сумерки", exact: true });
const saloonButton = (page: Page) => page.getByRole("button", { name: "Салун Полдень", exact: true });
async function shot(page: Page, x: number, y: number) {
  const canvas = await page.locator("canvas").boundingBox();
  await page.mouse.click(canvas!.x + canvas!.width * x / 960, canvas!.y + canvas!.height * y / 540);
}
async function unlock(page: Page) {
  await page.addInitScript(() => localStorage.setItem("lastshot-progress", JSON.stringify({ unlocked: 5, best: [200, 400] })));
}

test("location selection persists, keeps progress and releases old scenery when switching", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await unlock(page);
  await page.goto("/");
  await expect(saloonButton(page)).toHaveAttribute("aria-pressed", "true");
  await streetButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(streetButton(page)).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(streetButton(page)).toHaveAttribute("aria-pressed", "true");
  let textures = 0;
  for (const map of ["street", "saloon", "street", "saloon", "street"]) {
    await (map === "street" ? streetButton(page) : saloonButton(page)).click();
    await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
    await page.getByRole("button", { name: "Пауза", exact: true }).click();
    const state = await page.evaluate(async () => {
      const { game } = await import("/src/main.ts");
      const scene = game.scene.getScene("town") as any;
      return {
        map: scene.map.id, textures: game.textures.getTextureKeys().length,
        layers: scene.scenery.length,
        backgrounds: scene.children.list.filter((child: any) => child.name === "map-background").length,
        key: scene.scenery[0].texture.key,
      };
    });
    textures ||= state.textures;
    expect(state).toEqual({ map, textures, layers: map === "street" ? 8 : 7, backgrounds: 1, key: map === "street" ? "street-dusk" : "town-scenery" });
    await page.getByRole("button", { name: "← Уровни" }).click();
  }
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("lastshot-progress")!))).toEqual({ unlocked: 5, best: [200, 400] });
  await page.screenshot({ path: "test-results/street-menu.png", fullPage: true });
  expect(errors).toEqual([]);
});

for (const mode of ["Первый выстрел", "Мирные жители", "Быстрая рука", "Шесть патронов", "Шериф против главаря"]) {
  test(`street supports ${mode}, native shots and cover`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await unlock(page);
    await page.goto("/");
    await streetButton(page).click();
    // The actual spawn code selects the barrel position and a bandit.
    await page.evaluate(() => { Math.random = () => 0.99; });
    await page.getByRole("button", { name: new RegExp(mode) }).click();
    await expect(page.locator("#level-name")).toContainText("Улица городка");
    if (mode === "Шериф против главаря") {
      await expect.poll(() => page.evaluate(async () => {
        const { game } = await import("/src/main.ts");
        return (game.scene.getScene("town") as any).bossOpen;
      })).toBe(true);
      const boss = await page.evaluate(async () => {
        const { game } = await import("/src/main.ts");
        const scene = game.scene.getScene("town") as any;
        scene.nextSpawn = Infinity;
        return scene.map.boss;
      });
      expect(boss.x).not.toBe(480);
      // One covered shot must leave boss HP intact.
      await shot(page, boss.x, boss.coverY + 2);
      await expect(page.locator("#stats")).toContainText("0/6");
      for (let i = 0; i < 5; i++) await shot(page, boss.x, boss.y);
      await page.getByRole("button", { name: /Перезарядить/ }).click();
      await expect(page.locator("#stats")).toContainText("Патроны 6/6");
      await shot(page, boss.x, boss.y);
      await expect(page.locator("#result-title")).toHaveText("Город свободен!");
      await page.getByRole("button", { name: "Ещё раз", exact: true }).click();
      await expect(page.locator("#level-name")).toContainText("Улица городка");
    } else {
      await expect.poll(() => page.evaluate(async () => {
        const { game } = await import("/src/main.ts");
        return (game.scene.getScene("town") as any).targets.length;
      })).toBeGreaterThan(0);
      const target = await page.evaluate(async () => {
        const { game } = await import("/src/main.ts");
        const scene = game.scene.getScene("town") as any;
        scene.nextSpawn = Infinity;
        scene.targets[0].expires = Infinity;
        const { x, y, coverY, civilian } = scene.targets[0];
        return { x, y, coverY, civilian };
      });
      expect(target).toEqual({ x: 728, y: 303, coverY: 337, civilian: false });
      await shot(page, target.x, target.coverY + 2);
      await shot(page, target.x, target.y);
      await expect(page.locator("#stats")).toContainText("Патроны 4/6");
      expect(await page.evaluate(async () => {
        const { game } = await import("/src/main.ts");
        const scene = game.scene.getScene("town") as any;
        return { kills: scene.kills, remaining: scene.targets.length, lives: scene.lives };
      })).toEqual({ kills: 1, remaining: 0, lives: mode === "Первый выстрел" ? 2 : 3 });
    }
    expect(errors).toEqual([]);
  });
}

test("all six street positions use matching rendered sizes, hit areas and civilian penalties", async ({ page }) => {
  await unlock(page);
  await page.goto("/");
  await streetButton(page).click();
  await page.getByRole("button", { name: /02.*Мирные жители/ }).click();
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await expect(page.locator(".saloon-transition")).toHaveCount(0);
  const positions = await page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    const scene = game.scene.getScene("town") as any;
    for (const target of scene.targets) target.view.destroy();
    scene.nextSpawn = Infinity;
    scene.targets = scene.slots.map((slot: any, i: number) => ({ ...slot, slot: i, civilian: i === 2, expires: Infinity, view: scene.person(slot.x, slot.y, i === 2) }));
    return scene.targets.map((target: any) => ({ x: target.x, y: target.y, scale: target.scale, rendered: target.view.scaleX }));
  });
  for (const position of positions) expect(position.rendered).toBe(position.scale);
  await page.screenshot({ path: "test-results/street-all-targets.png", fullPage: true });
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  for (const position of positions) await shot(page, position.x, position.y);
  expect(await page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    const scene = game.scene.getScene("town") as any;
    return { kills: scene.kills, lives: scene.lives, ammo: scene.ammo, remaining: scene.targets.length };
  })).toEqual({ kills: 5, lives: 2, ammo: 0, remaining: 0 });
});

test("offline touch selection and the new street fit narrow screens and rotation without storage", async ({ browser }) => {
  const context = await browser.newContext({ offline: true, viewport: { width: 280, height: 653 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [], requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));
  await page.setContent(await readFile("lastshot.html", "utf8"));
  await streetButton(page).tap();
  await expect(streetButton(page)).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).tap();
  await page.getByRole("button", { name: "Пауза", exact: true }).tap();
  for (const [width, height] of [[280, 653], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator(".saloon-transition")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => {
      const canvas = document.querySelector("canvas")!.getBoundingClientRect();
      const controls = document.querySelector(".controls")!.getBoundingClientRect();
      return canvas.right <= innerWidth && controls.bottom <= innerHeight && canvas.bottom <= controls.top;
    })).toBe(true);
  }
  await page.getByRole("button", { name: "Продолжить", exact: true }).tap();
  const canvas = await page.locator("canvas").boundingBox();
  await page.touchscreen.tap(canvas!.x + canvas!.width / 2, canvas!.y + canvas!.height * 0.1);
  await expect(page.locator("#stats")).toContainText("Патроны 5/6");
  await page.getByRole("button", { name: "← Уровни" }).tap();
  await expect(streetButton(page)).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
  await context.close();
});
