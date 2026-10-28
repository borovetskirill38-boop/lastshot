import { skipPrologue, skipIntro, setBossRandom } from "./helpers";
import { test, expect, Page } from "@playwright/test";
async function scene<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(async (source) => {
    const mod = await import("/src/main.ts");
    const s = mod.game.scene.getScene("town");
    return new Function("s", `return (${source})(s)`)(s);
  }, fn);
}
async function shoot(page: Page, x: number, y: number) {
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw Error("Missing canvas");
  const before = await scene<number>(page, "s=>s.ammo");
  await page.mouse.click(
    box.x + (x * box.width) / 960,
    box.y + (y * box.height) / 540,
  );
  if (before > 0)
    await expect.poll(() => scene<number>(page, "s=>s.ammo")).toBe(before - 1);
}
test("first level is endless until three misses", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await skipPrologue(page);
  await expect(page.locator("canvas")).toBeAttached();
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
  await skipIntro(page);
  await expect(page.locator("#life-count")).toHaveText("3/3");
  // Pace real spawns so browser/reload latency cannot expire unrelated targets.
  // This scenario checks eight hits followed by exactly three deliberate misses.
  await scene(page, "s=>{s.nextSpawn=Infinity;}");
  for (let i = 0; i < 8; i++) {
    if (i === 6) {
      await page.getByRole("button", { name: /Перезарядить/ }).click();
      await expect.poll(() => scene(page, "s=>s.ammo")).toBe(6);
    }
    await scene(page, "s=>{s.nextSpawn=s.clock;}");
    await expect
      .poll(() => scene<number>(page, "s=>s.targets.length"))
      .toBeGreaterThan(0);
    const target = await scene<{ x: number; y: number }>(
      page,
      "s=>{s.nextSpawn=Infinity;return {x:s.targets[0].x,y:s.targets[0].y};}",
    );
    await shoot(page, target.x, target.y);
    expect(await scene(page, "s=>s.kills")).toBe(i + 1);
  }
  expect(await scene(page, "s=>s.lives")).toBe(3);
  expect(await scene(page, "s=>s.ended")).toBe(false);
  await expect(page.locator("#result")).toBeHidden();
  await shoot(page, 20, 500);
  expect(await scene(page, "s=>s.lives")).toBe(2);
  await expect(page.locator("#life-count")).toHaveText("2/3");
  await shoot(page, 20, 500);
  await shoot(page, 20, 500);
  await expect(page.locator("#result-title")).toHaveText("Конец игры");
  await expect(page.locator("#result")).toHaveCSS("position", "fixed");
  await expect(page.locator("#life-count")).toHaveText("0/3");
  await expect(page.locator("#result-text")).toContainText("800 очков");
  await expect(
    page.getByRole("button", { name: "Начать заново" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Главное меню" }),
  ).toBeVisible();
  await page.reload();
  await skipPrologue(page);
  await expect(
    page.getByRole("button", { name: /02.*Мирные жители/ }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: /03.*Быстрая рука/ }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});
test("civilian costs life, pause freezes timers, misses and defeat", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "lastshot-progress",
      JSON.stringify({ unlocked: 5, best: [] }),
    ),
  );
  await page.goto("/");
  await skipPrologue(page);
  await expect(page.locator("canvas")).toBeAttached();
  await page.getByRole("button", { name: /02.*Мирные жители/ }).click();
  await skipIntro(page);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  const time = await scene<number>(page, "s=>s.nextSpawn-s.clock");
  await page.waitForTimeout(400);
  expect(
    Math.abs((await scene<number>(page, "s=>s.nextSpawn-s.clock")) - time),
  ).toBeLessThan(70);
  await page.getByRole("button", { name: "Продолжить" }).click(); // Force RNG only, keeping actual spawn, hit testing and life rules.
  await page.evaluate(() => {
    Math.random = () => 0;
  });
  await expect
    .poll(() => scene(page, "s=>s.targets.some(t=>t.civilian)"))
    .toBe(true);
  const t = await scene<{ x: number; y: number }>(
    page,
    "s=>s.targets.find(t=>t.civilian)",
  );
  await shoot(page, t.x, t.y);
  expect(await scene(page, "s=>s.lives")).toBe(2);
});
test("boss takes six hits and campaign completes", async ({ page }) => {
  test.setTimeout(45000);
  await page.addInitScript(() =>
    localStorage.setItem(
      "lastshot-progress",
      JSON.stringify({ unlocked: 5, best: [] }),
    ),
  );
  await page.goto("/");
  await skipPrologue(page);
  await expect(page.locator("canvas")).toBeAttached();
  await page.getByRole("button", { name: /Шериф Картер против Билли Пули/ }).click();
  await setBossRandom(page, [0.1, 0.9, 0.9, 0.1, 0.1, 0.9]);
  await skipIntro(page);
  await expect.poll(() => scene(page, "s=>s.bossOpen")).toBe(true);
  for (let i = 0; i < 6; i++) {
    await expect
      .poll(() => scene(page, "s=>s.bossOpen && s.encounter.nextAt-s.clock>500"), { timeout: 6000 })
      .toBe(true);
    const position = await scene<{ x: number; y: number }>(page, "s=>s.bossPosition");
    await shoot(page, position.x, position.y);
    expect(await scene(page, "s=>s.bossHP")).toBe(5 - i);
  }
  await expect(page.locator("#result-title")).toHaveText("Город свободен!");
  await expect(page.locator("#next")).toBeHidden();
  await page.getByRole("button", { name: "Ещё раз" }).click();
  await setBossRandom(page, [0.9]);
  await skipIntro(page);
  await expect.poll(() => scene(page, "s=>s.bossOpen")).toBe(true);
  expect(await scene(page, "s=>s.bossHP")).toBe(6);
});
test("mobile touch shoots and reloads", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await skipPrologue(page);
  await page.getByRole("button", { name: "Переключить звук" }).tap();
  await expect(page.locator("#sound")).toHaveText("Звук: вкл.");
  await expect(page.locator("canvas")).toBeAttached();
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).tap();
  await skipIntro(page, true);
  const box = await page.locator("canvas").boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  await page.touchscreen.tap(box!.x + 10, box!.y + 10);
  expect(await scene(page, "s=>s.ammo")).toBe(5);
  await page.getByRole("button", { name: /Перезарядить/ }).tap();
  await expect.poll(() => scene(page, "s=>s.ammo")).toBe(6);
  await context.close();
});

