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
  if(before>0) await expect.poll(()=>scene<number>(page,"s=>s.ammo")).toBe(before-1);
}
test("first level, reload, unlock and persistence", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("canvas")).toBeAttached();
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
  for (let i = 0; i < 8; i++) {
    if (i === 6) {
      await page.getByRole("button", { name: /Перезарядить/ }).click();
      await expect.poll(() => scene(page, "s=>s.ammo")).toBe(6);
    }
    await expect
      .poll(() => scene<number>(page, "s=>s.targets.length"))
      .toBeGreaterThan(0);
    const target = await scene<{ x: number; y: number }>(
      page,
      "s=>({x:s.targets[0].x,y:s.targets[0].y})",
    );
    await shoot(page, target.x, target.y);
  }
  await expect(page.locator("#result-title")).toHaveText(
    "Отличный выстрел, шериф!",
  );
  await expect(page.locator("#result-text")).toContainText("800 очков");
  await page.reload();
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
  await expect(page.locator("canvas")).toBeAttached();
  await page.getByRole("button", { name: /02.*Мирные жители/ }).click();
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
  await page.getByRole("button", { name: "← Уровни" }).click();
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
  for (let i = 0; i < 7; i++) await shoot(page, 20, 500);
  expect(await scene(page, "s=>s.ammo")).toBe(0);
  await expect(page.locator("#result-title")).toHaveText(
    "Город ждёт твоего возвращения",
    { timeout: 12000 },
  );
});
test("boss takes six hits and campaign completes", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "lastshot-progress",
      JSON.stringify({ unlocked: 5, best: [] }),
    ),
  );
  await page.goto("/");
  await expect(page.locator("canvas")).toBeAttached();
  await page.getByRole("button", { name: /Шериф против главаря/ }).click();
  await expect.poll(() => scene(page, "s=>s.bossOpen")).toBe(true);
  for (let i = 0; i < 6; i++) {
    await expect.poll(()=>scene(page,"s=>s.bossOpen && s.nextSpawn-s.clock>500")).toBe(true);
    await shoot(page,480,315);
    expect(await scene(page,"s=>s.bossHP")).toBe(5-i);
  }
  await expect(page.locator("#result-title")).toHaveText("Город свободен!");
  await expect(page.locator("#next")).toBeHidden();
  await page.getByRole("button", { name: "Ещё раз" }).click();
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
  await expect(page.locator("canvas")).toBeAttached();
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).tap();
  const box = await page.locator("canvas").boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  await page.touchscreen.tap(box!.x + 10, box!.y + 10);
  expect(await scene(page, "s=>s.ammo")).toBe(5);
  await page.getByRole("button", { name: /Перезарядить/ }).tap();
  await expect.poll(() => scene(page, "s=>s.ammo")).toBe(6);
  await context.close();
});
