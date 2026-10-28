import { skipPrologue, skipIntro } from "./helpers";
import { test, expect, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const streetButton = (page: Page) => page.getByRole("button", { name: "Улица городка Лёгкие сумерки", exact: true });
const saloonButton = (page: Page) => page.getByRole("button", { name: "Салун Полдень", exact: true });
const tavernButton = (page: Page) => page.getByRole("button", { name: "Внутри салуна Свет керосиновых ламп", exact: true });
const mapButton = { saloon: saloonButton, street: streetButton, tavern: tavernButton };
const locations = [
  { id: "street", title: "Улица городка" },
  { id: "tavern", title: "Внутри салуна" },
] as const;
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
  await skipPrologue(page);
  await expect(saloonButton(page)).toHaveAttribute("aria-pressed", "true");
  await streetButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(streetButton(page)).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await skipPrologue(page);
  await expect(streetButton(page)).toHaveAttribute("aria-pressed", "true");
  let textures = 0;
  const layers = new Map<string, number>();
  const backgrounds = new Set<string>();
  for (const [visit, map] of (["tavern", "street", "saloon", "tavern", "saloon", "street", "tavern"] as const).entries()) {
    await mapButton[map](page).click();
    await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
    await skipIntro(page);
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
    if (visit === 2) textures = state.textures; // All three backgrounds have been cached once.
    if (visit > 2) expect(state.textures).toBe(textures);
    if (layers.has(map)) expect(state.layers).toBe(layers.get(map));
    layers.set(map, state.layers);
    backgrounds.add(state.key);
    expect(state.map).toBe(map);
    expect(state.backgrounds).toBe(1);
    await page.getByRole("button", { name: "← Уровни" }).click();
  }
  expect(backgrounds.size).toBe(3);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("lastshot-progress")!))).toEqual({ unlocked: 5, best: [200, 400] });
  await page.reload();
  await skipPrologue(page);
  await expect(tavernButton(page)).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "test-results/map-selection.png", fullPage: true });
  expect(errors).toEqual([]);
});