test("view model tracks aim, fires at the muzzle, ejects brass and freezes on pause", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await skipPrologue(page);
  await expect(page.locator("canvas")).toBeAttached();
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
  await skipIntro(page);
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const box = await page.locator("canvas").boundingBox();
  const startX = await scene<number>(page, "s=>s.weapon.view.x");
  await page.mouse.move(box!.x + box!.width * 0.85, box!.y + box!.height * 0.4);
  await expect
    .poll(() => scene<number>(page, "s=>s.weapon.view.x"))
    .toBeGreaterThan(startX + 15);
  await expect
    .poll(() => scene<number>(page, "s=>s.targets.length"))
    .toBeGreaterThan(0);
  // Inspect the first animation frame deterministically, before a frame can expire.
  const fired = await scene<any>(
    page,
    `s=>{s.shoot(815,216);s.togglePause();return {ammo:s.ammo,flash:s.weapon.flash.visible,shells:s.weapon.shells.length,muzzle:s.weapon.muzzle(),flare:s.weapon.flash.getWorldTransformMatrix().transformPoint(0,0),flashAlpha:s.weapon.flash.alpha,texture:s.weapon.model.texture.key,view:s.weapon.view.x};}`,
  );
  expect(fired.ammo).toBe(5);
  expect(fired.flash).toBe(true);
  expect(fired.flashAlpha).toBeGreaterThan(0.5);
  expect(fired.texture).toBe("revolver-hand");
  expect(Math.hypot(fired.flare.x - fired.muzzle.x, fired.flare.y - fired.muzzle.y)).toBeLessThan(0.001);
  expect(fired.shells).toBe(1);
  expect(fired.muzzle.y).toBeGreaterThan(340);
  expect(fired.muzzle.y).toBeLessThan(500);
  const frozen = await scene(
    page,
    "s=>({shell:s.weapon.shells[0].view.x,flash:s.weapon.flashRemaining,recoil:s.weapon.recoil})",
  );
  await page.waitForTimeout(250);
  expect(
    await scene(
      page,
      "s=>({shell:s.weapon.shells[0].view.x,flash:s.weapon.flashRemaining,recoil:s.weapon.recoil})",
    ),
  ).toEqual(frozen);
  await page.screenshot({
    path: "test-results/weapon-flash.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect.poll(() => scene(page, "s=>s.weapon.flash.visible")).toBe(false);
  await expect.poll(() => scene(page, "s=>s.weapon.shells.length")).toBe(0);
  await page.getByRole("button", { name: /Перезарядить/ }).click();
  const ammo = await scene<number>(page, "s=>s.ammo");
  const blocked = await scene<any>(
    page,
    "s=>{s.shoot(20,500);return {ammo:s.ammo,shells:s.weapon.shells.length};}",
  );
  expect(blocked.ammo).toBe(ammo);
  expect(blocked.shells).toBe(0);
  await page.getByRole("button", { name: "← Уровни" }).click();
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
  await skipIntro(page);
  expect(await scene(page, "s=>s.weapon.shells.length")).toBe(0);
  expect(await scene(page, "s=>s.weapon.flash.visible")).toBe(false);
  expect(errors).toEqual([]);
});
