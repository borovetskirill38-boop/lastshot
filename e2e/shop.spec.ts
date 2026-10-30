import { test, expect, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { emptyArsenal, weapons, economy } from "../src/arsenal.js";
import { skipPrologue, skipIntro, offlineArsenal } from "./helpers";

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("lastshot-arsenal")!));
async function start(page: Page, index = 1) {
  await page.locator(".level").nth(index).click(); await skipIntro(page);
}
async function shootEnemies(page: Page, count: number, boss = false) {
  await page.evaluate(async ({ count, boss }) => {
    const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
    s.nextSpawn = Infinity; for (const t of s.targets) t.view.destroy(); s.targets = [];
    for (let i = 0; i < count; i++) {
      if (!s.ammo) { s.reload(); s.update(0, s.reloadEnd - s.clock); }
      if (boss) {
        s.encounter.phase = "exposed"; s.encounter.nextAt = Infinity;
        const p = s.encounter.position; s.shoot(p.x, p.y);
      } else {
        const p = s.slots[0];
        s.targets = [{ ...p, slot: 0, civilian: false, expires: Infinity, view: s.person(p.x, p.y, false) }];
        s.shoot(p.x, p.y);
      }
    }
  }, { count, boss });
}
async function unlock(page: Page) {
  await page.addInitScript(() => localStorage.setItem("lastshot-progress", JSON.stringify({ unlocked: 5, best: [] })));
}

test("fresh shop gates gear, a real victory pays the final hit and premium once, and an exact-price purchase survives reload", async ({ page }) => {
  await unlock(page); await page.goto("/"); await skipPrologue(page);
  await page.locator("#arsenal-open").click();
  await expect(page.locator("#arsenal-balance")).toHaveText("0");
  await expect(page.locator("#equip-weapon")).toBeDisabled();
  await page.getByRole("button", { name: weapons[2].name, exact: true }).click();
  await expect(page.locator("#buy-weapon")).toBeDisabled();
  await expect(page.locator("#weapon-purchase-note")).toContainText(weapons[1].name);
  await page.locator("#equip-weapon").evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator("#loadout-label")).toHaveText(weapons[0].name);
  await page.getByRole("button", { name: weapons[1].name, exact: true }).click();
  await expect(page.locator("#buy-weapon")).toBeDisabled();
  await expect(page.locator("#weapon-purchase-note")).toContainText(/Нужно ещё 1\s500/);
  await page.locator("#arsenal-back").click(); await start(page);
  await shootEnemies(page, 12);
  await expect(page.locator("#result")).toBeVisible();
  expect((await stored(page)).balance).toBe(1500);
  await expect(page.locator("#result-reward")).toContainText(/\+1\s500.*премия за победу: 300/);
  await page.evaluate(async () => {
    const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
    s.finish(true); s.finish(false); s.shoot(s.slots[0].x, s.slots[0].y);
  });
  expect((await stored(page)).balance).toBe(1500);
  await page.locator("#choose").click(); await page.locator("#arsenal-open").click();
  await page.getByRole("button", { name: weapons[1].name, exact: true }).click();
  await expect(page.locator("#buy-weapon")).toBeEnabled();
  await page.screenshot({ path: "test-results/shop-first-purchase.png", fullPage: true });
  await page.locator("#buy-weapon").click();
  await page.locator("#buy-weapon").evaluate((button: HTMLButtonElement) => button.click());
  const bought = await stored(page);
  expect(bought).toMatchObject({ version: 2, balance: 0, selected: weapons[1].id, owned: [weapons[0].id, weapons[1].id] });
  expect(bought.stats[weapons[0].id]).toEqual({ hits: 12, misses: 0, civilianHits: 0 });
  await expect(page.locator("#equip-weapon")).toBeDisabled();
  await page.locator("#arsenal-back").click(); await start(page);
  await expect(page.locator("#stats")).toContainText("Патроны 5/5");
  await page.locator("#back").click(); await page.reload(); await skipPrologue(page);
  expect(await stored(page)).toEqual(bought);
  await page.locator("#arsenal-open").click();
  await expect(page.locator("#weapon-name")).toHaveText(weapons[1].name);
  await page.getByRole("button", { name: weapons[0].name, exact: true }).click();
  await page.locator("#equip-weapon").click();
  expect((await stored(page)).balance).toBe(0);
});

test("all four finite modes credit their complete reward once and repeat clears earn it again", async ({ page }) => {
  await unlock(page); await page.goto("/"); await skipPrologue(page);
  let balance = 0;
  for (const mode of [{ i: 1, hits: 12 }, { i: 2, hits: 16 }, { i: 3, hits: 18 }, { i: 4, hits: 6 }, { i: 1, hits: 12 }]) {
    await start(page, mode.i); await shootEnemies(page, mode.hits, mode.i === 4);
    balance += mode.hits * economy.enemyBounty + economy.victoryBonuses[mode.i];
    await expect(page.locator("#result")).toBeVisible();
    expect((await stored(page)).balance).toBe(balance);
    await page.locator("#choose").click();
    expect((await stored(page)).balance).toBe(balance);
  }
});

