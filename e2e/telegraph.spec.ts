import { test, expect, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { solveRelay, turnsFor } from "../tests/relay-solver.mjs";
import { skipPrologue, skipIntro, ownedArsenal, offlineArsenal } from "./helpers";

async function boardInDialog(page: Page) {
  return page.locator(".relay-contact").evaluateAll(nodes => ({
    tiles: nodes.map(node => {
      const label = node.getAttribute("aria-label")!;
      return (label.includes("север") ? 1 : 0) | (label.includes("восток") ? 2 : 0)
        | (label.includes("юг") ? 4 : 0) | (label.includes("запад") ? 8 : 0);
    }),
    entry: Math.floor(nodes.findIndex(node => node.classList.contains("relay-input")) / 4),
    exit: Math.floor(nodes.findIndex(node => node.classList.contains("relay-output")) / 4),
  }));
}
async function solveVisible(page: Page, touch = false) {
  const board = await boardInDialog(page), path = solveRelay(board);
  expect(path).not.toBeNull();
  for (const { cell, mask } of path!) {
    const turns = turnsFor(board.tiles[cell], mask), button = page.locator(`.relay-contact[data-cell="${cell}"]`);
    for (let i = 0; i < turns; i++) { if (touch) await button.tap(); else await button.click(); }
  }
  await expect(page.locator("#relay-connect")).toBeEnabled();
  if (touch) await page.locator("#relay-connect").tap(); else await page.locator("#relay-connect").click();
  await expect(page.locator("#relay-dialog")).not.toBeVisible();
}
async function travel(page: Page, direction: "left" | "right", touch = false) {
  const button = page.locator(`#move-${direction}`);
  if (touch) await button.tap(); else await button.click();
  await expect(page.locator("#play")).toHaveAttribute("data-cover", "safe");
  await expect(button).toBeEnabled(); // Call only when another move in this direction remains.
}
async function fresh(page: Page, map = "saloon") {
  await page.goto("/"); await skipPrologue(page);
  await page.locator(`.map-card[data-map="${map}"]`).click();
  await page.locator("#telegraph-start").click(); await skipIntro(page);
}

for (const map of ["saloon", "street", "tavern"]) {
  test(`${map}: connect every circuit without firing, earn one reward, preserve the campaign and reset cleanly`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await fresh(page, map);
    const beforeProgress = await page.evaluate(() => localStorage.getItem("lastshot-progress"));
    await expect(page.locator("#relay-interact")).toBeDisabled();
    await page.keyboard.press("e"); await expect(page.locator("#relay-dialog")).not.toBeVisible();
    await page.keyboard.press("s"); await expect(page.locator("#relay-interact")).toBeEnabled();
    for (const station of [1, 0, 2]) {
      if (station === 0) {
        await page.locator("#move-left").click(); await expect(page.locator("#play")).toHaveAttribute("data-cover", "safe");
      } else if (station === 2) {
        await travel(page, "right");
        await page.locator("#move-right").click(); await expect(page.locator("#play")).toHaveAttribute("data-cover", "safe");
      }
      await page.keyboard.press("e"); await expect(page.locator("#relay-dialog")).toBeVisible();
      await solveVisible(page);
    }
    await expect(page.locator("#result-title")).toHaveText("Телеграф ожил!");
    await expect(page.locator("#next")).toBeHidden();
    await expect(page.locator("#stats")).toContainText("Патроны 6/6");
    const result = await page.evaluate(async () => {
      const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
      s.finish(true); s.finish(false);
      return { phase: s.relay.phase, done: s.relay.restored, kills: s.kills,
        money: JSON.parse(localStorage.getItem("lastshot-arsenal")!),
        record: JSON.parse(localStorage.getItem("lastshot-telegraph")!),
        progress: localStorage.getItem("lastshot-progress"), objects: s.relayView.layer.list.length };
    });
    expect(result).toMatchObject({ phase: "won", done: 3, kills: 0, money: { balance: 1200 }, record: { wins: 1 }, progress: beforeProgress, objects: 9 });
    expect(result.money.stats["last-word"]).toEqual({ hits: 0, misses: 0, civilianHits: 0 });
    expect(result.record.bestMs).toBeGreaterThan(0); expect(result.record.bestMs).toBeLessThan(120000);
    await page.screenshot({ path: `test-results/telegraph-win-${map}.png`, fullPage: true });
    await page.locator("#choose").click(); await expect(page.locator("#telegraph-best")).toContainText("РЕКОРД");
    await page.reload(); await skipPrologue(page); await expect(page.locator("#telegraph-best")).toContainText("РЕКОРД");
    await page.locator("#telegraph-start").click(); await skipIntro(page);
    const reset = await page.evaluate(async () => {
      const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
      return { done: s.relay.restored, spawned: s.relaySpawned, objects: s.relayView.layer.list.length,
        balance: JSON.parse(localStorage.getItem("lastshot-arsenal")!).balance };
    });
    expect(reset).toEqual({ done: 0, spawned: 0, objects: 9, balance: 1200 });
    expect(errors).toEqual([]);
  });
}

