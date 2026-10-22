import Phaser from "phaser";

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

/** Layered, shaded procedural scenery: no remote assets in the offline build. */
export function drawTown(
  scene: Phaser.Scene,
  slots: { x: number; y: number }[],
) {
  const g = scene.add.graphics();
  for (let y = 0; y < 420; y += 6) {
    const color = Phaser.Display.Color.Interpolate.ColorWithColor(
      new Phaser.Display.Color(122, 163, 172),
      new Phaser.Display.Color(239, 208, 153),
      420,
      y,
    );
    g.fillStyle(
      Phaser.Display.Color.GetColor(color.r, color.g, color.b),
    ).fillRect(0, y, 960, 6);
  }
  g.fillStyle(0xffe7ae, 0.6).fillCircle(825, 63, 39);
  poly(
    g,
    0xb9a083,
    [0, 225, 0, 160, 55, 152, 90, 107, 143, 117, 175, 172, 252, 195, 310, 232],
  );
  poly(
    g,
    0xa58b75,
    [
      660, 231, 735, 170, 780, 179, 807, 135, 876, 124, 910, 192, 960, 177, 960,
      260,
    ],
  );
  g.fillStyle(0xc49660).fillRect(0, 420, 960, 120);
  poly(g, 0x665040, [95, 459, 847, 459, 958, 533, 238, 533], 0.3);
  box(g, 12, 231, 84, 197, 0x987354, 0xc29a70, 0x6c5140, 16);
  box(g, 872, 215, 88, 213, 0xb88b5d, 0xd5aa77, 0x795b44, 13);
  // Main facade and cornice, with cast shadows and recessed windows.
  box(g, 108, 137, 740, 318, 0x865738, 0xc28b57, 0x4e362e, 17);
  for (let y = 145; y < 450; y += 19) {
    g.fillStyle(((y / 19) | 0) % 2 ? 0x9b6a43 : 0x91613e).fillRect(
      117,
      y,
      722,
      17,
    );
    g.lineStyle(1, 0xc08c58, 0.5).lineBetween(117, y, 839, y);
    for (let x = 135; x < 835; x += 118)
      g.fillStyle(0x503e32).fillCircle(x, y + 8, 1.3);
  }
  poly(g, 0x302c29, [108, 137, 848, 137, 848, 166, 108, 155], 0.45);
  box(g, 94, 122, 768, 20, 0x543b2e, 0xc09260, 0x342a27, 11);
  box(g, 111, 109, 735, 12, 0x9f7046, 0xdeac6d, 0x503c2d, 8);
  box(g, 318, 65, 322, 65, 0xb78a50, 0xe8c184, 0x62472f, 8);
  g.lineStyle(2, 0x754c32).strokeRect(326, 74, 306, 46);
  scene.add
    .text(480, 98, "S A L O O N", {
      fontFamily: "Georgia",
      fontSize: "33px",
      color: "#392c25",
      shadow: { offsetX: 1, offsetY: 2, color: "#e7bc7e", blur: 0, fill: true },
    })
    .setOrigin(0.5);
  for (const s of slots) {
    box(g, s.x - 62, s.y - 70, 124, 123, 0xc49a66, 0xe0ba7f, 0x694934, 5);
    g.fillStyle(0x171e23).fillRect(s.x - 49, s.y - 58, 98, 104);
    poly(g, 0x3c302b, [
      s.x - 49,
      s.y - 58,
      s.x + 49,
      s.y - 58,
      s.x + 40,
      s.y - 46,
      s.x - 39,
      s.y - 46,
    ]);
    g.fillStyle(0x252528).fillRect(s.x - 49, s.y - 46, 10, 92);
    box(g, s.x - 69, s.y + 44, 138, 12, 0x8e603e, 0xe0b37a, 0x503b2d, 8);
    // Open shutters remain outside the hit areas.
    for (const sign of [-1, 1]) {
      const x = s.x + sign * 67 - (sign < 0 ? 18 : 0);
      box(g, x, s.y - 58, 18, 102, 0x79563a, 0xb88a53, 0x43362c, 3);
      for (let y = s.y - 51; y < s.y + 40; y += 12)
        g.lineStyle(2, 0x3e352c).lineBetween(x + 3, y, x + 15, y);
    }
  }
  for (const x of [113, 839])
    box(g, x, 143, 11, 312, 0xaa7c4b, 0xe6b87d, 0x564132, 5);
  box(g, 66, 470, 830, 12, 0x795338, 0xc89a61, 0x50392d, 12);
  for (let x = 85; x < 890; x += 54)
    g.lineStyle(1, 0x76563e).lineBetween(x, 459, x - 5, 470);
  // Barrel with curved staves, iron hoops and a shaded top.
  for (const [x, y, scale] of [
    [53, 430, 1],
    [904, 438, 0.85],
  ]) {
    g.fillStyle(0x493b2d, 0.35).fillEllipse(
      x + 12,
      y + 35 * scale,
      69 * scale,
      18 * scale,
    );
    g.fillStyle(0x785136).fillRoundedRect(
      x - 27 * scale,
      y - 38 * scale,
      54 * scale,
      72 * scale,
      12 * scale,
    );
    g.fillStyle(0xb2864e).fillRoundedRect(
      x - 21 * scale,
      y - 35 * scale,
      19 * scale,
      68 * scale,
      7 * scale,
    );
    for (let i = -1; i <= 1; i++)
      g.lineStyle(2, 0x594330).lineBetween(
        x + i * 13 * scale,
        y - 29 * scale,
        x + i * 14 * scale,
        y + 28 * scale,
      );
    g.fillStyle(0x4b5350)
      .fillRect(x - 27 * scale, y - 21 * scale, 54 * scale, 7 * scale)
      .fillRect(x - 27 * scale, y + 16 * scale, 54 * scale, 7 * scale);
    g.fillStyle(0xd0a56a).fillEllipse(
      x,
      y - 36 * scale,
      48 * scale,
      14 * scale,
    );
    g.lineStyle(3, 0x614932).strokeEllipse(
      x,
      y - 36 * scale,
      48 * scale,
      14 * scale,
    );
  }
  box(g, 8, 461, 52, 45, 0x967345, 0xd0a46c, 0x5e4833, 9);
  g.lineStyle(4, 0x5e4833)
    .lineBetween(12, 465, 56, 502)
    .lineBetween(56, 465, 12, 502);
  for (let i = 0; i < 55; i++)
    g.fillStyle(i % 2 ? 0xa77a4d : 0xddb67a, 0.65).fillEllipse(
      (i * 173) % 960,
      493 + ((i * 13) % 43),
      6 + (i % 4) * 3,
      2,
    );
  scene.add.text(26, 24, "DUSTY TOWN · 1886", {
    fontFamily: "monospace",
    fontSize: "16px",
    color: "#354b50",
  });
  // Bake static geometry once: mobile/software renderers need only one draw per frame.
  const textureKey = "town-scenery";
  if (scene.textures.exists(textureKey)) scene.textures.remove(textureKey);
  g.generateTexture(textureKey, 960, 540);
  scene.add.image(0, 0, textureKey).setOrigin(0).setDepth(-1);
  g.destroy();
}

