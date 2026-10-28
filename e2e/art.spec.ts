import { skipPrologue, skipIntro } from "./helpers";
import { test, expect } from "@playwright/test";

test("people cycle distinct appearances, reuse their atlas and remain inside the original hit area", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await skipPrologue(page);
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
  await skipIntro(page);
  const result = await page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    const s = game.scene.getScene("town") as any;
    s.paused = true;
    const position = s.slots[0];
    const textureCount = game.textures.getTextureKeys().length;
    const examine = (civilian: boolean, count: number) => Array.from({ length: count }, () => {
      const view = s.person(position.x, position.y, civilian);
      const image = view.list.find((c: any) => c.type === "Image");
      const details = {
        appearance: view.getData("appearance"),
        texture: image.texture.key,
        frame: image.frame.name,
        width: image.displayWidth,
        height: image.displayHeight,
      };
      view.destroy();
      return details;
    });
    const bandits = examine(false, 6);
    const civilians = examine(true, 8);
    const boss = s.person(position.x, position.y, false, true);
    const bossFrame = boss.getData("appearance");
    boss.destroy();
    return { bandits, civilians, bossFrame, textureCount, after: game.textures.getTextureKeys().length };
  });
  expect(new Set(result.bandits.map((v) => v.appearance)).size).toBe(3);
  expect(new Set(result.civilians.map((v) => v.appearance)).size).toBe(4);
  expect(result.bandits.slice(0, 3)).toEqual(result.bandits.slice(3));
  expect(result.civilians.slice(0, 4)).toEqual(result.civilians.slice(4));
  expect(result.bossFrame).toBe("boss");
  expect(result.after).toBe(result.textureCount);
  for (const person of [...result.bandits, ...result.civilians]) {
    expect(person.frame).toBe(person.appearance);
    expect(person.texture).toBe("western-people");
    expect(person.width).toBe(84);
    expect(person.height).toBe(112);
  }
  expect(errors).toEqual([]);
});

test("level selection waits for artwork decoding before starting gameplay", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src")!;
    const pending: (() => void)[] = [];
    let released = false;
    (window as any).releaseArtwork = () => {
      released = true;
      pending.splice(0).forEach((load) => load());
    };
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...descriptor,
      set(value: string) {
        const load = () => descriptor.set!.call(this, value);
        if (!released && value.startsWith("data:image/webp")) pending.push(load);
        else load();
      },
    });
  });
  await page.goto("/");
  await skipPrologue(page);
  await expect(page.locator(".level")).toHaveCount(5);
  for (const button of await page.locator(".level").all()) {
    await expect(button).toBeDisabled();
  }
  await expect(page.locator("#play")).toBeHidden();
  await page.evaluate(() => (window as any).releaseArtwork());
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
  await skipIntro(page);
  await expect(page.locator("#play")).toBeVisible();
  await expect(page.locator("#stats")).toContainText("Патроны 6/6");
  expect(errors).toEqual([]);
});
