import { skipPrologue, skipIntro } from "./helpers";
import { test, expect } from "@playwright/test";

test("saloon level doors respond to hover and keyboard, keep locked levels closed, and return cleanly", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await skipPrologue(page);
  const first = page.getByRole("button", { name: /01.*Первый выстрел/ });
  const locked = page.getByRole("button", { name: /02.*Мирные жители/ });
  await expect(first).toBeEnabled();
  await expect(page.locator(".saloon-doors")).toHaveCount(5);
  await expect(page.locator(".door-leaf")).toHaveCount(10);
  await expect(locked).toBeDisabled();
  await expect(locked.locator(".door-lock")).toBeVisible();
  const transform = (selector: string) => page.locator(selector).evaluate((e) => getComputedStyle(e).transform);
  expect(await transform(".level:first-child .door-left")).toBe("none");
  await first.hover();
  await expect.poll(() => transform(".level:first-child .door-left")).not.toBe("none");
  await locked.hover();
  expect(await transform(".level:nth-child(2) .door-left")).toBe("none");
  await first.focus();
  await page.keyboard.press("Enter");
  await skipIntro(page);
  await expect(page.locator("body")).not.toHaveClass(/in-menu/);
  await expect(page.locator("#play")).toBeVisible();
  await expect(page.locator(".saloon-transition")).toHaveCount(0);
  await page.getByRole("button", { name: "← Уровни" }).click();
  await expect(page.locator("body")).toHaveClass(/in-menu/);
  await expect(first).toBeEnabled();
  await expect(locked).toBeDisabled();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.screenshot({ path: "test-results/saloon-menu.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("mobile saloon menu fits the viewport, supports touch, and respects reduced motion", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await skipPrologue(page);
  const first = page.getByRole("button", { name: /01.*Первый выстрел/ });
  await expect(first).toBeEnabled();
  const layout = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
    dust: getComputedStyle(document.querySelector(".dust-field i")!).animationName,
    haze: getComputedStyle(document.querySelector(".sun-haze")!).animationName,
    columns: getComputedStyle(document.querySelector("#levels")!).gridTemplateColumns.split(" ").length,
  }));
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewport);
  expect(layout.columns).toBe(2);
  expect(layout.dust).toBe("none");
  expect(layout.haze).toBe("none");
  await page.screenshot({ path: "test-results/saloon-menu-mobile.png", fullPage: true });
  await first.tap();
  await skipIntro(page, true);
  await expect(page.locator("#play")).toBeVisible();
  await expect(page.locator(".saloon-transition")).toHaveCount(0);
  await expect(page.locator("#stats")).toContainText("Патроны 6/6");
  expect(errors).toEqual([]);
  await context.close();
});
