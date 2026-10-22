import Phaser from "phaser";
import townTexture from "./visuals/town.webp?inline";
import peopleTexture from "./visuals/people.webp?inline";

type Graphics = Phaser.GameObjects.Graphics;
function poly(g: Graphics, color: number, points: number[], alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillPoints(
    Array.from(
      { length: points.length / 2 },
      (_, i) => new Phaser.Geom.Point(points[i * 2], points[i * 2 + 1]),
    ),
    true,
  );
}
function box(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  front: number,
  top: number,
  side: number,
  d = 7,
) {
  g.fillStyle(front).fillRect(x, y, w, h);
  poly(g, top, [x, y, x + d, y - d, x + w + d, y - d, x + w, y]);
  poly(g, side, [
    x + w,
    y,
    x + w + d,
    y - d,
    x + w + d,
    y + h - d,
    x + w,
    y + h,
  ]);
}

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

/** First-person view model and transient effects all use gameplay delta (pause-safe). */
export class ViewWeapon {
  readonly view: Phaser.GameObjects.Container;
  readonly crosshair: Graphics;
  readonly flash: Graphics;
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
    const g = scene.add.graphics();
    // Sleeve and right hand behind the grip.
    poly(g, 0x292f36, [-16, 7, 32, 12, 76, 104, -27, 104, -38, 49]);
    poly(g, 0x556371, [-17, 24, 15, 29, 43, 104, -22, 104, -32, 49]);
    poly(
      g,
      0xd9aa7c,
      [-31, -37, -14, -50, 9, -44, 23, -20, 20, 18, 1, 34, -24, 18, -37, -6],
    );
    poly(g, 0x976345, [6, -35, 20, -19, 20, 17, 1, 33, -7, 12]);
    // Walnut grip, steel frame and open trigger guard.
    poly(g, 0x312b27, [-19, -68, 16, -62, 29, -4, 14, 29, -10, 25, -25, -26]);
    poly(g, 0x8d5130, [-16, -57, 10, -53, 22, 0, 12, 20, -5, 17, -19, -23]);
    for (let i = 0; i < 6; i++)
      g.lineStyle(2, 0xc88a4a, 0.6).lineBetween(
        -12,
        -42 + i * 9,
        12,
        -36 + i * 9,
      );
    g.lineStyle(5, 0x879397).strokeEllipse(-21, -52, 40, 41);
    g.lineStyle(2, 0xdce1d2).strokeEllipse(-23, -54, 36, 37);
    g.lineStyle(4, 0x424b52).lineBetween(-16, -67, -19, -52);
    // Cylinder and frame seen obliquely from the right shoulder.
    box(g, -27, -101, 52, 38, 0x687980, 0xc4cdc6, 0x333f49, 8);
    g.fillStyle(0x9eacae).fillRoundedRect(-32, -105, 53, 34, 9);
    for (let x = -23; x < 19; x += 13) {
      g.fillStyle(0x46565d).fillRoundedRect(x, -99, 7, 22, 3);
      g.lineStyle(1, 0xd1d4be).lineBetween(x, -99, x, -78);
    }
    poly(g, 0x3b484f, [-19, -106, -13, -158, 4, -158, 19, -103]);
    poly(g, 0x8e9d9d, [-19, -106, -13, -158, -6, -159, 0, -104]);
    poly(g, 0xcbd4c7, [-13, -158, -6, -163, 10, -158, 4, -153]);
    g.fillStyle(0x19272e).fillEllipse(-2, -157, 16, 8);
    g.lineStyle(2, 0xe1d9b8).strokeEllipse(-2, -157, 17, 8);
    g.fillStyle(0x222f36).fillRect(-4, -169, 4, 10); // front sight
    poly(g, 0xa3adab, [13, -110, 24, -122, 29, -117, 23, -104]); // hammer
    g.fillStyle(0xd4c28e).fillCircle(12, -70, 3);
    // Fingers wrap around the near side of the grip.
    for (let i = 0; i < 3; i++) {
      g.fillStyle(i % 2 ? 0xb47d56 : 0xdca67a).fillRoundedRect(
        -21,
        -31 + i * 11,
        32,
        10,
        4,
      );
      g.lineStyle(1, 0x815b44).lineBetween(-15, -23 + i * 11, 7, -23 + i * 11);
    }
    this.flash = scene.add.graphics().setVisible(false);
    poly(
      this.flash,
      0xff6b21,
      [
        -2, -161, -23, -179, -11, -179, -7, -207, 2, -185, 17, -200, 10, -177,
        27, -176, 7, -164,
      ],
    );
    poly(
      this.flash,
      0xffd354,
      [-2, -163, -13, -180, -5, -178, -5, -195, 3, -178, 13, -187, 7, -171],
    );
    poly(this.flash, 0xfff4bf, [-4, -165, -7, -180, 1, -175, 5, -182, 5, -167]);
    this.view = scene.add.container(610, 530, [g, this.flash]).setDepth(100);
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
    return this.view.getWorldTransformMatrix().transformPoint(-2, -160);
  }
  fire() {
    this.recoil = 1;
    this.flashRemaining = 95;
    this.smokeAge = 0;
    this.flash.setVisible(true);
    const p = this.view.getWorldTransformMatrix().transformPoint(24, -87);
    const g = this.scene.add.graphics();
    box(g, -6, -3, 13, 6, 0xc29440, 0xffdd84, 0x74542c, 2);
    g.fillStyle(0xf7d06b).fillEllipse(-6, 0, 4, 8);
    const view = this.scene.add.container(p.x, p.y, [g]);
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
    this.recoil = Math.max(0, this.recoil - dt * 4.8);
    this.flashRemaining = Math.max(0, this.flashRemaining - delta);
    this.flash.setVisible(this.flashRemaining > 0);
    this.smokeAge += delta;
    const targetX = 610 + (this.aimX - 480) * 0.075;
    const targetY = 530 + (this.aimY - 270) * 0.018 + (reloading ? 95 : 0);
    const smooth = delta === 0 ? 1 : 1 - Math.exp(-dt * 14);
    this.view.x = Phaser.Math.Linear(this.view.x, targetX, smooth);
    this.view.y = Phaser.Math.Linear(this.view.y, targetY, smooth);
    this.view.rotation =
      (this.aimX - 480) * 0.00016 - this.recoil * 0.13 + (reloading ? 0.28 : 0);
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