export function createPerson(
  scene: Phaser.Scene,
  x: number,
  y: number,
  civilian: boolean,
  boss = false,
) {
  const g = scene.add.graphics();
  const coat = civilian ? 0x526c4c : boss ? 0x303846 : 0x714334;
  const light = civilian ? 0x8da575 : boss ? 0x667383 : 0xb07750;
  g.fillStyle(0x0b141c, 0.55).fillEllipse(3, 40, 72, 12);
  poly(g, coat, [-23, 0, -33, 12, -35, 43, 34, 43, 31, 12, 20, 0]);
  poly(g, light, [-23, 1, -7, -3, -5, 41, -27, 41, -26, 13]);
  poly(g, 0x20272b, [12, 0, 27, 6, 33, 42, 18, 42]);
  poly(g, 0xc5b28a, [-8, 2, 9, 2, 7, 35, -4, 35]);
  poly(g, 0x3f3530, [-21, 0, -9, 0, -4, 22, -15, 16]);
  g.fillStyle(0x72503c).fillRoundedRect(-19, -39, 38, 40, 9);
  g.fillStyle(0xc08c62).fillRoundedRect(-18, -38, 33, 35, 8);
  g.fillStyle(0xe9b986).fillRoundedRect(-15, -37, 22, 29, 7);
  poly(g, 0xa56e4b, [6, -24, 15, -19, 14, -13, 5, -13]);
  g.fillStyle(0x272a29).fillRect(-12, -24, 7, 3).fillRect(7, -24, 6, 3);
  g.fillStyle(0x503f35).fillRect(-10, -29, 9, 2).fillRect(5, -29, 9, 2);
  if (!civilian) poly(g, 0x3b302c, [-12, -10, 0, -13, 13, -9, 10, -4, -8, -4]);
  // Rounded crown, bevelled brim and a sunlit edge.
  g.fillStyle(0x1d2428).fillEllipse(2, -34, 77, 16);
  g.fillStyle(boss ? 0x303340 : 0x614a34).fillRoundedRect(-24, -58, 46, 27, 8);
  poly(
    g,
    boss ? 0x565866 : 0x9b7c4c,
    [-21, -54, -9, -58, 10, -56, 14, -35, -21, -35],
  );
  g.fillStyle(boss ? 0x8f4840 : 0x322d27).fillRect(-23, -39, 45, 6);
  g.fillStyle(boss ? 0x42434d : 0x826740).fillEllipse(-2, -33, 77, 10);
  g.lineStyle(2, 0xc4a775, 0.8).lineBetween(-33, -34, -6, -36);
  const scarf = civilian ? 0xe1d8a5 : 0xd44d35;
  poly(g, scarf, [-19, -3, 0, 0, 18, -4, 13, 8, -3, 10, -19, 5]);
  poly(g, civilian ? 0xb5ae80 : 0x872d29, [-3, 8, 10, 6, 16, 22, 3, 18]);
  g.fillStyle(0xddb084).fillRoundedRect(20, 17, 14, 13, 4);
  if (!civilian) {
    box(g, 22, 12, 21, 7, 0x737d7b, 0xd8d9ba, 0x303e43, 3);
    g.fillStyle(0x2b3032).fillRect(41, 12, 3, 7);
    if (boss) {
      poly(
        g,
        0xd7b65d,
        Array.from({ length: 20 }, (_, i) => {
          const a = (Math.floor(i / 2) * Math.PI) / 5 - Math.PI / 2;
          const r = Math.floor(i / 2) % 2 ? 3 : 7;
          return i % 2 ? 20 + Math.sin(a) * r : -17 + Math.cos(a) * r;
        }),
      );
    }
  } else {
    box(g, 22, 9, 15, 22, 0xbe9d6c, 0xf3dab0, 0x876a48, 2);
  }
  return scene.add.container(x, y, [g]).setDepth(10);
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
