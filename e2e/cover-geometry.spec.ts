import { test, expect } from "@playwright/test";
import { skipPrologue, skipIntro } from "./helpers";

for (const map of ["saloon", "street", "tavern"]) {
  test(`${map}: complete grounded cover, stable camera, solid impacts and open gaps`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem("lastshot-progress", JSON.stringify({ unlocked: 5, best: [] })));
    await page.goto("/"); await skipPrologue(page);
    await page.locator(`.map-card[data-map="${map}"]`).click();
    await page.getByRole("button", { name: /02.*Мирные жители/ }).click(); await skipIntro(page);
    const geometry = await page.evaluate(async () => {
      const { game } = await import("/src/main.ts");
      const s = game.scene.getScene("town") as any;
      s.nextSpawn = Infinity; for (const t of s.targets) t.view.destroy(); s.targets = [];
      const cv = s.combatView, textures = game.textures.getTextureKeys().length;
      const baseline = cv.covers.map((c: any) => ({ anchor: { ...c.anchor }, x: c.image.x, y: c.image.y,
        width: c.image.displayWidth, height: c.image.displayHeight }));
      const parented = cv.foreground.parentContainer === s.world;
      const frameGaps = cv.covers.map((c: any) => {
        const f = c.image.frame;
        // A surrounding pixel ring must not contain opaque portions cut off by the frame.
        const canvas = document.createElement("canvas"); canvas.width = f.width + 2; canvas.height = f.height + 2;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(c.image.texture.getSourceImage(), f.cutX - 1, f.cutY - 1, f.width + 2, f.height + 2, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let peak = 0;
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
          if (x === 0 || y === 0 || x === canvas.width - 1 || y === canvas.height - 1) peak = Math.max(peak, pixels[(y * canvas.width + x) * 4 + 3]);
        }
        return peak;
      });
      const zoom = s.world.scaleX;
      // Compare actual rendered floor pixels in map coordinates, compensating
      // only for the normal camera transform. A scrolling overlay fails this.
      const floorPixels = async () => {
        const paused = s.paused; s.paused = true;
        const image = await new Promise<HTMLImageElement>(resolve => game.renderer.snapshot(resolve));
        const canvas = document.createElement("canvas"); canvas.width = 24; canvas.height = 3;
        const ctx = canvas.getContext("2d")!;
        const p = s.world.getWorldTransformMatrix().transformPoint(120, 534);
        ctx.drawImage(image, p.x, p.y, 24 * s.world.scaleX, 3 * s.world.scaleY, 0, 0, 24, 3);
        const pixels = Array.from(ctx.getImageData(0, 0, 24, 3).data);
        s.paused = paused;
        return pixels;
      };
      s.stance(true); s.update(0, 200);
      const floor = await floorPixels();
      const grounded = cv.covers.every((c: any, i: number) => c.image.y === baseline[i].y
        && c.shadow.x === c.image.x && Math.abs(c.shadow.y - c.image.y) <= 2
        && c.image.displayWidth === baseline[i].width && c.image.displayHeight === baseline[i].height);
      s.move(-1); s.update(0, 260);
      const crossing = { safe: s.movement.protected, moving: s.movement.moving };
      const halfwayFloor = await floorPixels();
      s.update(0, 260);
      const arrivedFloor = await floorPixels();
      const floorError = Math.max(...[halfwayFloor, arrivedFloor].map(pixels =>
        Math.sqrt(pixels.reduce((sum, value, i) => sum + (value - floor[i]) ** 2, 0) / pixels.length)));
      const floorOpaque = floor.every((value, i) => i % 4 !== 3 || value === 255);
      const sameAnchors = cv.covers.every((c: any, i: number) => JSON.stringify(c.anchor) === JSON.stringify(baseline[i].anchor));
      s.move(1); s.update(0, 520); s.stance(false); s.update(0, 200);
      const returns = cv.covers.every((c: any, i: number) => Math.abs(c.image.x - baseline[i].x) < 1e-6 && c.image.y === baseline[i].y);
      const noZoom = s.world.scaleX === zoom;
      s.togglePause();
      return { parented, frameGaps, grounded, crossing, sameAnchors, returns, noZoom, floorError, floorOpaque,
        cached: game.textures.getTextureKeys().length === textures };
    });
    expect(geometry).toMatchObject({ parented: true, grounded: true, crossing: { safe: false, moving: true },
      sameAnchors: true, returns: true, noZoom: true, cached: true });
    expect(Math.max(...geometry.frameGaps)).toBeLessThan(128);
    expect(geometry.floorOpaque).toBe(true);
    expect(geometry.floorError).toBeLessThan(12);

    const point = await page.evaluate(async () => {
      const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
      s.paused = false;
      const image = s.combatView.covers[1].image;
      const x = image.x - (image.frame.name === "barrels" ? .22 : 0) * image.displayWidth;
      const y = image.y - image.displayHeight * (image.frame.name === "wagon" ? .68 : .48);
      const p = { x, y, bodyY: y, scale: 1, pixelsPerMeter: 10000, coverY: Infinity };
      s.targets = [{ ...p, slot: -1, civilian: false, expires: Infinity, view: s.person(x, y, false) }];
      s.targets[0].view.setDepth(9000); s.world.sort("depth");
      return s.world.getWorldTransformMatrix().transformPoint(x, y);
    });
    const box = (await page.locator("canvas").boundingBox())!;
    await page.mouse.click(box.x + point.x / 960 * box.width, box.y + point.y / 540 * box.height);
    const hit = await page.evaluate(async () => {
      const { game, gameAudio } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
      const blocked = { kills: s.kills, targets: s.targets.length, ammo: s.ammo, marks: s.combatView.marks.length };
      for (const t of s.targets) t.view.destroy(); s.targets = [];
      const cv = s.combatView;
      const voids: boolean[] = [];
      for (const c of cv.covers) {
        const image = c.image;
        voids.push(cv.hitCover(image.x - image.displayWidth * .49, image.y - image.displayHeight * .99) === undefined);
      }
      let openGap;
      if (s.map.id === "street") {
        // Empty air between the two wheels must not become a solid rectangular hit box.
        const image = cv.covers[1].image, x = image.x, y = image.y - image.displayHeight * .035;
        openGap = cv.hitCover(x, y) === undefined;
        s.targets = [{ x, y, bodyY: y, scale: 1, pixelsPerMeter: 10000, coverY: Infinity,
          slot: -1, civilian: false, expires: Infinity, view: s.person(x, y, false) }];
        s.shoot(x, y);
        openGap &&= s.kills === 1;
      }
      const sounds: string[] = [], original = gameAudio.play.bind(gameAudio);
      gameAudio.play = kind => { sounds.push(kind); };
      s.stance(true); s.update(0, 200); s.receiveFire(s.slots[0].x, s.slots[0].y, 1);
      gameAudio.play = original;
      const p = cv.impacts.at(-1).point, contact = cv.coverPoint(p);
      const woodImpact = cv.hitCover(contact.x, contact.y) !== undefined;
      const guarded = { lives: s.lives, sounds, woodImpact };
      s.togglePause();
      return { blocked, voids, openGap, guarded };
    });
    expect(hit.blocked).toEqual({ kills: 0, targets: 1, ammo: 5, marks: 1 });
    expect(hit.voids).toEqual([true, true, true]);
    if (map === "street") expect(hit.openGap).toBe(true);
    expect(hit.guarded).toEqual({ lives: 3, sounds: ["enemyShot", "wood"], woodImpact: true });
    await page.screenshot({ path: `test-results/grounded-${map}.png`, fullPage: true });
    if (map === "saloon") {
      await page.locator("#back").click();
      await page.locator(".level").first().click(); await skipIntro(page);
      const restarted = await page.evaluate(async () => {
        const { game } = await import("/src/main.ts"); const s = game.scene.getScene("town") as any;
        s.nextSpawn = Infinity; for (const t of s.targets) t.view.destroy(); s.targets = [];
        const c = s.combatView.covers[1].image;
        return { marks: s.combatView.marks.length, objects: s.combatView.foreground.list.length,
          point: s.world.getWorldTransformMatrix().transformPoint(c.x, c.y - c.displayHeight * .48) };
      });
      expect(restarted).toMatchObject({ marks: 0, objects: 7 });
      const area = (await page.locator("canvas").boundingBox())!;
      for (let i = 0; i < 3; i++) await page.mouse.click(area.x + restarted.point.x / 960 * area.width,
        area.y + restarted.point.y / 540 * area.height);
      await expect(page.locator("#result-title")).toHaveText("Конец игры");
      await expect(page.locator("#life-count")).toHaveText("0/3");
      await expect(page.locator("#stats")).toContainText("Патроны 3/6");
    }
    expect(errors).toEqual([]);
  });
}
