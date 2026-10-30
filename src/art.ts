import Phaser from "phaser";
import townTexture from "./visuals/town.webp?inline";
import peopleTexture from "./visuals/people.webp?inline";
import weaponTexture from "./visuals/revolver-hand.webp?inline";
import arsenalModels from "./visuals/arsenal-models.webp?inline";
import longGunModels from "./visuals/long-gun-models.webp?inline";
import enemyCombat from "./visuals/enemy-combat.webp?inline";
import playerCoverArt from "./visuals/player-covers.webp?inline";
import telegraphArt from "./visuals/telegraph-box.webp?inline";
import streetTexture from "./visuals/street-dusk.webp?inline";
import tavernTexture from "./visuals/tavern.webp?inline";
import bossTexture from "./visuals/boss-encounter.webp?inline";
import propTexture from "./visuals/cover-props.webp?inline";
import { maps } from "./maps.js";
import { mapProps, propFrames } from "./props.js";
import { getWeapon } from "./arsenal.js";

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
  scene.load.image("street-dusk", streetTexture);
  scene.load.image("tavern", tavernTexture);
  scene.load.image("boss-encounter", bossTexture);
  scene.load.image("cover-props", propTexture);
  scene.load.image(peopleKey, peopleTexture);
  scene.load.image("revolver-hand", weaponTexture);
  scene.load.image("arsenal-models", arsenalModels);
  scene.load.image("long-gun-models", longGunModels);
  scene.load.image("enemy-combat", enemyCombat);
  scene.load.image("player-covers", playerCoverArt);
  scene.load.image("telegraph-box", telegraphArt);
}

/** Uniform projection keeps the architecture and its room furniture undistorted. */
function renderMap(scene: Phaser.Scene, mapId: "saloon" | "street" | "tavern") {
  const map = maps.find((entry) => entry.id === mapId)!;
  let background = mapId === "saloon" ? sceneryKey : mapId === "street" ? "street-dusk" : "tavern";
  if (mapId === "saloon" && !scene.textures.exists(sceneryKey)) {
    const artwork = scene.textures.get(townArtworkKey).getSourceImage() as HTMLImageElement;
    const baked = scene.textures.createCanvas(sceneryKey, 960, 540)!;
    baked.context.imageSmoothingQuality = "high";
    baked.context.drawImage(artwork, 0, 0, 960, 540);
    baked.refresh();
  }
  const artwork = scene.textures.get(background).getSourceImage() as HTMLImageElement;
  const layers = [scene.add.image(0, 0, background).setOrigin(0).setDisplaySize(960, 540)
    .setDepth(-1).setName("map-background")];
  // Each painted obstacle gets its own depth, including the sloping bar and curved table.
  for (const cover of map.paintedCovers) {
    const left = Math.floor(Math.min(...cover.polygon.map(([x]) => x)));
    const top = Math.floor(Math.min(...cover.polygon.map(([, y]) => y)));
    const right = Math.ceil(Math.max(...cover.polygon.map(([x]) => x)));
    const bottom = Math.ceil(Math.max(...cover.polygon.map(([, y]) => y)));
    const key = `${mapId}-foreground-${cover.id}`;
    if (!scene.textures.exists(key)) {
      const texture = scene.textures.createCanvas(key, right - left, bottom - top)!;
      const context = texture.context;
      context.translate(-left, -top);
      context.beginPath();
      cover.polygon.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y));
      context.closePath();
      context.clip();
      context.drawImage(artwork, 0, 0, 960, 540);
      texture.refresh();
    }
    layers.push(scene.add.image(left, top, key).setOrigin(0).setDepth(cover.depth)
      .setName(`cover-${cover.id}`));
  }
  const texture = scene.textures.get("cover-props");
  for (const [name, [x, y, width, height]] of Object.entries(propFrames)) {
    if (!texture.has(name)) texture.add(name, 0, x, y, width, height);
  }
  if (mapId !== "saloon") for (const prop of mapProps[mapId]) {
    const image = scene.add.image(prop.x, prop.y, "cover-props", prop.frame)
      .setOrigin(0.5, 0).setDisplaySize(prop.width, prop.height)
      .setDepth(prop.depth).setName(`cover-${prop.id}`);
    if (mapId === "street" && prop.frame === "crates") image.setTint(0xb9c2d6);
    layers.push(image);
  }
  return layers;
}

