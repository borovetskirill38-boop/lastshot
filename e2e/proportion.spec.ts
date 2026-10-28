import { test, expect } from "@playwright/test";
import { skipIntro } from "./helpers";

for (const touch of [false, true]) {
  test(`the smallest projected actor on every map remains visible and hittable by ${touch ? "touch" : "mouse"}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL,
      viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      isMobile: touch, hasTouch: touch,
    });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem("lastshot-progress", JSON.stringify({ unlocked: 5, best: [] })));
      await page.goto("/");
      for (const map of ["saloon", "street", "tavern"]) {
        await page.locator(`.map-card[data-map="${map}"]`).click();
        await page.getByRole("button", { name: /02.*Мирные жители/ }).click();
        await skipIntro(page, touch);
        await page.getByRole("button", { name: "Пауза", exact: true }).click();
        await expect(page.locator(".saloon-transition")).toHaveCount(0);
        const target = await page.evaluate(async () => {
          const { game } = await import("/src/main.ts");
          const scene = game.scene.getScene("town") as any;
          for (const target of scene.targets) target.view.destroy();
          scene.targets = [];
          scene.nextSpawn = Infinity;
          const sorted = [...scene.slots].sort((a, b) => b.distanceM - a.distanceM);
          const far = sorted[0], near = sorted.at(-1);
          const farView = scene.person(far.x, far.y, false);
          const nearView = scene.person(near.x, near.y, false);
          const image = farView.list.find((item: any) => item.type === "Image");
          const nearImage = nearView.list.find((item: any) => item.type === "Image");
          const bounds = image.getBounds();
          const nearBounds = nearImage.getBounds();
          const canvas = document.createElement("canvas");
          canvas.width = 1; canvas.height = 1;
          const drawing = canvas.getContext("2d")!;
          const sampleAlpha = (layer: any) => {
            const local = layer.getWorldTransformMatrix().applyInverse(far.x, far.y);
            const u = local.x + layer.displayOriginX;
            const v = local.y + layer.displayOriginY;
            if (u < 0 || v < 0 || u >= layer.frame.cutWidth || v >= layer.frame.cutHeight) return 0;
            if (layer.isCropped) {
              const crop = layer._crop;
              if (u < crop.x || v < crop.y || u >= crop.x + crop.width || v >= crop.y + crop.height) return 0;
            }
            drawing.clearRect(0, 0, 1, 1);
            drawing.drawImage(layer.texture.getSourceImage(),
              Math.floor(layer.frame.cutX + u), Math.floor(layer.frame.cutY + v), 1, 1, 0, 0, 1, 1);
            return drawing.getImageData(0, 0, 1, 1).data[3];
          };
          const alpha = sampleAlpha(image);
          const blockers = scene.scenery.filter((layer: any) => layer.visible && layer.texture
            && layer.depth > farView.depth + 1e-6 && sampleAlpha(layer) > 127).map((layer: any) => layer.name);
          nearView.destroy();
          scene.targets = [{ ...far, slot: scene.slots.indexOf(far), civilian: false,
            expires: Infinity, view: farView }];
          return { x: far.x, y: far.y, alpha, blockers,
            top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right,
            farHeight: bounds.height, nearHeight: nearBounds.height,
            farDistance: far.distanceM, nearDistance: near.distanceM };
        });
        expect(target.alpha).toBeGreaterThan(100);
        expect(target.blockers).toEqual([]);
        expect(target.y).toBeGreaterThan(target.top);
        expect(target.y).toBeLessThan(target.bottom);
        expect(target.x).toBeGreaterThan(target.left);
        expect(target.x).toBeLessThan(target.right);
        if (target.farDistance > target.nearDistance + 0.01) {
          expect(target.farHeight).toBeLessThan(target.nearHeight);
        } else {
          expect(target.farHeight).toBeCloseTo(target.nearHeight, 5);
        }
        await page.getByRole("button", { name: "Продолжить", exact: true }).click();
        const box = await page.locator("canvas").boundingBox();
        const x = box!.x + target.x * box!.width / 960;
        const y = box!.y + target.y * box!.height / 540;
        if (touch) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
        await expect(page.locator("#stats")).toContainText("1/12");
        await expect(page.locator("#stats")).toContainText("Патроны 5/6");
        await expect(page.locator("#life-count")).toHaveText("3/3");
        await page.getByRole("button", { name: "← Уровни", exact: true }).click();
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
