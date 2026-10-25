import { expect, Page } from "@playwright/test";

/** Gameplay-focused tests enter through the same visible skip button as players. */
export async function skipIntro(page: Page, touch = false) {
  await expect(page.locator("#intro-dialog")).toBeVisible();
  const skip = page.getByRole("button", { name: "Пропустить диалог", exact: true });
  if (touch) await skip.tap();
  else await skip.click();
  await expect(page.locator("#intro-dialog")).not.toBeVisible();
}
