import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("single HTML runs offline with weapon and no external dependencies", async ({
  browser,
}) => {
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 1280, height: 1000 },
  });
  const page = await context.newPage();
  const errors: string[] = [],
    requests: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await page.setContent(await readFile("lastshot.html", "utf8"));
  await expect(page.locator("canvas")).toBeAttached();
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const box = await page.locator("canvas").boundingBox();
  expect(box!.width).toBeGreaterThan(300);
  await page.mouse.move(box!.x + box!.width * 0.8, box!.y + box!.height * 0.4);
  await page.mouse.click(box!.x + box!.width * 0.8, box!.y + box!.height * 0.4);
  await expect(page.locator("#stats")).toContainText("Патроны 5/6");
  await page.getByRole("button", { name: /Перезарядить/ }).click();
  await expect(page.locator("#stats")).toContainText("Патроны 6/6");
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page.screenshot({
    path: "test-results/standalone-art.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
  await context.close();
});
