import { test, expect, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { skipIntro } from "./helpers";

async function saved(page: Page) {
  return page.evaluate(() => [localStorage.getItem("lastshot-progress"), localStorage.getItem("lastshot-arsenal"), localStorage.getItem("lastshot-map")]);
}

test("four illustrated scenes precede the menu and keep input, timers and saved progress untouched", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("lastshot-progress", JSON.stringify({ unlocked: 5, best: [200] }));
    localStorage.setItem("lastshot-map", "street");
  });
  await page.goto("/");
  const story = page.locator("#prologue-dialog");
  await expect(story).toBeVisible();
  await expect(page.locator("#app")).toBeHidden();
  expect(await page.locator("#app").evaluate((node) => node.inert)).toBe(true);
  await expect(page.locator("#prologue-title")).toHaveText("Dusty Town");
  await expect(page.locator("#prologue-text")).toContainText("1886 год");
  const original = await saved(page);
  await expect(page.locator(".level")).toHaveCount(5);
  await page.evaluate(() => {
    (document.querySelector(".level") as HTMLButtonElement).click();
    (document.querySelector("#arsenal-open") as HTMLButtonElement).click();
  });
  await expect(page.locator("#intro-dialog")).not.toBeVisible();
  await expect(page.locator("#arsenal")).toBeHidden();
  await page.waitForTimeout(800);
  const state = await page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    const scene = game.scene.getScene("town") as any;
    return { clock: scene.clock, ended: scene.ended, ammo: scene.ammo, targets: scene.targets.length };
  });
  expect(state).toEqual({ clock: 0, ended: true, ammo: 6, targets: 0 });
  const artwork = await page.locator("#prologue-art").evaluate(async (node) => {
    const source = getComputedStyle(node).backgroundImage.slice(5, -2);
    const image = new Image(); image.src = source; await image.decode();
    return { inline: source.startsWith("data:image/webp"), width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(artwork.inline).toBe(true);
  expect(artwork.width).toBeGreaterThan(1000);
  expect(artwork.width / artwork.height).toBeCloseTo(16 / 9, 2);
  await page.locator(".prologue-art-window").click();
  await expect(page.locator("#prologue-title")).toHaveText("Разгул преступности");
  await page.locator("#prologue-back").click();
  await expect(page.locator("#prologue-progress")).toHaveText("1 / 4");
  await page.keyboard.press("ArrowRight");
  await page.locator("#prologue-next").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#prologue-title")).toHaveText("Билли Пуля");
  await page.screenshot({ path: "test-results/prologue-billy.png", fullPage: true });
  await page.locator("#prologue-text").click();
  await expect(page.locator("#prologue-title")).toHaveText("Шериф Картер");
  await expect(page.locator("#prologue-text")).toContainText("Только он сможет положить конец");
  await expect(page.locator("#prologue-next")).toHaveText("В главное меню →");
  await page.screenshot({ path: "test-results/prologue-carter.png", fullPage: true });
  await page.locator("#prologue-next").click();
  await expect(story).not.toBeVisible();
  await expect(page.locator("#menu")).toBeVisible();
  expect(await saved(page)).toEqual(original);
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
  await skipIntro(page);
  await expect(page.locator("#stats")).toContainText("Патроны 6/6");
  await page.getByRole("button", { name: "← Уровни", exact: true }).click();
  await expect(story).not.toBeVisible();
  await page.getByRole("button", { name: /Шериф Картер против Билли Пули/ }).click();
  await page.locator("#dialogue-next").click();
  await page.locator("#dialogue-next").click();
  await expect(page.locator("#dialogue-speaker")).toHaveText("Сьюзи");
  await expect(page.getByRole("img", { name: "Портрет Сьюзи, официантки", exact: true })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("Сьюззи");
  expect(errors).toEqual([]);
});

for (const action of ["skip", "escape"]) {
  test(`${action} opens the menu once, while a fresh page starts the story again`, async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#prologue-dialog")).toBeVisible();
    if (action === "skip") await page.locator("#prologue-skip").click();
    else await page.keyboard.press("Escape");
    await expect(page.locator("#menu")).toBeVisible();
    await expect(page.locator("#prologue-dialog")).not.toBeVisible();
    await expect(page.locator("#sound")).toHaveText("Звук: выкл.");
    await page.getByRole("button", { name: /^Арсенал/ }).click();
    await page.getByRole("button", { name: "← Главное меню", exact: true }).click();
    await expect(page.locator("#prologue-dialog")).not.toBeVisible();
    await page.reload();
    await expect(page.locator("#prologue-progress")).toHaveText("1 / 4");
    await expect(page.locator("#app")).toBeHidden();
  });
}

test("offline touch story fits narrow screens and rotation, honors reduced motion and enters the game", async ({ browser }) => {
  const context = await browser.newContext({ offline: true, viewport: { width: 280, height: 653 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    const requests: string[] = [], errors: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setContent(await readFile("lastshot.html", "utf8"));
    for (let slide = 1; slide <= 4; slide++) {
      await expect(page.locator("#prologue-progress")).toHaveText(`${slide} / 4`);
      for (const [width, height] of [[280, 653], [320, 568], [844, 390], [390, 844]]) {
        await page.setViewportSize({ width, height });
        const layout = await page.evaluate(() => {
          const dialog = document.querySelector<HTMLDialogElement>("#prologue-dialog")!;
          return { width: document.documentElement.scrollWidth, viewport: innerWidth,
            title: document.querySelector("#prologue-title")!.getBoundingClientRect().width,
            dialogWidth: dialog.clientWidth, motion: getComputedStyle(document.querySelector("#prologue-art")!).animationName };
        });
        expect(layout.width).toBeLessThanOrEqual(layout.viewport);
        expect(layout.title).toBeLessThan(layout.dialogWidth);
        expect(layout.motion).toBe("none");
      }
      if (slide === 3) await page.screenshot({ path: "test-results/prologue-mobile.png", fullPage: true });
      await page.locator("#prologue-next").tap();
    }
    await expect(page.locator("#menu")).toBeVisible();
    await page.getByRole("button", { name: /01.*Первый выстрел/ }).tap();
    await skipIntro(page, true);
    await expect(page.locator("#stats")).toContainText("Патроны 6/6");
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
