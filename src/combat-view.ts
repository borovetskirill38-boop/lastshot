import Phaser from "phaser";
import { playerCovers, CoverMovement } from "./combat.js";

export class CombatView {
  readonly foreground: Phaser.GameObjects.Container;
  readonly feedback: Phaser.GameObjects.Graphics;
  private covers: Phaser.GameObjects.Image[] = [];
  private impacts: { x: number; y: number; at: number; hit: boolean; endX: number; endY: number; blocked: boolean }[] = [];
  private hurtUntil = 0;
  constructor(private scene: Phaser.Scene) {
    const texture = scene.textures.get("player-covers");
    // Measured opaque silhouettes, excluding the transparent gutters.
    const frames = { barrels: [8, 112, 565, 483], wagon: [582, 116, 730, 480], table: [1312, 182, 850, 392] };
    for (const [key, [x, y, w, h]] of Object.entries(frames)) if (!texture.has(key)) texture.add(key, 0, x, y, w, h);
    this.foreground = scene.add.container(0, 0).setDepth(9500);
    this.feedback = scene.add.graphics().setDepth(11000);
  }
  reset(map: string) {
    this.foreground.removeAll(true); this.covers = [];
    for (const cover of playerCovers[map as keyof typeof playerCovers]) {
      const image = cover.frame === "crates"
        ? this.scene.add.image(0, 0, "cover-props", "crates")
        : this.scene.add.image(0, 0, "player-covers", cover.frame);
      image.setOrigin(0.5, 0).setName(`player-cover-${cover.frame}`);
      const width = cover.frame === "wagon" ? 660 : cover.frame === "table" ? 620 : 540;
      image.setDisplaySize(width, width * image.frame.height / image.frame.width);
      if (map === "street") image.setTint(0xc5bac3);
      if (map === "tavern") image.setTint(0xe6bb8d);
      this.covers.push(image); this.foreground.add(image);
    }
    this.impacts = []; this.hurtUntil = 0; this.feedback.clear();
  }
  update(player: CoverMovement, now: number) {
    this.covers.forEach((cover, i) => cover.setPosition(480 + (i - player.position) * 650, 454 - player.duck * 240));
    const g = this.feedback.clear();
    this.impacts = this.impacts.filter(p => now - p.at < 240);
    for (const p of this.impacts) {
      const age = (now - p.at) / 240;
      g.lineStyle(2, 0xffd99c, (1 - age) * 0.7).lineBetween(p.x, p.y, p.endX, p.endY);
      if (p.blocked) for (let i = 0; i < 7; i++) {
        const a = i * 2.4;
        g.lineStyle(2, 0xc89455, 1 - age).lineBetween(p.endX, p.endY,
          p.endX + Math.cos(a) * age * 70, p.endY + Math.sin(a) * age * 55);
      }
    }
    if (now < this.hurtUntil) {
      const alpha = (this.hurtUntil - now) / 450;
      g.lineStyle(18, 0x9d1d17, alpha * 0.7).strokeRect(4, 4, 952, 532);
    }
  }
  impact(x: number, y: number, now: number, hit: boolean, endX: number, endY: number, blocked: boolean) {
    this.impacts.push({ x, y, at: now, hit, endX, endY, blocked });
    if (hit) this.hurtUntil = now + 450;
  }
}

/** A shared atlas keeps hats/faces consistent as the shoulder and gun rise. */
export function animateGunman(view: Phaser.GameObjects.Container, progress: number, now: number, firedAt?: number) {
  const scene = view.scene;
  const texture = scene.textures.get("enemy-combat");
  const source = texture.getSourceImage();
  if (!texture.has("0-0")) for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const x = Math.round(col * source.width / 4), y = Math.round(row * source.height / 4);
    texture.add(`${row}-${col}`, 0, x, y, Math.round((col + 1) * source.width / 4) - x,
      Math.round((row + 1) * source.height / 4) - y);
  }
  const appearance = String(view.getData("appearance"));
  const row = appearance.includes("bandolier") ? 1 : appearance.includes("scar") ? 2 : appearance === "boss" ? 3 : 0;
  let image = view.getData("combat-image") as Phaser.GameObjects.Image | undefined;
  let flare = view.getData("combat-flare") as Phaser.GameObjects.Graphics | undefined;
  if (!image) {
    const original = view.list.find(child => child.type === "Image") as Phaser.GameObjects.Image;
    original.setAlpha(0);
    image = scene.add.image(0, 0, "enemy-combat", `${row}-0`).setOrigin(0.5, 0.57).setTint(original.tintTopLeft);
    flare = scene.add.graphics();
    view.add([image, flare]);
    view.setData({ "combat-image": image, "combat-flare": flare });
  }
  const age = firedAt === undefined ? Infinity : now - firedAt;
  const recoil = age >= 0 && age < 300;
  // The flash starts on the aimed muzzle; only then does the wrist kick upward.
  const frame = recoil ? age < 75 ? 2 : 3 : firedAt !== undefined ? 0 : progress < 0.22 ? 0 : progress < 0.48 ? 1 : 2;
  image.setTexture("enemy-combat", `${row}-${frame}`).setDisplaySize(row === 3 ? 112 : 84, 112);
  image.setPosition(recoil ? -Math.sin(age / 300 * Math.PI) * 2 : Math.sin(progress * Math.PI) * 1.2,
    recoil ? -Math.sin(age / 300 * Math.PI) * 3 : -Math.min(progress, 0.5) * 2);
  image.rotation = recoil ? -Math.sin(age / 300 * Math.PI) * 0.035 : 0;
  flare!.clear();
  if (recoil && age < 75) {
    flare!.fillStyle(0xffd488, 0.5).fillCircle(-5, -20, 18);
    flare!.fillStyle(0xfff7ca, 1).fillTriangle(-13, -18, -4, -40, 5, -16);
  }
}