test("repair input is isolated, partial work persists, pause and hidden tabs freeze both clocks and contacts", async ({ page }) => {
  await page.goto("/"); await skipPrologue(page); await page.locator("#telegraph-start").click();
  const intro = await page.evaluate(async () => {
    const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
    return { clock: s.clock, phase: s.relay.phase, ammo: s.ammo };
  });
  await page.keyboard.press("s"); await page.keyboard.press("e");
  await expect(page.locator("#relay-dialog")).not.toBeVisible(); await page.waitForTimeout(150);
  expect(await page.evaluate(async () => {
    const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
    return { clock: s.clock, phase: s.relay.phase, ammo: s.ammo };
  })).toEqual(intro);
  await skipIntro(page); await page.keyboard.press("s"); await page.locator("#relay-interact").click();
  const before = await boardInDialog(page);
  await page.locator('.relay-contact[data-cell="0"]').focus(); await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('.relay-contact[data-cell="1"]')).toBeFocused();
  const changed = await boardInDialog(page); expect(changed.tiles[0]).not.toBe(before.tiles[0]);
  for (const key of ["a", "d", "w", "r"]) await page.keyboard.press(key);
  const guarded = await page.evaluate(async () => {
    const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
    s.shoot(20, 20); s.move(1); s.stance(false); s.reload();
    return { ammo: s.ammo, lane: s.movement.lane, crouching: s.movement.crouching, reload: s.reloading };
  });
  expect(guarded).toEqual({ ammo: 6, lane: 1, crouching: true, reload: false });
  await page.locator("#relay-pause").click();
  const clock = await page.locator("#relay-clock").textContent();
  await expect(page.locator(".relay-contact:disabled")).toHaveCount(16); await page.waitForTimeout(250);
  await expect(page.locator("#relay-clock")).toHaveText(clock!);
  expect(await boardInDialog(page)).toEqual(changed);
  await page.locator("#relay-pause").click();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator("#relay-pause")).toHaveText("Продолжить");
  await expect(page.locator(".relay-contact:disabled")).toHaveCount(16);
  await page.evaluate(() => { delete (document as any).hidden; document.dispatchEvent(new Event("visibilitychange")); });
  await page.locator("#relay-pause").click(); await page.keyboard.press("Escape");
  await expect(page.locator("#relay-dialog")).not.toBeVisible();
  await expect(page.locator("#pause")).toHaveText("Пауза");
  await page.keyboard.press("e"); expect(await boardInDialog(page)).toEqual(changed);
});

test("kills cannot win the operation, enemy income is finite, and timeout/abort never pay a clear bonus", async ({ page }) => {
  await fresh(page);
  const killState = await page.evaluate(async () => {
    const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
    s.nextSpawn = Infinity;
    for (const t of s.targets) t.view.destroy(); s.targets = [];
    const p = s.slots[0];
    for (let i = 0; i < 3; i++) {
      s.targets = [{ ...p, slot: 0, civilian: false, expires: Infinity, view: s.person(p.x, p.y, false) }];
      s.shoot(p.x, p.y);
    }
    s.finish(true);
    return { ended: s.ended, kills: s.kills, balance: JSON.parse(localStorage.getItem("lastshot-arsenal")!).balance };
  });
  expect(killState).toEqual({ ended: false, kills: 3, balance: 300 });
  const spawned = await page.evaluate(async () => {
    const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
    for (let i = 0; i < 12; i++) {
      for (const t of s.targets) t.view.destroy(); s.targets = [];
      s.nextSpawn = s.clock; s.update(0, 1);
    }
    return s.relaySpawned;
  });
  expect(spawned).toBe(8);
  await page.keyboard.press("s"); await page.locator("#relay-interact").click();
  await page.evaluate(async () => {
    const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
    s.update(0, s.relay.deadline - s.clock);
  });
  await expect(page.locator("#relay-dialog")).not.toBeVisible();
  await expect(page.locator("#result-text")).toContainText("Время вышло");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("lastshot-arsenal")!).balance)).toBe(300);
  expect(await page.evaluate(() => localStorage.getItem("lastshot-telegraph"))).toBeNull();
  await page.locator("#retry").click(); await skipIntro(page); await page.keyboard.press("s");
  await page.locator("#relay-interact").click(); await page.locator("#relay-abort").click();
  await expect(page.locator("#result-text")).toContainText("Попытка завершена");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("lastshot-arsenal")!).balance)).toBe(300);
});

