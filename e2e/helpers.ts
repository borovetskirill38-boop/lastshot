import { expect, Page } from "@playwright/test";
import { coverWorldView } from "../src/cover-geometry.js";

/** Native input must target the rendered world after camera travel/tilt. */
export async function worldPoint(page: Page, x: number, y: number) {
  // Standalone tests begin at the centre cover without importing from a server.
  if (page.url() === "about:blank") {
    const view = coverWorldView(1, 0);
    return { x: x * view.zoom + view.x, y: y * view.zoom + view.y };
  }
  return page.evaluate(async p => {
    const { game } = await import("/src/main.ts");
    const s = game.scene.getScene("town") as any;
    return s.world.getWorldTransformMatrix().transformPoint(p.x, p.y);
  }, { x, y });
}

/** Existing gameplay tests pass through the same visible opening skip as players. */
export async function skipPrologue(page: Page) {
  await expect(page.locator("#prologue-dialog")).toBeVisible();
  await page.getByRole("button", { name: "Пропустить заставки", exact: true }).click();
  await expect(page.locator("#prologue-dialog")).not.toBeVisible();
}

/** Control only the encounter's random source; phases still advance through game time. */
export async function setBossRandom(page: Page, poseRolls: number[]) {
  await page.evaluate(async (rolls) => {
    const { game } = await import("/src/main.ts");
    const encounter = (game.scene.getScene("town") as any).encounter;
    let calls = 0;
    encounter.random = () => ++calls % 2 === 1 ? 0 : rolls.shift() ?? 0.9;
  }, poseRolls);
}

/** Gameplay-focused tests enter through the same visible skip button as players. */
export async function skipIntro(page: Page, touch = false) {
  await expect(page.locator("#intro-dialog")).toBeVisible();
  const skip = page.getByRole("button", { name: "Пропустить диалог", exact: true });
  if (touch) await skip.tap();
  else await skip.click();
  await expect(page.locator("#intro-dialog")).not.toBeVisible();
}
