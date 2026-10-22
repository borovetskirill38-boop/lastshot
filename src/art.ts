import Phaser from "phaser";
import townTexture from "./visuals/town.webp?inline";
import peopleTexture from "./visuals/people.webp?inline";
import weaponTexture from "./visuals/revolver-hand.webp?inline";

type Graphics = Phaser.GameObjects.Graphics;
const townArtworkKey = "town-artwork";
const sceneryKey = "town-scenery";
const peopleKey = "western-people";
const looks = {
  bandit: ["mustache", "bandolier", "scar"],
  civilian: ["shopkeeper", "basket", "rancher", "book"],
} as const;
const appearances = new WeakMap<
  Phaser.Scene,
  { bandit: number; civilian: number }
>();

/** Inline images load through Phaser, including when the HTML runs offline. */
export function preloadArt(scene: Phaser.Scene) {
  scene.load.image(townArtworkKey, townTexture);
  scene.load.image(peopleKey, peopleTexture);
  scene.load.image("revolver-hand", weaponTexture);
}

/** Pre-rendered lighting and materials keep the detailed environment inexpensive. */
export function drawTown(
  scene: Phaser.Scene,
  slots: { x: number; y: number }[],
) {
  if (!scene.textures.exists(sceneryKey)) {
    const artwork = scene.textures
      .get(townArtworkKey)
      .getSourceImage() as HTMLImageElement;
    const baked = scene.textures.createCanvas(sceneryKey, 960, 540)!;
    const context = baked.context;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    // Align painted openings to the original hit/surface coordinates once at load.
    // Source landmarks are measured on the 942-pixel-tall environment artwork.
    const rows = [
      [0, 0],
      [70, 65],
      [196, 137],
      [280, 183],
      [315, 195],
      [468, 297],
      [502, 309],
      [545, 335],
      [578, 347],
      [735, 449],
      [765, 461],
      [805, 482],
      [942, 540],
    ];
    for (let i = 1; i < rows.length; i++) {
      const [fromY, toY] = rows[i - 1];
      const [nextFrom, nextTo] = rows[i];
      context.drawImage(
        artwork,
        0,
        (fromY * artwork.height) / 942,
        artwork.width,
        ((nextFrom - fromY) * artwork.height) / 942,
        0,
        toY,
        960,
        nextTo - toY,
      );
    }
    baked.refresh();
  }
  const source = scene.textures.get(sceneryKey).getSourceImage();
  scene.add
    .image(0, 0, sceneryKey)
    .setOrigin(0)
    .setDisplaySize(960, 540)
    .setDepth(-1);
  // Foreground sills hide the waist edge so people stand inside the windows.
  for (const slot of slots) {
    scene.add
      .image(0, 0, sceneryKey)
      .setOrigin(0)
      .setDisplaySize(960, 540)
      .setCrop(
        ((slot.x - 70) * source.width) / 960,
        ((slot.y + 44) * source.height) / 540,
        (146 * source.width) / 960,
        (14 * source.height) / 540,
      )
      .setDepth(15);
  }
}

/** All appearances share one atlas; each role cycles without changing gameplay RNG. */
export function createPerson(
  scene: Phaser.Scene,
  x: number,
  y: number,
  civilian: boolean,
  boss = false,
) {
  const texture = scene.textures.get(peopleKey);
  const source = texture.getSourceImage();
  if (!texture.has("bandit-mustache")) {
    const names = [
      ...looks.bandit.map((look) => `bandit-${look}`),
      "boss",
      ...looks.civilian.map((look) => `civilian-${look}`),
    ];
    names.forEach((name, i) => {
      const left = Math.round(((i % 4) * source.width) / 4);
      const right = Math.round((((i % 4) + 1) * source.width) / 4);
      const top = Math.round((Math.floor(i / 4) * source.height) / 2);
      const bottom = Math.round(((Math.floor(i / 4) + 1) * source.height) / 2);
      texture.add(name, 0, left, top, right - left, bottom - top);
    });
  }
  let counters = appearances.get(scene);
  if (!counters) {
    counters = { bandit: 0, civilian: 0 };
    appearances.set(scene, counters);
  }
  const role = civilian ? "civilian" : "bandit";
  const variant = boss
    ? "boss"
    : `${role}-${looks[role][counters[role]++ % looks[role].length]}`;
  const shadow = scene.add.ellipse(2, 42, 66, 10, 0x080d12, 0.48);
  const portrait = scene.add
    .image(0, 0, peopleKey, variant)
    .setOrigin(0.5, 0.57)
    .setDisplaySize(84, 112);
  return scene.add
    .container(x, y, [shadow, portrait])
    .setDepth(10)
    .setData({ appearance: variant, civilian, boss });
}