test("owned equipment works with an empty chamber; panels take no ammunition or weapon statistics and vanish in ordinary modes", async ({ page }) => {
  await page.addInitScript(state => localStorage.setItem("lastshot-arsenal", JSON.stringify(state)), { ...ownedArsenal(), selected: "mountain-guard" });
  await fresh(page);
  await expect(page.locator("#stats")).toContainText("Патроны 1/1");
  await page.evaluate(async () => {
    const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
    s.nextSpawn = Infinity; s.shoot(20, 20);
  });
  await page.keyboard.press("s"); await page.locator("#relay-interact").click(); await solveVisible(page);
  await expect(page.locator("#stats")).toContainText("Патроны 0/1");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("lastshot-arsenal")!).stats["mountain-guard"])).toEqual({ hits: 0, misses: 1, civilianHits: 0 });
  await page.locator("#back").click(); await page.locator(".level").first().click(); await skipIntro(page);
  await expect(page.locator("#relay-status")).toBeHidden(); await expect(page.locator("#relay-interact")).toBeHidden();
  expect(await page.evaluate(async () => {
    const { game } = await import("/src/main.ts"); return (game.scene.getScene("town") as any).relayView.layer.list.length;
  })).toBe(0);
});

test("offline mobile puzzles adapt to rotation, complete without shots and preserve a session when storage is blocked", async ({ browser }) => {
  test.setTimeout(90000);
  const context = await browser.newContext({ offline: true, viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage(), errors: string[] = [], requests: string[] = [];
    page.on("pageerror", e => errors.push(e.message)); page.on("request", r => requests.push(r.url()));
    await offlineArsenal(page);
    await page.evaluate(() => { localStorage.setItem = () => { throw Error("blocked"); }; });
    await page.setContent(await readFile("lastshot.html", "utf8")); await skipPrologue(page);
    await page.locator("#telegraph-start").tap(); await skipIntro(page, true);
    await page.locator("#crouch").tap(); await page.locator("#relay-interact").tap();
    for (const [width, height] of [[320, 568], [844, 390], [480, 240], [280, 653]]) {
      await page.setViewportSize({ width, height });
      expect(await page.locator("#relay-dialog").evaluate(d => d.scrollWidth <= d.clientWidth + 1)).toBe(true);
      await page.locator("#relay-pause").scrollIntoViewIfNeeded();
      const box = (await page.locator("#relay-pause").boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    }
    await page.setViewportSize({ width: 320, height: 568 }); await solveVisible(page, true);
    await page.locator("#move-left").tap(); await expect(page.locator("#play")).toHaveAttribute("data-cover", "safe");
    await page.locator("#relay-interact").tap(); await solveVisible(page, true);
    await travel(page, "right", true); await page.locator("#move-right").tap();
    await expect(page.locator("#play")).toHaveAttribute("data-cover", "safe");
    await page.locator("#relay-interact").tap(); await solveVisible(page, true);
    await expect(page.locator("#result-title")).toHaveText("Телеграф ожил!");
    await expect(page.locator("#result-reward")).toContainText("Сохранение недоступно");
    await expect(page.locator("#result-reward")).toContainText(/\+1\s200/);
    await page.locator("#choose").tap(); await expect(page.locator("#menu-wallet")).toHaveText(/1\s200/);
    expect(errors).toEqual([]); expect(requests).toEqual([]);
  } finally { await context.close(); }
});
