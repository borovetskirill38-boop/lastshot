import Phaser from "phaser";
import { playerCovers, CoverMovement } from "./combat.js";
import { coverAnchor, coverFrames, projectPlayerCover } from "./cover-geometry.js";
import { CoverGround } from "./cover-ground";
import { sampleGunmanFrame, gunmanAnimation } from "./enemy-animation.js";

type CoverHit = { index: number; u: number; v: number };
type Impact = { from?: { x: number; y: number }; point?: CoverHit; at: number };
type PlacedCover = { image: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image;
  anchor: ReturnType<typeof coverAnchor>; frame: string };

export class CombatView {
  readonly foreground: Phaser.GameObjects.Container;
  readonly feedback: Phaser.GameObjects.Graphics;
  readonly ground: CoverGround;
  private covers: PlacedCover[] = [];
  private marks: CoverHit[] = [];
  private scars: Phaser.GameObjects.Graphics;
  private impacts: Impact[] = [];
  private hurtUntil = 0;
  private map = "saloon";
  constructor(private scene: Phaser.Scene, private world: Phaser.GameObjects.Container) {
    this.ground = new CoverGround(scene, world);
    const texture = scene.textures.get("player-covers");
    for (const [key, [x, y, w, h]] of Object.entries(coverFrames)) if (!texture.has(key)) texture.add(key, 0, x, y, w, h);
    if (!scene.textures.exists("cover-contact-shadow")) {
      const shadow = scene.textures.createCanvas("cover-contact-shadow", 256, 128)!;
      const ctx = shadow.context;
      ctx.translate(128, 64); ctx.scale(1, .32);
      const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, 120);
      gradient.addColorStop(0, "rgba(20,12,7,0.65)");
      gradient.addColorStop(.45, "rgba(20,12,7,0.4)");
      gradient.addColorStop(1, "rgba(20,12,7,0)");
      ctx.fillStyle = gradient; ctx.fillRect(-128, -128, 256, 256);
      shadow.refresh();
    }
    this.foreground = scene.add.container(0, 0).setDepth(9500).setName("player-cover-world");
    world.add(this.foreground).sort("depth");
    this.scars = scene.add.graphics(); this.foreground.add(this.scars);
    this.feedback = scene.add.graphics().setDepth(11000);
  }
  reset(map: string) {
    this.map = map;
    this.ground.reset(map);
    for (const { image, shadow } of this.covers) { image.destroy(); shadow.destroy(); }
    this.covers = [];
    for (const [i, cover] of playerCovers[map as keyof typeof playerCovers].entries()) {
      const shadow = this.scene.add.image(0, 0, "cover-contact-shadow").setOrigin(.5, .5)
        .setName(`player-cover-shadow-${i}`);
      const image = this.scene.add.image(0, 0, "player-covers", cover.frame).setOrigin(.5, 1)
        .setName(`player-cover-${cover.frame}`);
      const anchor = coverAnchor(map, cover.frame, i);
      image.setData("anchor", anchor);
      if (map === "street") image.setTint(0xc5bac3);
      if (map === "tavern") image.setTint(0xe6c7a4);
      this.covers.push({ image, shadow, anchor, frame: cover.frame });
      this.foreground.add([shadow, image]);
    }
    this.foreground.bringToTop(this.scars);
    this.impacts = []; this.marks = []; this.hurtUntil = 0; this.feedback.clear(); this.scars.clear();
  }
  update(player: CoverMovement, now: number) {
    this.ground.update(player.position);
    for (const { image, shadow, anchor, frame } of this.covers) {
      const p = projectPlayerCover(this.map, anchor, player.position);
      image.setPosition(p.x, p.groundY).setDisplaySize(p.width, p.height);
      // Feet, wheel rims and tabletop edge meet the same projected ground contact.
      shadow.setPosition(p.x, p.groundY - 2).setDisplaySize(p.width * 1.08, p.width * .13);
      if (frame === "wagon") shadow.setAlpha(.8);
    }
    const scars = this.scars.clear();
    for (const mark of this.marks) {
      const point = this.coverPoint(mark);
      scars.fillStyle(0x26180e, .85).fillEllipse(point.x, point.y, 4, 3);
      scars.lineStyle(1, 0xc19964, .65).lineBetween(point.x - 3, point.y + 2, point.x + 3, point.y - 2);
    }
    const g = this.feedback.clear();
    this.impacts = this.impacts.filter(p => now - p.at < 240);
    const matrix = this.world.getWorldTransformMatrix();
    for (const p of this.impacts) {
      const age = (now - p.at) / 240;
      const end = p.point ? this.coverPoint(p.point) : null;
      const screen = end ? matrix.transformPoint(end.x, end.y) : { x: 480, y: 500 };
      if (p.from) {
        const start = matrix.transformPoint(p.from.x, p.from.y);
        g.lineStyle(2, 0xffd99c, (1 - age) * 0.7).lineBetween(start.x, start.y, screen.x, screen.y);
      }
      if (p.point) for (let i = 0; i < 7; i++) {
        const a = i * 2.4;
        g.lineStyle(2, 0xc89455, 1 - age).lineBetween(screen.x, screen.y,
          screen.x + Math.cos(a) * age * 45, screen.y + Math.sin(a) * age * 35 + age * age * 25);
      }
    }
    if (now < this.hurtUntil) {
      const alpha = (this.hurtUntil - now) / 450;
      g.lineStyle(18, 0x9d1d17, alpha * 0.7).strokeRect(4, 4, 952, 532);
    }
  }
  /** Read the actual isolated sprite's alpha, including empty space beneath a wagon. */
  hitCover(x: number, y: number): CoverHit | undefined {
    for (let index = this.covers.length - 1; index >= 0; index--) {
      const image = this.covers[index].image;
      const u = (x - image.x) / image.displayWidth + .5;
      const v = (y - image.y) / image.displayHeight + 1;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      const alpha = this.scene.textures.getPixelAlpha(Math.floor(u * image.frame.width), Math.floor(v * image.frame.height),
        image.texture.key, image.frame.name) ?? 0;
      if (alpha >= 128) return { index, u, v };
    }
    return undefined;
  }
  private coverPoint(hit: CoverHit) {
    const image = this.covers[hit.index].image;
    return { x: image.x + (hit.u - .5) * image.displayWidth, y: image.y + (hit.v - 1) * image.displayHeight };
  }
  private addMark(hit: CoverHit) {
    this.marks.push(hit);
    if (this.marks.length > 24) this.marks.shift();
  }
  playerImpact(point: CoverHit, at: number) {
    this.addMark(point); this.impacts.push({ point, at });
  }
  incoming(x: number, y: number, at: number, hit: boolean, lane: number, outcome: string) {
    let point: CoverHit | undefined;
    if (outcome !== "hit") {
      const index = Math.max(0, Math.min(2, Math.round(lane)));
      const frame = this.covers[index].frame;
      point = { index, u: frame === "barrels" ? .28 : .5, v: frame === "wagon" ? .32 : .52 };
      this.addMark(point);
    }
    this.impacts.push({ from: { x, y }, point, at });
    if (hit) this.hurtUntil = at + 450;
    if (!point) return 480;
    const end = this.coverPoint(point);
    return this.world.getWorldTransformMatrix().transformPoint(end.x, end.y).x;
  }
}

