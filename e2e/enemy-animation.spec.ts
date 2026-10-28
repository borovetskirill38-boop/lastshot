import { test, expect } from "@playwright/test";
import { skipPrologue, skipIntro } from "./helpers";

test("all bandits and Billy use 96 cached frames with steady heads and opaque bodies", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/"); await skipPrologue(page);
  await page.locator(".level").first().click(); await skipIntro(page);
  const rows = await page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    const { animateGunman } = await import("/src/combat-view.ts");
    const s = game.scene.getScene("town") as any;
    s.nextSpawn = Infinity; for (const t of s.targets) t.view.destroy(); s.targets = [];
    s.togglePause();
    const initialTextures = game.textures.getTextureKeys().length;
    const result = [];
    for (let row = 0; row < 4; row++) {
      const slot = s.slots[0], view = s.person(slot.x, slot.y, false, row === 3);
      const frames = new Set<string>();
      for (let i = 0; i < 48; i++) {
        animateGunman(view, i / 47 * .72, i * 16);
        frames.add(view.getData("combat-image").frame.name);
      }
      for (let i = 0; i < 48; i++) {
        animateGunman(view, 1, 1100 + i / 47 * 600, 1100);
        frames.add(view.getData("combat-image").frame.name);
      }
      const image = view.getData("combat-image");
      const texture = image.texture;
      const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 170;
      const ctx = canvas.getContext("2d")!;
      const pixels = (frame: number) => {
        const f = texture.get(String(frame)); ctx.clearRect(0, 0, 128, 170);
        ctx.drawImage(texture.getSourceImage(), f.cutX, f.cutY, f.width, f.height, 0, 0, 128, 170);
        return { head: Array.from(ctx.getImageData(46, 8, 28, 38).data), alpha: ctx.getImageData(86, 105, 1, 1).data[3] };
      };
      const samples = [0, 8, 16, 24, 32, 47, 48, 53, 60, 72, 84, 95].map(pixels);
      const head = JSON.stringify(samples[0].head);
      result.push({ row, frames: frames.size, texture: texture.key, alpha: Math.min(...samples.map(p => p.alpha)),
        stableHead: samples.every(p => JSON.stringify(p.head) === head),
        restMatches: JSON.stringify(pixels(0)) === JSON.stringify(pixels(95)),
        warning: !!view.getData("combat-warning"), objects: view.list.length,
        textures: game.textures.getTextureKeys().length - initialTextures });
      view.destroy();
    }
    return result;
  });
  for (const row of rows) {
    expect(row).toMatchObject({ frames: 96, texture: `gunman-motion-${row.row}`, stableHead: true,
      restMatches: true, warning: false, textures: 0 });
    expect(row.objects).toBe(4);
    expect(row.alpha).toBeGreaterThanOrEqual(245);
  }
  expect(errors).toEqual([]);
});