/** Small cached light/casing textures complement the photographic view model. */
function createWeaponEffects(scene: Phaser.Scene) {
  if (!scene.textures.exists("weapon-flare")) {
    const texture = scene.textures.createCanvas("weapon-flare", 128, 160)!;
    const c = texture.context;
    c.translate(64, 132);
    const halo = c.createRadialGradient(0, -13, 1, 0, -13, 60);
    halo.addColorStop(0, "rgba(255,237,173,0.95)");
    halo.addColorStop(0.25, "rgba(255,169,55,0.45)");
    halo.addColorStop(1, "rgba(255,98,15,0)");
    c.fillStyle = halo;
    c.fillRect(-64, -100, 128, 128);
    const flame = c.createLinearGradient(0, -70, 0, 2);
    flame.addColorStop(0, "rgba(255,131,30,0)");
    flame.addColorStop(0.4, "rgba(255,191,76,0.9)");
    flame.addColorStop(1, "#fff8dd");
    c.fillStyle = flame;
    c.beginPath();
    c.moveTo(-6, 0);
    c.quadraticCurveTo(-22, -20, -19, -34);
    c.quadraticCurveTo(-7, -22, -3, -73);
    c.quadraticCurveTo(8, -46, 9, -28);
    c.quadraticCurveTo(26, -40, 14, -12);
    c.quadraticCurveTo(11, 0, -6, 0);
    c.fill();
    texture.refresh();
  }
  if (!scene.textures.exists("weapon-brass")) {
    const texture = scene.textures.createCanvas("weapon-brass", 64, 22)!;
    const c = texture.context;
    const metal = c.createLinearGradient(0, 2, 0, 20);
    metal.addColorStop(0, "#6b431b");
    metal.addColorStop(0.32, "#fff0ad");
    metal.addColorStop(0.55, "#d7a548");
    metal.addColorStop(1, "#805324");
    c.fillStyle = metal;
    c.fillRect(7, 3, 50, 16);
    c.fillStyle = "#e2bd69";
    c.beginPath();
    c.ellipse(7, 11, 5, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#775024";
    c.beginPath();
    c.ellipse(57, 11, 4, 8, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#b29b68";
    c.beginPath();
    c.ellipse(6, 11, 2, 4, 0, 0, Math.PI * 2);
    c.fill();
    texture.refresh();
  }
}

/** First-person view model and transient effects all use gameplay delta (pause-safe). */
export class ViewWeapon {
  readonly view: Phaser.GameObjects.Container;
  readonly crosshair: Graphics;
  readonly model: Phaser.GameObjects.Image;
  readonly flash: Phaser.GameObjects.Image;
  private readonly muzzleLocal = new Phaser.Math.Vector2(-18, -172);
  private readonly cylinderLocal = new Phaser.Math.Vector2(25, -111);
  private age = 0;
  readonly smoke: Graphics;
  readonly effects: Phaser.GameObjects.Container;
  aimX = 480;
  aimY = 270;
  recoil = 0;
  flashRemaining = 0;
  smokeAge = 1000;
  shells: {
    view: Phaser.GameObjects.Container;
    vx: number;
    vy: number;
    spin: number;
    age: number;
  }[] = [];
  constructor(private scene: Phaser.Scene) {
    createWeaponEffects(scene);
    this.model = scene.add
      .image(25, -2, "revolver-hand")
      .setOrigin(0.5, 0.78)
      .setDisplaySize((250 * 2) / 3, 250);
    this.flash = scene.add
      .image(this.muzzleLocal.x, this.muzzleLocal.y, "weapon-flare")
      .setOrigin(0.5, 0.825)
      .setRotation(-0.68)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.view = scene.add.container(610, 530, [this.model, this.flash]).setDepth(100);
    this.effects = scene.add.container(0, 0).setDepth(110);
    this.smoke = scene.add.graphics().setDepth(105);
    this.crosshair = scene.add.graphics().setDepth(120);
    this.crosshair.lineStyle(3, 0x242a2c, 0.85).strokeCircle(0, 0, 11);
    this.crosshair.lineStyle(1, 0xffe9b3).strokeCircle(0, 0, 10);
    for (const [x, y, ex, ey] of [
      [-16, 0, -7, 0],
      [7, 0, 16, 0],
      [0, -16, 0, -7],
      [0, 7, 0, 16],
    ])
      this.crosshair.lineBetween(x, y, ex, ey);
    this.reset();
  }
  aim(x: number, y: number) {
    this.aimX = Phaser.Math.Clamp(x, 0, 960);
    this.aimY = Phaser.Math.Clamp(y, 0, 540);
  }
  reset() {
    this.recoil = 0;
    this.age = 0;
    this.flashRemaining = 0;
    this.smokeAge = 1000;
    this.flash.setVisible(false);
    this.smoke.clear();
    for (const s of this.shells) s.view.destroy();
    this.shells = [];
    this.aim(480, 270);
    this.update(0, false);
  }
  muzzle() {
    return this.view
      .getWorldTransformMatrix()
      .transformPoint(this.muzzleLocal.x, this.muzzleLocal.y);
  }
  fire() {
    this.recoil = 1;
    this.flashRemaining = 95;
    this.smokeAge = 0;
    this.flash.setVisible(true).setScale(0.85).setAlpha(1);
    this.model.setTint(0xffebcf);
    const p = this.view
      .getWorldTransformMatrix()
      .transformPoint(this.cylinderLocal.x, this.cylinderLocal.y);
    const casing = this.scene.add.image(0, 0, "weapon-brass").setDisplaySize(17, 6);
    const view = this.scene.add.container(p.x, p.y, [casing]);
    this.effects.add(view);
    this.shells.push({
      view,
      vx: 180 + Math.random() * 70,
      vy: -230 - Math.random() * 40,
      spin: 7 + Math.random() * 5,
      age: 0,
    });
  }
  update(delta: number, reloading: boolean) {
    const dt = Math.min(delta, 80) / 1000;
    this.age += dt;
    this.recoil = Math.max(0, this.recoil - dt * 4.8);
    this.flashRemaining = Math.max(0, this.flashRemaining - delta);
    this.flash
      .setVisible(this.flashRemaining > 0)
      .setScale(0.6 + (0.25 * this.flashRemaining) / 95)
      .setAlpha(this.flashRemaining / 95);
    this.model.setTint(this.flashRemaining > 55 ? 0xffebcf : 0xffffff);
    this.smokeAge += delta;
    const targetX =
      610 + (this.aimX - 480) * 0.075 + Math.sin(this.age * 1.7) * 0.8;
    const targetY =
      530 +
      (this.aimY - 270) * 0.018 +
      Math.sin(this.age * 1.4) * 1.1 +
      (reloading ? 95 : 0);
    const smooth = delta === 0 ? 1 : 1 - Math.exp(-dt * 14);
    this.view.x = Phaser.Math.Linear(this.view.x, targetX, smooth);
    this.view.y = Phaser.Math.Linear(this.view.y, targetY, smooth);
    this.view.rotation =
      (this.aimX - 480) * 0.00016 -
      this.recoil * 0.13 +
      Math.sin(this.age * 1.4) * 0.002 +
      (reloading ? 0.28 : 0);
    this.view.setScale(0.9 + this.recoil * 0.03);
    this.crosshair
      .setPosition(this.aimX, this.aimY)
      .setAlpha(reloading ? 0.3 : 1);
    this.smoke.clear();
    if (this.smokeAge < 600) {
      const p = this.muzzle(),
        t = this.smokeAge / 600;
      for (let i = 0; i < 3; i++)
        this.smoke
          .fillStyle(0xd8cdb4, (1 - t) * 0.16)
          .fillCircle(
            p.x + Math.sin(t * 5 + i) * 8,
            p.y - 15 - t * 45 - i * 7,
            5 + t * 13,
          );
    }
    for (const s of [...this.shells]) {
      s.age += delta;
      s.vy += 620 * dt;
      s.view.x += s.vx * dt;
      s.view.y += s.vy * dt;
      s.view.rotation += s.spin * dt;
      s.view.setAlpha(Math.min(1, (1100 - s.age) / 250));
      if (s.age >= 1100) {
        s.view.destroy();
        this.shells = this.shells.filter((v) => v !== s);
      }
    }
  }
}