export function drawTown(scene: Phaser.Scene, _slots?: unknown[]) { return renderMap(scene, "saloon"); }
export function drawStreet(scene: Phaser.Scene, _slots?: unknown[]) { return renderMap(scene, "street"); }
export function drawTavern(scene: Phaser.Scene) { return renderMap(scene, "tavern"); }

/** All appearances share one atlas; each role cycles without changing gameplay RNG. */
export function createPerson(
  scene: Phaser.Scene,
  x: number,
  y: number,
  civilian: boolean,
  boss = false,
  scale = 1,
  tint = 0xffffff,
) {
  if (boss) return createBoss(scene, x, y, scale, tint, "boss");
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
  const variant = `${role}-${looks[role][counters[role]++ % looks[role].length]}`;
  const shadow = scene.add.ellipse(2, 42, 66, 10, 0x080d12, 0.48);
  const portrait = scene.add
    .image(0, 0, peopleKey, variant)
    .setOrigin(0.5, 0.57)
    .setDisplaySize(84, 112);
  portrait.setTint(tint);
  return scene.add
    .container(x, y, [shadow, portrait])
    .setScale(scale)
    .setDepth(10)
    .setData({ appearance: variant, civilian, boss });
}

/** Billy and Suzie use the very same atlas cells as their dialogue portraits. */
export function createBoss(
  scene: Phaser.Scene, x: number, y: number, scale: number, tint: number,
  appearance: "boss" | "shield" | "hostage",
) {
  const texture = scene.textures.get("boss-encounter");
  const source = texture.getSourceImage();
  if (!texture.has("boss")) {
    ["boss", "shield", "hostage"].forEach((name, i) => {
      const left = Math.round(i * source.width / 3);
      const right = Math.round((i + 1) * source.width / 3);
      texture.add(name, 0, left, 0, right - left, source.height);
    });
  }
  const shadow = scene.add.ellipse(0, 42, appearance === "shield" ? 88 : 66, 10, 0x080d12, 0.48);
  const portrait = scene.add.image(0, 0, "boss-encounter", appearance)
    .setOrigin(0.5, 0.57).setDisplaySize(112, 112).setTint(tint);
  return scene.add.container(x, y, [shadow, portrait]).setScale(scale).setDepth(10)
    .setData({ appearance, boss: appearance !== "hostage", civilian: appearance === "hostage" });
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
  private weaponId = "last-word";
  private recoilStrength = 1;
  private longGun = false;
  private shotgun = false;
  readonly smoke: Graphics;
  readonly effects: Phaser.GameObjects.Container;
  aimX = 480;
  aimY = 270;
  recoil = 0;
  coverAmount = 0;
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
    this.view = scene.add.container(610, 530, [this.model, this.flash]).setDepth(10000);
    this.effects = scene.add.container(0, 0).setDepth(10010);
    this.smoke = scene.add.graphics().setDepth(10005);
    this.crosshair = scene.add.graphics().setDepth(10020);
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
  setWeapon(weaponId: string) {
    const weapon = getWeapon(weaponId);
    weaponId = this.weaponId = weapon.id;
    this.recoilStrength = weapon.recoil;
    this.longGun = weapon.icon >= 3;
    this.shotgun = weapon.model === "coach" || weapon.model === "hunting";
    if (weaponId === "last-word") {
      this.model.setTexture("revolver-hand")
        .setPosition(25, -2).setOrigin(0.5, 0.78).setDisplaySize((250 * 2) / 3, 250);
      this.muzzleLocal.set(-18, -172);
      this.cylinderLocal.set(25, -111);
      this.flash.setRotation(-0.68);
    } else if (this.longGun) {
      const texture = this.scene.textures.get("long-gun-models");
      const source = texture.getSourceImage();
      const halfWidth = source.width / 2, halfHeight = source.height / 2;
      const frames = ["trail", "buffalo", "coach", "hunting"];
      if (!texture.has("trail")) {
        frames.forEach((name, i) => texture.add(name, 0, (i % 2) * halfWidth,
          Math.floor(i / 2) * halfHeight, halfWidth, halfHeight));
      }
      // Pixel measurements in each 627×627 cell; alpha bounds include both hands.
      const profiles: Record<string, { size: number; muzzle: [number, number]; breech: [number, number] }> = {
        trail: { size: 350, muzzle: [38, 47], breech: [405, 284] },
        buffalo: { size: 370, muzzle: [37, 44], breech: [381, 272] },
        coach: { size: 310, muzzle: [48, 55], breech: [365, 330] },
        hunting: { size: 370, muzzle: [34, 34], breech: [371, 296] },
      };
      const profile = profiles[weapon.model];
      this.model.setTexture("long-gun-models", weapon.model)
        .setPosition(20, 20).setOrigin(0.5, 0.78).setDisplaySize(profile.size, profile.size);
      const anchor = ([x, y]: [number, number]) => [
        20 + (x / halfWidth - 0.5) * profile.size,
        20 + (y / halfHeight - 0.78) * profile.size,
      ] as const;
      this.muzzleLocal.set(...anchor(profile.muzzle));
      this.cylinderLocal.set(...anchor(profile.breech));
      this.flash.setRotation(-0.85);
    } else {
      const texture = this.scene.textures.get("arsenal-models");
      const source = texture.getSourceImage();
      if (!texture.has("pocket")) {
        const half = Math.round(source.width / 2);
        texture.add("pocket", 0, 0, 0, half, source.height);
        texture.add("long", 0, half, 0, source.width - half, source.height);
      }
      this.model.setTexture("arsenal-models", weaponId === "dust-companion" ? "pocket" : "long")
        .setPosition(25, -2).setOrigin(0.5, 0.78)
        .setDisplaySize(250 * source.width / 2 / source.height, 250);
      if (weaponId === "dust-companion") {
        this.muzzleLocal.set(-32, -150);
        this.cylinderLocal.set(4, -122);
        this.flash.setRotation(-0.75);
      } else {
        this.muzzleLocal.set(-60, -175);
        this.cylinderLocal.set(13, -106);
        this.flash.setRotation(-0.82);
      }
    }
    this.flash.setPosition(this.muzzleLocal.x, this.muzzleLocal.y);
  }

  aim(x: number, y: number) {
    this.aimX = Phaser.Math.Clamp(x, 0, 960);
    this.aimY = Phaser.Math.Clamp(y, 0, 540);
  }
  reset() {
    this.recoil = 0;
    this.coverAmount = 0;
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
    this.flash.setVisible(true).setScale(0.85 * this.recoilStrength).setAlpha(1);
    this.model.setTint(0xffebcf);
    // Lever action ejects while cycling; single-shot and break-action cases stay
    // in their chambers until the player starts a reload.
    if (!this.longGun || this.weaponId === "dust-trail") this.ejectCase();
  }
  reload(spent: number) {
    if (!this.longGun || this.weaponId === "dust-trail") return;
    for (let i = 0; i < Math.min(spent, 2); i++) this.ejectCase();
  }
  private ejectCase() {
    const p = this.view
      .getWorldTransformMatrix()
      .transformPoint(this.cylinderLocal.x, this.cylinderLocal.y);
    const casing = this.scene.add.image(0, 0, "weapon-brass")
      .setDisplaySize(this.shotgun ? 21 : this.longGun ? 22 : 17, this.shotgun ? 8 : 6);
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
      .setScale((0.6 + (0.25 * this.flashRemaining) / 95) * this.recoilStrength)
      .setAlpha(this.flashRemaining / 95);
    this.model.setTint(this.flashRemaining > 55 ? 0xffebcf : 0xffffff);
    this.smokeAge += delta;
    const targetX =
      610 + (this.aimX - 480) * (this.longGun ? 0.055 : 0.075) + Math.sin(this.age * 1.7) * 0.8;
    const targetY =
      530 +
      (this.aimY - 270) * 0.018 +
      Math.sin(this.age * 1.4) * 1.1 +
      this.coverAmount * 180 +
      (reloading ? 95 : 0);
    const smooth = delta === 0 ? 1 : 1 - Math.exp(-dt * 14);
    this.view.x = Phaser.Math.Linear(this.view.x, targetX, smooth);
    this.view.y = Phaser.Math.Linear(this.view.y, targetY, smooth);
    this.view.rotation =
      (this.aimX - 480) * 0.00016 -
      this.recoil * 0.13 * this.recoilStrength +
      Math.sin(this.age * 1.4) * 0.002 +
      (reloading ? 0.28 : 0);
    this.view.setScale(0.9 + this.recoil * 0.03 * this.recoilStrength);
    this.crosshair
      .setPosition(this.aimX, this.aimY)
      .setAlpha(this.coverAmount > 0.1 ? 0.15 : reloading ? 0.3 : 1);
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
