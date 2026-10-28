import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { skipPrologue, skipIntro } from "./helpers";

const additions = [
  { id: "dust-trail", name: "Пыльный тракт", capacity: 10, frame: "trail", reloadMs: 2100, map: "saloon" },
  { id: "mountain-guard", name: "Горный страж", capacity: 1, frame: "buffalo", reloadMs: 1400, map: "street" },
  { id: "coach-thunder", name: "Короткий гром", capacity: 2, frame: "coach", reloadMs: 1600, map: "tavern" },
  { id: "silver-sunset", name: "Серебряный закат", capacity: 2, frame: "hunting", reloadMs: 1900, map: "saloon" },
];

for (const spec of additions) {
  test(`${spec.name}: model, live ammunition, pause-safe reload and independent persistent statistics`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(map => {
      localStorage.setItem("lastshot-progress", JSON.stringify({ unlocked: 5, best: [] }));
      localStorage.setItem("lastshot-map", map);
    }, spec.map);
    await page.goto("/");
    await skipPrologue(page);
    await page.getByRole("button", { name: /^Арсенал/ }).click();
    await expect(page.locator(".weapon-card")).toHaveCount(7);
    await page.getByRole("button", { name: spec.name, exact: true }).click();
    await expect(page.locator("#weapon-capacity")).toHaveText(String(spec.capacity));
    await expect(page.locator("#weapon-reload")).toHaveText(`${(spec.reloadMs / 1000).toLocaleString("ru-RU")} с`);
    await expect(page.locator("#weapon-cartridge")).not.toBeEmpty();
    await expect(page.locator("#weapon-mechanism")).not.toBeEmpty();
    await expect(page.locator("#weapon-preview")).toHaveAttribute("aria-label", new RegExp(spec.name));
    await page.locator("#equip-weapon").click();
    await page.locator("#arsenal-back").click();
    await page.getByRole("button", { name: /02.*Мирные жители/ }).click();
    await skipIntro(page);
    await expect(page.locator("#ammo-rounds i")).toHaveCount(spec.capacity);
    const fired = await page.evaluate(async () => {
      const { game } = await import("/src/main.ts");
      const s = game.scene.getScene("town") as any;
      s.nextSpawn = Infinity;
      for (const t of s.targets) t.view.destroy();
      const p = s.slots[0];
      s.targets = [{ ...p, slot: 0, civilian: false, expires: Infinity, view: s.person(p.x, p.y, false) }];
      s.shoot(p.x, p.y);
      s.togglePause();
      const muzzle = s.weapon.muzzle();
      const flare = s.weapon.flash.getWorldTransformMatrix().transformPoint(0, 0);
      s.shoot(10, 10); // Paused input must not spend another cartridge.
      return { ammo: s.ammo, kills: s.kills, texture: s.weapon.model.texture.key,
        frame: s.weapon.model.frame.name, shells: s.weapon.shells.length,
        delta: Math.hypot(muzzle.x - flare.x, muzzle.y - flare.y), flash: s.weapon.flash.visible,
        clock: s.clock, recoil: s.weapon.recoil };
    });
    expect(fired).toMatchObject({ ammo: spec.capacity - 1, kills: 1, texture: "long-gun-models", frame: spec.frame,
      shells: spec.id === "dust-trail" ? 1 : 0, flash: true });
    expect(fired.delta).toBeLessThan(0.001);
    await page.screenshot({ path: `test-results/${spec.id}.png`, fullPage: true });
    await page.waitForTimeout(150);
    expect(await page.evaluate(async () => {
      const { game } = await import("/src/main.ts");
      const s = game.scene.getScene("town") as any;
      return { clock: s.clock, recoil: s.weapon.recoil };
    })).toEqual({ clock: fired.clock, recoil: fired.recoil });
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
    await page.locator("#reload").click();
    const reload = await page.evaluate(async () => {
      const { game } = await import("/src/main.ts");
      const s = game.scene.getScene("town") as any;
      s.shoot(10, 10); // Reload input also must not change statistics.
      const result = { ammo: s.ammo, remaining: s.reloadEnd - s.clock, shells: s.weapon.shells.length };
      s.togglePause();
      return result;
    });
    expect(reload.ammo).toBe(spec.capacity - 1);
    expect(reload.remaining).toBeGreaterThan(spec.reloadMs - 500);
    expect(reload.remaining).toBeLessThanOrEqual(spec.reloadMs);
    if (spec.id !== "dust-trail") expect(reload.shells).toBe(1);
    await page.waitForTimeout(100);
    await expect(page.locator("#stats")).toContainText(`Патроны ${spec.capacity - 1}/${spec.capacity}`);
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
    await expect(page.locator("#stats")).toContainText(`Патроны ${spec.capacity}/${spec.capacity}`);

    // Exercise civilian and miss accounting, including the one-shot rifle's empty chamber.
    await page.evaluate(async () => {
      const { game } = await import("/src/main.ts");
      const s = game.scene.getScene("town") as any;
      const p = s.slots[0];
      s.targets = [{ ...p, slot: 0, civilian: true, expires: Infinity, view: s.person(p.x, p.y, true) }];
      s.shoot(p.x, p.y);
      if (s.ammo === 0) {
        s.shoot(10, 10); // Empty input must not count as a miss.
        s.reload(); s.update(0, s.reloadEnd - s.clock);
      }
      s.shoot(10, 10);
      s.togglePause();
    });
    await page.getByRole("button", { name: "← Уровни", exact: true }).click();
    await page.reload();
    await skipPrologue(page);
    await page.getByRole("button", { name: /^Арсенал/ }).click();
    await expect(page.locator("#weapon-name")).toHaveText(spec.name);
    await expect(page.locator("#weapon-hits")).toHaveText("2");
    await expect(page.locator("#weapon-civilians")).toHaveText("1");
    await expect(page.locator("#weapon-misses")).toHaveText("1");
    const stats = await page.evaluate(() => JSON.parse(localStorage.getItem("lastshot-arsenal")!).stats);
    expect(stats["last-word"]).toEqual({ hits: 0, misses: 0, civilianHits: 0 });
    expect(errors).toEqual([]);
  });
}

test("all seven inventory icons and long gun models work in the offline mobile HTML", async ({ browser }) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ offline: true, viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [], requests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => requests.push(request.url()));
  await page.setContent(await readFile("lastshot.html", "utf8"));
  await skipPrologue(page);
  for (const spec of additions) {
    await page.getByRole("button", { name: /^Арсенал/ }).tap();
    await page.getByRole("button", { name: spec.name, exact: true }).tap();
    const icon = await page.locator("#weapon-preview image").getAttribute("href");
    expect(icon).toMatch(/^data:image\/webp;base64,/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator("#equip-weapon").tap();
    await page.locator("#arsenal-back").tap();
    await page.locator(".level").first().tap();
    await skipIntro(page, true);
    await expect(page.locator("#stats")).toContainText(`Патроны ${spec.capacity}/${spec.capacity}`);
    const canvas = await page.locator("canvas").boundingBox();
    await page.touchscreen.tap(canvas!.x + canvas!.width * 0.03, canvas!.y + canvas!.height * 0.03);
    await expect(page.locator("#stats")).toContainText(`Патроны ${spec.capacity - 1}/${spec.capacity}`);
    await page.locator("#reload").tap();
    await expect(page.locator("#stats")).toContainText(`Патроны ${spec.capacity}/${spec.capacity}`);
    await page.locator("#back").tap();
  }
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});
