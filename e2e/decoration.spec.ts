import { test, expect, Page } from "@playwright/test";
import { skipPrologue, skipIntro, worldPoint } from "./helpers";

async function shoot(page: Page, x: number, y: number) {
  const point = await worldPoint(page, x, y);
  const box = await page.locator("canvas").boundingBox();
  await page.mouse.click(box!.x + point.x * box!.width / 960, box!.y + point.y * box!.height / 540);
}

test("every saloon window contains a visible detailed room instead of a black recess", async ({ page }) => {
  await page.goto("/");
  await skipPrologue(page);
  await page.getByRole("button", { name: /01.*Первый выстрел/ }).click();
  await skipIntro(page);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  const rooms = await page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    const scene = game.scene.getScene("town") as any;
    const source = scene.scenery.find((layer: any) => layer.name === "map-background").texture.getSourceImage();
    const canvas = document.createElement("canvas");
    canvas.width = 960; canvas.height = 540;
    const context = canvas.getContext("2d")!;
    context.drawImage(source, 0, 0, 960, 540);
    return scene.slots.filter((slot: any) => !slot.aperture.door).map((slot: any) => {
      const room = slot.aperture;
      const width = room.right - room.left, height = room.bottom - room.top;
      const data = context.getImageData(Math.ceil(room.left + width * 0.12), Math.ceil(room.top + height * 0.12),
        Math.floor(width * 0.76), Math.floor(height * 0.76)).data;
      let sum = 0;
      const colors = new Set();
      for (let i = 0; i < data.length; i += 4) {
        sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
        colors.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
      }
      return { brightness: sum / (data.length / 4), colors: colors.size };
    });
  });
  expect(rooms).toHaveLength(5);
  for (const room of rooms) {
    expect(room.brightness).toBeGreaterThan(18);
    expect(room.colors).toBeGreaterThan(30);
  }
  await page.screenshot({ path: "test-results/saloon-rooms-and-porch.png", fullPage: true });
});

for (const map of ["street", "tavern"]) {
  test(`${map} extra obstacles visibly mask targets and block native shots below their rims`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem("lastshot-progress", JSON.stringify({ unlocked: 5, best: [] })));
    await page.goto("/");
    await skipPrologue(page);
    await page.locator(`.map-card[data-map="${map}"]`).click();
    await page.getByRole("button", { name: /02.*Мирные жители/ }).click();
    await skipIntro(page);
    await page.getByRole("button", { name: "Пауза", exact: true }).click();
    const covers = await page.evaluate(async () => {
      const { game } = await import("/src/main.ts");
      const scene = game.scene.getScene("town") as any;
      for (const target of scene.targets) target.view.destroy();
      scene.nextSpawn = Infinity;
      scene.targets = scene.slots.filter((slot: any) => slot.prop).map((slot: any) => ({
        ...slot, slot: scene.slots.indexOf(slot), civilian: false, expires: Infinity,
        view: scene.person(slot.x, slot.y, false),
      }));
      return scene.targets.map((target: any) => {
        const image = scene.world.getByName(`cover-${target.prop}`) as any;
        const frame = image.frame;
        const canvas = document.createElement("canvas");
        canvas.width = frame.cutWidth;
        canvas.height = frame.cutHeight;
        const context = canvas.getContext("2d")!;
        context.drawImage(image.texture.getSourceImage(), frame.cutX, frame.cutY,
          frame.cutWidth, frame.cutHeight, 0, 0, canvas.width, canvas.height);
        const alpha = (worldY: number) => {
          const y = Math.round((worldY - image.y) * canvas.height / image.displayHeight);
          return y < 0 ? 0 : context.getImageData(Math.floor(canvas.width / 2), y, 1, 1).data[3];
        };
        return { x: target.x, y: target.y, edge: target.coverY,
          above: alpha(target.coverY - 5), below: alpha(target.coverY + 5),
          foreground: image.depth > target.view.depth };
      });
    });
    expect(covers.length).toBeGreaterThanOrEqual(2);
    for (const cover of covers) {
      expect(cover.above).toBeLessThan(128);
      expect(cover.below).toBeGreaterThan(220);
      expect(cover.foreground).toBe(true);
    }
    await page.screenshot({ path: `test-results/${map}-extra-cover.png`, fullPage: true });
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
    for (const [index, cover] of covers.entries()) {
      if (index > 0 && index % 3 === 0) {
        await page.getByRole("button", { name: /Перезарядить/ }).click();
        await expect(page.locator("#stats")).toContainText("Патроны 6/6");
      }
      await shoot(page, cover.x, cover.edge + 5);
      await expect(page.locator("#stats")).toContainText(`${index}/12`);
      await shoot(page, cover.x, cover.y);
      await expect(page.locator("#stats")).toContainText(`${index + 1}/12`);
    }
    await expect(page.locator("#life-count")).toHaveText("3/3");
    expect(errors).toEqual([]);
  });
}