for (const location of locations) {
  for (const mode of ["Первый выстрел", "Мирные жители", "Быстрая рука", "Шесть патронов", "Шериф Картер против Билли Пули"]) {
    test(`${location.id} supports ${mode}, native shots and cover`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await unlock(page);
      await page.goto("/");
      await skipPrologue(page);
      await mapButton[location.id](page).click();
      // The actual spawn code selects the last cover position and a bandit.
      await page.evaluate(() => { Math.random = () => 0.99; });
      await page.getByRole("button", { name: new RegExp(mode) }).click();
      await skipIntro(page);
      await expect(page.locator("#level-name")).toContainText(location.title);
      if (mode === "Шериф Картер против Билли Пули") {
        test.setTimeout(45000);
        const positions = new Set<string>();
        for (let hit = 0; hit < 6; hit++) {
          if (hit === 5) {
            await page.getByRole("button", { name: /Перезарядить/ }).click();
            await expect(page.locator("#stats")).toContainText("Патроны 6/6");
          }
          await expect.poll(() => page.evaluate(async () => {
            const { game } = await import("/src/main.ts");
            return (game.scene.getScene("town") as any).bossOpen;
          }), { timeout: 6000 }).toBe(true);
          const boss = await page.evaluate(async () => {
            const { game } = await import("/src/main.ts");
            return (game.scene.getScene("town") as any).bossPosition;
          });
          positions.add(`${boss.x},${boss.y}`);
          if (hit === 0) {
            // One covered shot must leave boss HP intact.
            await shot(page, boss.x, boss.coverY + 2);
            await expect(page.locator("#stats")).toContainText("0/6");
          }
          await shot(page, boss.x, boss.y);
        }
        expect(positions.size).toBeGreaterThan(1);
        await expect(page.locator("#result-title")).toHaveText("Город свободен!");
        await expect(page.locator("#result-text")).toContainText("Сьюзи спасена");
        await page.getByRole("button", { name: "Ещё раз", exact: true }).click();
        await skipIntro(page);
        await expect(page.locator("#level-name")).toContainText(location.title);
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
          const { x, y, coverY, civilian, slot } = scene.targets[0];
          return { x, y, coverY, civilian, slot, slots: scene.slots.length };
        });
        expect(target.slot).toBe(target.slots - 1);
        expect(target.civilian).toBe(false);
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
}

for (const location of locations) {
  test(`all active ${location.id} positions use matching rendered sizes, hit areas and civilian penalties`, async ({ page }) => {
    await unlock(page);
    await page.goto("/");
    await skipPrologue(page);
    await mapButton[location.id](page).click();
    await page.getByRole("button", { name: /02.*Мирные жители/ }).click();
    await skipIntro(page);
    await page.getByRole("button", { name: "Пауза", exact: true }).click();
    await expect(page.locator(".saloon-transition")).toHaveCount(0);
    const positions = await page.evaluate(async () => {
      const { game } = await import("/src/main.ts");
      const scene = game.scene.getScene("town") as any;
      for (const target of scene.targets) target.view.destroy();
      scene.nextSpawn = Infinity;
      scene.targets = scene.slots.map((slot: any, i: number) => ({ ...slot, slot: i, civilian: i === 2, expires: Infinity, view: scene.person(slot.x, slot.y, i === 2) }));
      return scene.targets.map((target: any) => ({ x: target.x, y: target.y, scale: target.scale,
        rendered: target.view.scaleX, bodyY: target.bodyY, renderedY: target.view.y }));
    });
    for (const position of positions) {
      expect(position.rendered).toBe(position.scale);
      expect(position.renderedY).toBeCloseTo(position.bodyY, 5);
    }
    await page.screenshot({ path: `test-results/${location.id}-all-targets.png`, fullPage: true });
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
    for (const [i, position] of positions.entries()) {
      if (i > 0 && i % 6 === 0) {
        await page.getByRole("button", { name: /Перезарядить/ }).click();
        await expect(page.locator("#stats")).toContainText("Патроны 6/6");
      }
      await shot(page, position.x, position.y);
    }
    expect(await page.evaluate(async () => {
      const { game } = await import("/src/main.ts");
      const scene = game.scene.getScene("town") as any;
      return { kills: scene.kills, lives: scene.lives, ammo: scene.ammo, remaining: scene.targets.length };
    })).toEqual({ kills: positions.length - 1, lives: 2,
      ammo: positions.length % 6 ? 6 - positions.length % 6 : 0, remaining: 0 });
  });

  test(`offline touch selection and ${location.id} fit narrow screens and rotation without storage`, async ({ browser }) => {
    const context = await browser.newContext({ offline: true, viewport: { width: 280, height: 653 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors: string[] = [], requests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => requests.push(request.url()));
    await page.setContent(await readFile("lastshot.html", "utf8"));
    await skipPrologue(page);
    await mapButton[location.id](page).tap();
    await expect(mapButton[location.id](page)).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: /01.*Первый выстрел/ }).tap();
    await skipIntro(page, true);
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
    await expect(mapButton[location.id](page)).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
    expect(requests).toEqual([]);
    await context.close();
  });
}

test("tavern curved foreground masks the waist and blocks covered shots at the current person scale", async ({ page }) => {
  await unlock(page);
  await page.goto("/");
  await skipPrologue(page);
  await tavernButton(page).click();
  await page.getByRole("button", { name: /02.*Мирные жители/ }).click();
  await skipIntro(page);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await expect(page.locator(".saloon-transition")).toHaveCount(0);
  const mask = await page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    const { coverTopAt } = await import("/src/maps.js");
    const scene = game.scene.getScene("town") as any;
    for (const target of scene.targets) target.view.destroy();
    const slot = scene.slots[1];
    scene.targets = [{ ...slot, slot: 1, civilian: false, expires: Infinity, view: scene.person(slot.x, slot.y, false) }];
    scene.nextSpawn = Infinity;
    const image = scene.children.getByName("cover-round-table") as any;
    const canvas = document.createElement("canvas");
    const source = image.texture.getSourceImage();
    canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(source, 0, 0);
    const alpha = (x: number, y: number) => {
      const local = image.getWorldTransformMatrix().applyInverse(x, y);
      return context.getImageData(Math.round(local.x + image.displayOriginX),
        Math.round(local.y + image.displayOriginY), 1, 1).data[3];
    };
    const samples = [slot.x, slot.x + Math.min(20, 30 * slot.scale)].map((x) => {
      const edge = coverTopAt(x, slot);
      return [alpha(x, edge - 3), alpha(x, edge + 3)];
    });
    return { samples, x: slot.x, aimY: slot.y, coveredY: coverTopAt(slot.x, slot) + 3 };
  });
  expect(mask.samples).toEqual([[0, 255], [0, 255]]);
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await shot(page, mask.x, mask.coveredY);
  await expect(page.locator("#stats")).toContainText("0/12");
  await shot(page, mask.x, mask.aimY);
  await expect(page.locator("#stats")).toContainText("1/12");
});
