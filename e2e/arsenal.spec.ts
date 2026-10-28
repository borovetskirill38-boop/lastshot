import { skipPrologue, skipIntro } from "./helpers";
import { test, expect } from "@playwright/test";

const pocket = "Пыльный спутник", long = "Дальний дозор", classic = "Последний довод";
const save = (page: any) => page.evaluate(() => JSON.parse(localStorage.getItem("lastshot-arsenal")!));
async function open(page: any) {
  await page.getByRole("button", { name: /^Арсенал/ }).click();
  await expect(page.locator("#arsenal")).toBeVisible();
}
async function equip(page: any, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Взять оружие", exact: true }).click();
}
async function back(page: any) {
  await page.getByRole("button", { name: "← Главное меню", exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("lastshot-progress", JSON.stringify({ unlocked: 5, best: [] })));
});

test("weapon choice changes capacity and viewmodel, reloads to that capacity and survives refresh", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await skipPrologue(page);
  for (const [name, capacity, frame] of [[pocket, 5, "pocket"], [long, 8, "long"]] as const) {
    await open(page);
    await equip(page, name);
    await expect(page.locator("#weapon-capacity")).toHaveText(String(capacity));
    await back(page);
    await expect(page.locator("#loadout-label")).toHaveText(name);
    await page.getByRole("button", { name: /02.*Мирные жители/ }).click();
    await skipIntro(page);
    await expect(page.locator("#stats")).toContainText(`Патроны ${capacity}/${capacity}`);
    await expect(page.locator("#ammo-rounds i")).toHaveCount(capacity);
    const visual = await page.evaluate(async () => {
      const { game } = await import("/src/main.ts");
      const s = game.scene.getScene("town") as any;
      s.nextSpawn = Infinity;
      s.shoot(20, 20);
      s.togglePause();
      const muzzle = s.weapon.muzzle();
      const flare = s.weapon.flash.getWorldTransformMatrix().transformPoint(0, 0);
      const result = { frame: s.weapon.model.frame.name, texture: s.weapon.model.texture.key, delta: Math.hypot(muzzle.x - flare.x, muzzle.y - flare.y) };
      s.togglePause();
      return result;
    });
    expect(visual.frame).toBe(frame);
    expect(visual.texture).toBe("arsenal-models");
    expect(visual.delta).toBeLessThan(0.001);
    await page.getByRole("button", { name: /Перезарядить/ }).click();
    await expect(page.locator("#stats")).toContainText(`Патроны ${capacity}/${capacity}`);
    await page.getByRole("button", { name: "← Уровни" }).click();
  }
  await page.reload();
  await skipPrologue(page);
  await open(page);
  await expect(page.locator("#weapon-name")).toHaveText(long);
  await expect(page.locator("#equip-weapon")).toBeDisabled();
  await expect(page.locator("#weapon-misses")).toHaveText("1");
  expect(errors).toEqual([]);
});

test("hits, misses and civilian hits are counted once, ignore blocked shots and expiry, and stay separate per weapon", async ({ page }) => {
  await page.goto("/");
  await skipPrologue(page);
  await open(page);
  await equip(page, pocket);
  await back(page);
  await page.getByRole("button", { name: /02.*Мирные жители/ }).click();
  await skipIntro(page);
  await page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    const s = game.scene.getScene("town") as any;
    s.nextSpawn = Infinity;
    for (const t of s.targets) t.view.destroy();
    s.targets = [];
    const position = s.slots[0];
    const target = (civilian: boolean, expires = Infinity) => s.targets.push({ ...position, slot: 0, civilian, expires, view: { destroy() {} } });
    target(false); s.shoot(position.x, position.y);
    target(true); s.shoot(position.x, position.y);
    s.shoot(20, 20);
    s.togglePause(); s.shoot(20, 20); s.togglePause();
    const ammo = s.ammo; s.ammo = 0; s.shoot(20, 20); s.ammo = ammo;
    s.reload(); s.shoot(20, 20);
    target(false, s.clock - 1); s.update(0, 1);
  });
  await expect(page.locator("#stats")).toContainText("Патроны 5/5");
  const state = await save(page);
  expect(state.stats["dust-companion"]).toEqual({ hits: 2, misses: 1, civilianHits: 1 });
  expect(state.stats["last-word"]).toEqual({ hits: 0, misses: 0, civilianHits: 0 });
  await page.getByRole("button", { name: "← Уровни" }).click();
  await open(page);
  await expect(page.locator("#weapon-hits")).toHaveText("2");
  await expect(page.locator("#weapon-civilians")).toHaveText("1");
  await page.getByRole("button", { name: classic, exact: true }).click();
  await expect(page.locator("#weapon-hits")).toHaveText("0");
  await page.getByRole("button", { name: "Взять оружие", exact: true }).click();
  await back(page);
  await page.getByRole("button", { name: /Шериф Картер против Билли Пули/ }).click();
  await skipIntro(page);
  await page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    const s = game.scene.getScene("town") as any;
    s.encounter.nextAt = Infinity;
    const position = s.encounter.position;
    s.shoot(position.x, position.y);
    s.encounter.phase = "exposed"; s.encounter.hp = 2;
    s.shoot(position.x, position.y);
    s.encounter.phase = "exposed";
    s.shoot(position.x, position.y); s.shoot(position.x, position.y);
  });
  const final = await save(page);
  expect(final.stats["last-word"]).toEqual({ hits: 2, misses: 1, civilianHits: 0 });
  expect(final.stats["dust-companion"]).toEqual(state.stats["dust-companion"]);
  await page.reload();
  await skipPrologue(page);
  await open(page);
  await page.getByRole("button", { name: pocket, exact: true }).click();
  await expect(page.locator("#weapon-hits")).toHaveText("2");
  await expect(page.locator("#weapon-misses")).toHaveText("1");
});

test("unavailable storage keeps selection and statistics working for the session", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "lastshot-arsenal") throw Error("quota exceeded");
      return original.call(this, key, value);
    };
  });
  await page.goto("/");
  await skipPrologue(page);
  await open(page);
  await equip(page, pocket);
  await expect(page.locator("#arsenal-save-note")).toContainText("Сохранение недоступно");
  await back(page);
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
  await skipIntro(page);
  await expect(page.locator("#stats")).toContainText("Патроны 5/5");
  await page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    (game.scene.getScene("town") as any).shoot(20, 20);
  });
  await page.getByRole("button", { name: "← Уровни" }).click();
  await open(page);
  await expect(page.locator("#weapon-misses")).toHaveText("1");
});