test("earnings persist on early exit or defeat; civilians, empty/hidden/paused input and failed clears pay nothing", async ({ page }) => {
  await unlock(page); await page.goto("/"); await skipPrologue(page); await start(page);
  await shootEnemies(page, 4);
  await page.locator("#back").click();
  await expect(page.locator("#menu-wallet")).toHaveText("400");
  await page.reload(); await skipPrologue(page); await start(page);
  await shootEnemies(page, 1);
  await page.evaluate(async () => {
    const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
    const p = s.slots[0];
    s.targets = [{ ...p, slot: 0, civilian: true, expires: Infinity, view: s.person(p.x, p.y, true) }];
    s.shoot(p.x, p.y); s.shoot(20, 20);
    const ammo = s.ammo; s.ammo = 0; s.shoot(p.x, p.y); s.ammo = ammo;
    s.stance(true); s.update(0, 200); s.shoot(p.x, p.y);
    s.togglePause(); s.shoot(p.x, p.y); s.togglePause();
    s.finish(false); s.finish(true);
  });
  expect((await stored(page)).balance).toBe(500);
  await expect(page.locator("#result-reward")).toContainText("+100");
  await expect(page.locator("#result-reward")).not.toContainText("премия");
  await page.locator("#retry").click(); await skipIntro(page);
  expect((await stored(page)).balance).toBe(500);
});

test("the whole rack costs 33000, every purchase is permanent and double clicks cannot double-charge", async ({ page }) => {
  await page.addInitScript(state => {
    if (!localStorage.getItem("lastshot-arsenal")) localStorage.setItem("lastshot-arsenal", JSON.stringify(state));
  }, { ...emptyArsenal(), balance: 33000 });
  await page.goto("/"); await skipPrologue(page); await page.locator("#arsenal-open").click();
  let balance = 33000;
  for (const weapon of weapons.slice(1)) {
    await page.getByRole("button", { name: weapon.name, exact: true }).click();
    await page.locator("#buy-weapon").evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    balance -= weapon.price;
    expect((await stored(page)).balance).toBe(balance);
    await expect(page.locator("#loadout-label")).toHaveText(weapon.name);
  }
  const before = await stored(page);
  expect(before.balance).toBe(0); expect(before.owned).toEqual(weapons.map(w => w.id));
  await page.reload(); await skipPrologue(page);
  expect(await stored(page)).toEqual(before);
});

test("old bandit hits become buying points once without changing campaign progress or shot statistics", async ({ page }) => {
  await unlock(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem("lastshot-arsenal")) localStorage.setItem("lastshot-arsenal", JSON.stringify({
      version: 1, selected: "silver-sunset", stats: { "last-word": { hits: 20, misses: 7, civilianHits: 2 } },
    }));
  });
  await page.goto("/"); await skipPrologue(page); await page.locator("#arsenal-open").click();
  await expect(page.locator("#arsenal-balance")).toHaveText(/1\s800/);
  await expect(page.locator("#loadout-label")).toHaveText(weapons[0].name);
  await page.getByRole("button", { name: weapons[1].name, exact: true }).click(); await page.locator("#buy-weapon").click();
  await page.reload(); await skipPrologue(page);
  const state = await stored(page);
  expect(state.balance).toBe(300); expect(state.selected).toBe(weapons[1].id);
  expect(state.stats[weapons[0].id]).toEqual({ hits: 20, misses: 7, civilianHits: 2 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("lastshot-progress")!).unlocked)).toBe(5);
});

for (const blocked of [false, true]) {
  test(`offline touch purchase works at 320px with ${blocked ? "blocked writes" : "a local save"}`, async ({ browser }) => {
    const context = await browser.newContext({ offline: true, viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
    try {
      const page = await context.newPage(), errors: string[] = [], requests: string[] = [];
      page.on("pageerror", e => errors.push(e.message)); page.on("request", r => requests.push(r.url()));
      await offlineArsenal(page, { ...emptyArsenal(), balance: 1500 });
      if (blocked) await page.evaluate(() => { localStorage.setItem = () => { throw Error("quota"); }; });
      await page.setContent(await readFile("lastshot.html", "utf8")); await skipPrologue(page);
      await page.locator("#arsenal-open").tap();
      await page.getByRole("button", { name: weapons[1].name, exact: true }).tap();
      await page.locator("#buy-weapon").tap();
      await expect(page.locator("#arsenal-balance")).toHaveText("0");
      await expect(page.locator("#loadout-label")).toHaveText(weapons[1].name);
      if (blocked) await expect(page.locator("#arsenal-save-note")).toContainText("Сохранение недоступно");
      else expect((await stored(page)).owned).toEqual([weapons[0].id, weapons[1].id]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: `test-results/shop-mobile-${blocked}.png`, fullPage: true });
      await page.locator("#arsenal-back").tap(); await page.locator(".level").first().tap(); await skipIntro(page, true);
      await expect(page.locator("#stats")).toContainText("Патроны 5/5");
      expect(errors).toEqual([]); expect(requests).toEqual([]);
    } finally { await context.close(); }
  });
}
