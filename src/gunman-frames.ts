import Phaser from "phaser";
import { gunmanAnimation, gunmanPose } from "./enemy-animation.js";

type Point = { x: number; y: number };
const width = 128, height = 170, columns = 12, headCut = 0.32;
// Normalised shoulder, elbow, wrist and muzzle positions measured on the source
// atlas. Head/torso anchors keep the hat, eyes and the opposite arm stationary.
const poses = [
  [{ x: .26, y: .48 }, { x: .18, y: .77 }, { x: .43, y: .84 }, { x: .49, y: .96 }],
  [{ x: .27, y: .48 }, { x: .15, y: .56 }, { x: .46, y: .65 }, { x: .59, y: .83 }],
  [{ x: .28, y: .48 }, { x: .28, y: .62 }, { x: .38, y: .52 }, { x: .445, y: .39 }],
];
const fixed = [
  { x: 0, y: headCut }, { x: .5, y: headCut }, { x: 1, y: headCut },
  { x: .53, y: .40 }, { x: .64, y: .46 },
  { x: .8, y: .52 }, { x: .85, y: .78 }, { x: .8, y: 1 },
  { x: 0, y: 1 }, { x: 1, y: 1 },
];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const triangle = (ctx: CanvasRenderingContext2D, source: CanvasImageSource,
  rect: number[], s: Point[], d: Point[]) => {
  const [s0, s1, s2] = s, [d0, d1, d2] = d;
  const sx1 = s1.x - s0.x, sy1 = s1.y - s0.y, sx2 = s2.x - s0.x, sy2 = s2.y - s0.y;
  const det = sx1 * sy2 - sx2 * sy1;
  if (Math.abs(det) < 1e-6) return;
  const dx1 = d1.x - d0.x, dy1 = d1.y - d0.y, dx2 = d2.x - d0.x, dy2 = d2.y - d0.y;
  const a = (dx1 * sy2 - dx2 * sy1) / det, c = (dx2 * sx1 - dx1 * sx2) / det;
  const b = (dy1 * sy2 - dy2 * sy1) / det, e = (dy2 * sx1 - dy1 * sx2) / det;
  ctx.save();
  ctx.beginPath();
  // Overlap by a fraction of a pixel to close antialiased triangle seams. Each
  // source is drawn opaque into its own scratch canvas before the final blend.
  const cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3;
  d.forEach((p, i) => {
    const length = Math.hypot(p.x - cx, p.y - cy) || 1;
    const x = p.x + (p.x - cx) / length * .35, y = p.y + (p.y - cy) / length * .35;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  });
  ctx.closePath(); ctx.clip();
  ctx.transform(a, b, c, e, d0.x - a * s0.x - c * s0.y, d0.y - b * s0.x - e * s0.y);
  ctx.drawImage(source, rect[0], rect[1], rect[2], rect[3], 0, 0, rect[2], rect[3]);
  ctx.restore();
};

/** Warp both neighbouring drawings towards the same arm landmarks before
 * blending; plain cross-fades would show two hands or two gun barrels. */
function warp(ctx: CanvasRenderingContext2D, source: CanvasImageSource, rect: number[],
  from: Point[], target: Point[]) {
  ctx.clearRect(0, 0, width, height);
  // Barrel foreshortening changes between source drawings. Bound that local
  // deformation so a front-facing barrel cannot stretch into the face.
  const bounded = (n: number, limit: number) => Math.max(-limit, Math.min(limit, n));
  const controls = [...from.map((p, i) => ({ ...p,
    dx: bounded(target[i].x - p.x, i === 3 ? .06 : .1),
    dy: bounded(target[i].y - p.y, i === 3 ? .06 : .1) })),
    ...fixed.map(p => ({ ...p, dx: 0, dy: 0 }))];
  const grid: { s: Point; d: Point }[][] = [];
  for (let row = 0; row <= 8; row++) {
    grid[row] = [];
    for (let col = 0; col <= 8; col++) {
      const x = col / 8, y = headCut + (1 - headCut) * row / 8;
      let dx = 0, dy = 0, total = 0;
      for (const p of controls) {
        const weight = 1 / ((x - p.x) ** 2 + (y - p.y) ** 2 + .0001) ** 3;
        total += weight; dx += p.dx * weight; dy += p.dy * weight;
      }
      // The texture boundary remains fixed, so interpolated forearms cannot
      // stretch the sprite outside its existing cover/hit-test envelope.
      const edge = row === 0 || col === 0 || col === 8 || row === 8 ? 0 : 1;
      grid[row][col] = { s: { x: x * rect[2], y: y * rect[3] },
        d: { x: (x + dx / total * edge) * width, y: (y + dy / total * edge) * height } };
    }
  }
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const a = grid[y][x], b = grid[y][x + 1], c = grid[y + 1][x + 1], d = grid[y + 1][x];
    for (const vertices of [[a, b, c], [a, c, d]]) triangle(ctx, source, rect,
      vertices.map(v => v.s), vertices.map(v => v.d));
  }
}

/** Bake once while the scene loads: animation itself only switches cached GPU
 * frames. Four 1536×1360 atlases also work with the Canvas renderer and offline. */
export function prepareGunmanFrames(scene: Phaser.Scene) {
  const source = scene.textures.get("enemy-combat").getSourceImage() as HTMLImageElement;
  const scratch = [document.createElement("canvas"), document.createElement("canvas")];
  scratch.forEach(c => { c.width = width; c.height = height; });
  const contexts = scratch.map(c => c.getContext("2d")!);
  for (let role = 0; role < 4; role++) {
    const key = `gunman-motion-${role}`;
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(key, width * columns, height * 8)!;
    const ctx = texture.context;
    const top = Math.round(role * source.height / 4), bottom = Math.round((role + 1) * source.height / 4);
    const rect = (pose: number) => {
      const left = Math.round(pose * source.width / 4), right = Math.round((pose + 1) * source.width / 4);
      return [left, top, right - left, bottom - top];
    };
    for (let i = 0; i < gunmanAnimation.frames; i++) {
      const pose = gunmanPose(i), a = Math.min(2, Math.floor(pose.draw)), b = Math.min(2, a + 1);
      const mix = pose.draw - a;
      // The warped drawing carries the motion. Only dissolve at the brief
      // perspective change, keeping hands and the gun opaque along the arc.
      const transition = Math.max(0, Math.min(1, (mix - .49) / .02));
      const blend = transition * transition * (3 - 2 * transition);
      const target = poses[a].map((p, j) => ({ x: lerp(p.x, poses[b][j].x, mix),
        y: lerp(p.y, poses[b][j].y, mix) - pose.kick * (j === 3 ? .05 : j === 2 ? .022 : j === 1 ? .008 : 0) }));
      if (blend < 1) warp(contexts[0], source, rect(a), poses[a], target);
      if (blend > 0) warp(contexts[1], source, rect(b), poses[b], target);
      const x = i % columns * width, y = Math.floor(i / columns) * height;
      ctx.save(); ctx.translate(x, y);
      ctx.globalAlpha = 1 - blend;
      if (blend < 1) ctx.drawImage(scratch[0], 0, 0);
      if (blend > 0) {
        // Add premultiplied colours/alpha: two 50% layers remain fully opaque
        // over the torso, instead of revealing the background at every change.
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = blend; ctx.drawImage(scratch[1], 0, 0);
      }
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.rect(0, 0, width, height * headCut); ctx.clip();
      const r = rect(0); ctx.drawImage(source, r[0], r[1], r[2], r[3], 0, 0, width, height);
      ctx.restore();
      texture.add(String(i), 0, x, y, width, height);
    }
    texture.refresh();
  }
}
