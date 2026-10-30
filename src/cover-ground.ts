import Phaser from "phaser";
import { cameras } from "./cameras.js";
import { coverCamera } from "./cover-geometry.js";
import { streetWood, tavernCovers } from "./maps.js";

const top = 450, bottom = 540, padding = 512;

/** Horizontal slices keep the painted furniture intact while the floor has near-depth parallax. */
function floorIntervals(map: string, y: number) {
  const holes = map === "street" ? streetWood : map === "tavern" ? tavernCovers : [
    [[86, 430], [872, 430], [872, 467], [86, 467]],
    [[336, 466], [626, 466], [626, 514], [336, 514]],
  ];
  let spans = [[0, 960]];
  for (const polygon of holes) {
    const crossings: number[] = [];
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [ax, ay] = polygon[i], [bx, by] = polygon[j];
      if ((ay > y) !== (by > y)) crossings.push(ax + (y - ay) * (bx - ax) / (by - ay));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const lo = crossings[i] - 2, hi = crossings[i + 1] + 2;
      spans = spans.flatMap(([a, b]) => hi <= a || lo >= b ? [[a, b]]
        : [[a, Math.max(a, lo)], [Math.min(b, hi), b]].filter(([x, end]) => end - x >= 1));
    }
  }
  return spans.map(([a, b]) => [Math.ceil(a), Math.floor(b)]).filter(([a, b]) => b > a);
}

/** Cached material strips slide by the exact same projected depth as a prop's feet. */
export class CoverGround {
  private strips: Phaser.GameObjects.Image[] = [];
  private map = "saloon";
  private position = NaN;
  readonly layer: Phaser.GameObjects.Container;
  constructor(private scene: Phaser.Scene, world: Phaser.GameObjects.Container) {
    this.layer = scene.add.container(0, 0).setName("near-ground").setDepth(-.5);
    world.add(this.layer).sort("depth");
  }
  reset(map: string) {
    this.map = map; this.position = NaN; this.layer.removeAll(true); this.strips = [];
    const key = `${map}-near-ground`;
    if (!this.scene.textures.exists(key)) {
      const sourceKey = map === "saloon" ? "town-scenery" : map === "street" ? "street-dusk" : "tavern";
      const source = this.scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
      const texture = this.scene.textures.createCanvas(key, 2048, bottom - top)!;
      const ctx = texture.context;
      const canvas = document.createElement("canvas"); canvas.width = 960; canvas.height = bottom - top;
      const sourceContext = canvas.getContext("2d")!;
      sourceContext.drawImage(source, 0, 0, source.width, source.height, 0, -top, 960, 540);
      const pixels = sourceContext.getImageData(0, 0, 960, bottom - top).data;
      const output = ctx.createImageData(2048, bottom - top);
      const reflect = (u: number, a: number, b: number) => {
        if (b - a <= 1) return a;
        const length = b - a, cycle = ((u - a) % (length * 2) + length * 2) % (length * 2);
        return a + (cycle < length ? cycle : length * 2 - cycle);
      };
      // Preserve the actual floor pixels at rest. Reflect clean intervals into
      // occluded/outside areas so scrolling cannot pull a bar or stair into dirt.
      for (let row = 0; row < bottom - top; row++) {
        const spans = floorIntervals(map, top + row + .5);
        for (let x = 0; x < 2048; x++) {
          let u = Math.min(959, reflect(x - padding, 0, 960));
          if (!spans.some(([a, b]) => u >= a && u < b)) {
            const nearest = spans.reduce((best, span) => Math.min(Math.abs(u - span[0]), Math.abs(u - span[1]))
              < Math.min(Math.abs(u - best[0]), Math.abs(u - best[1])) ? span : best);
            u = reflect(u, nearest[0], nearest[1] - 1);
          }
          const from = (row * 960 + Math.floor(u)) * 4, to = (row * 2048 + x) * 4;
          output.data[to] = pixels[from]; output.data[to + 1] = pixels[from + 1];
          output.data[to + 2] = pixels[from + 2]; output.data[to + 3] = 255;
        }
      }
      ctx.putImageData(output, 0, 0);
      const fade = ctx.createLinearGradient(0, 0, 0, 28);
      fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(1, "rgba(0,0,0,1)");
      ctx.globalCompositeOperation = "destination-in"; ctx.fillStyle = fade; ctx.fillRect(0, 0, 2048, bottom - top);
      texture.refresh();
    }
    const texture = this.scene.textures.get(key);
    for (let y = top; y < bottom; y += 2) for (const [left, right] of floorIntervals(map, y + 1)) {
      const name = `${y}-${left}-${right}`;
      if (!texture.has(name)) texture.add(name, 0, padding + left, y - top, right - left, 2);
      const strip = this.scene.add.image(left, y, key, name).setOrigin(0);
      this.strips.push(strip); this.layer.add(strip);
    }
  }
  update(position: number) {
    if (this.position === position) return;
    this.position = position;
    const c = cameras[this.map as keyof typeof cameras];
    const cameraX = (position - 1) * coverCamera.laneSpacingM;
    for (const strip of this.strips) {
      const ppm = (strip.y + 1 - c.horizonY) / c.eyeHeightM;
      const cutX = padding + strip.x + cameraX * (ppm - c.focalLength / coverCamera.backdropDistanceM);
      strip.frame.setSize(strip.frame.width, 2, cutX, strip.frame.cutY);
    }
  }
}