/** Cached in-between frames and continuous shoulder motion use the game clock. */
export function animateGunman(view: Phaser.GameObjects.Container, progress: number, now: number, firedAt?: number) {
  const scene = view.scene;
  const appearance = String(view.getData("appearance"));
  const row = appearance.includes("bandolier") ? 1 : appearance.includes("scar") ? 2 : appearance === "boss" ? 3 : 0;
  let image = view.getData("combat-image") as Phaser.GameObjects.Image | undefined;
  let flare = view.getData("combat-flare") as Phaser.GameObjects.Graphics | undefined;
  if (!image) {
    const original = view.list.find(child => child.type === "Image") as Phaser.GameObjects.Image;
    original.setAlpha(0);
    image = scene.add.image(0, 0, `gunman-motion-${row}`, "0").setOrigin(0.5, 0.57).setTint(original.tintTopLeft);
    flare = scene.add.graphics();
    view.add([image, flare]);
    view.setData({ "combat-image": image, "combat-flare": flare });
  }
  const age = firedAt === undefined ? Infinity : now - firedAt;
  const recoil = age >= 0 && age < gunmanAnimation.recoveryMs;
  const frame = String(sampleGunmanFrame(progress, now, firedAt));
  if (image.frame.name !== frame) image.setFrame(frame);
  image.setDisplaySize(row === 3 ? 112 : 84, 112);
  const kick = recoil ? Math.sin(Math.PI * Math.min(1, age / 190)) * Math.exp(-age / 170) : 0;
  const rise = Math.min(1, Math.max(0, progress / gunmanAnimation.raiseFraction));
  image.setPosition(-kick * 1.4, -kick * 2 - (firedAt === undefined ? Math.sin(rise * Math.PI) * .6 : 0));
  image.rotation = -kick * .018;
  flare!.clear();
  if (recoil && age < 65) {
    const muzzleY = -20 - kick * 5;
    const strength = 1 - age / 65;
    flare!.fillStyle(0xffd488, strength * .5).fillCircle(-5, muzzleY, 18);
    flare!.fillStyle(0xfff7ca, strength).fillTriangle(-13, muzzleY + 2, -4, muzzleY - 20, 5, muzzleY + 4);
  }
}
