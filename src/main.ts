import Phaser from "phaser";
import "./style.css";
import { GameAudio } from "./audio";
import { Armory } from "./armory";
import { getWeapon } from "./arsenal.js";
import { observeGameLayout } from "./layout";
import { IntroDialogue } from "./dialogue";
import { OpeningStory } from "./prologue";
import { getIntroDialogue } from "./dialogues.js";
import { BossEncounter, bossTiming } from "./boss.js";
import { hitsWood } from "./surfaces.js";
import { occludedByCover } from "./occlusion.js";
import { preloadArt, drawTown, drawStreet, drawTavern, createPerson, createBoss, ViewWeapon } from "./art";
import { maps, readMap, hitsTarget } from "./maps.js";
import { levels, readProgress, recordWin } from "./rules.js";
import { CoverMovement, playerCovers, planAttack, tickAttack, combatTiming } from "./combat.js";
import { CombatView, animateGunman } from "./combat-view";
import { prepareGunmanFrames } from "./gunman-frames";
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let storage: Storage;
try {
  storage = window.localStorage;
} catch {
  storage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("Storage unavailable");
    },
  } as unknown as Storage;
}
let progress = readProgress(storage),
  selected = 0;
let townReady = false;
let selectedMap = readMap(storage);
let mapSaved = true;
export const gameAudio = new GameAudio();
const armory = new Armory(storage);
const introDialogue = new IntroDialogue();
const openingStory = new OpeningStory(() => menu());
type Target = {
  x: number;
  y: number;
  slot: number;
  civilian: boolean;
  view: Phaser.GameObjects.Container;
  expires: number;
  scale?: number;
  coverY?: number;
  bodyY?: number;
  pixelsPerMeter?: number;
  appearedAt?: number;
  attack?: ReturnType<typeof planAttack>;
};
class Town extends Phaser.Scene {
  weapon!: ViewWeapon;
  world!: Phaser.GameObjects.Container;
  combatView!: CombatView;
  movement = new CoverMovement();
  hurtUntil = 0;
  bossAimLane = 1;
  bossRecoilUntil = 0;
  clock = 0;
  targets: Target[] = [];
  weaponId = armory.equipped.id;
  capacity = armory.equipped.capacity;
  ammo = this.capacity;
  lives = 3;
  score = 0;
  kills = 0;
  reloading = false;
  paused = false;
  intro = false;
  ended = true;
  nextSpawn = 0;
  reloadEnd = 0;
  encounter = new BossEncounter(maps[0].slots);
  get bossHP() { return this.encounter.hp; }
  get bossOpen() { return this.encounter.phase === "exposed"; }
  get bossPosition() { return this.encounter.position; }
  bossView?: Phaser.GameObjects.Container;
  map = maps[0];
  slots = this.map.slots;
  scenery: Phaser.GameObjects.Image[] = [];
  constructor() {
    super("town");
  }
  preload() {
    preloadArt(this);
  }
  create() {
    prepareGunmanFrames(this);
    this.world = this.add.container(0, 0);
    this.drawTown();
    this.combatView = new CombatView(this);
    this.weapon = new ViewWeapon(this);
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.ended && !this.paused && !this.intro) this.weapon.aim(p.x, p.y);
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const point = this.world.getWorldTransformMatrix().applyInverse(p.x, p.y);
      this.shoot(point.x, point.y);
    });
    this.input.keyboard?.on("keydown-R", () => this.reload());
    this.input.keyboard?.on("keydown-ESC", () => this.togglePause());
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.repeat || this.intro || this.ended || this.paused) return;
      if (["KeyA", "ArrowLeft", "KeyD", "ArrowRight", "KeyS", "ArrowDown", "KeyW", "ArrowUp"].includes(event.code)) event.preventDefault();
      if (["KeyA", "ArrowLeft"].includes(event.code)) this.move(-1);
      if (["KeyD", "ArrowRight"].includes(event.code)) this.move(1);
      if (["KeyS", "ArrowDown"].includes(event.code)) this.stance(true);
      if (["KeyW", "ArrowUp"].includes(event.code)) this.stance(false);
    });
    this.game.events.on("blur", () => {
      if (!this.ended && !this.paused) this.togglePause();
    });
    townReady = true;
    menu();
  }
  drawTown() {
    for (const layer of this.scenery) layer.destroy();
    this.scenery = this.map.id === "saloon"
      ? drawTown(this, this.slots)
      : this.map.id === "street"
        ? drawStreet(this, this.slots)
        : drawTavern(this);
    this.world.add(this.scenery).sort("depth");
  }
  person(x: number, y: number, civilian: boolean, boss = false) {
    const position = this.slots.find((slot) => slot.x === x && slot.y === y);
    const view = createPerson(this, x, position?.bodyY ?? y, civilian, boss, position?.scale ?? 1, this.map.tint);
    if (position) view.setDepth(position.pixelsPerMeter);
    this.world.add(view).sort("depth");
    return view;
  }
  begin() {
    this.intro = true;
    gameAudio.setMenu(false);
    gameAudio.stop();
    gameAudio.setPaused(false);
    for (const t of this.targets) t.view.destroy();
    this.targets = [];
    this.bossView?.destroy();
    this.bossView = undefined;
    if (this.map.id !== selectedMap.id) {
      this.map = selectedMap;
      this.slots = this.map.slots;
      this.drawTown();
    }
    this.weaponId = armory.equipped.id;
    this.capacity = armory.equipped.capacity;
    this.ammo = this.capacity;
    this.weapon.setWeapon(this.weaponId);
    this.movement = new CoverMovement();
    this.hurtUntil = 0; this.bossRecoilUntil = 0;
    this.world.setPosition(0, 0).setScale(1);
    this.combatView.reset(this.map.id);
    this.combatView.update(this.movement, this.clock);
    el("equipped-name").textContent = `В руках: ${armory.equipped.name}`;
    this.lives = 3;
    this.score = 0;
    this.kills = 0;
    this.encounter = new BossEncounter(this.slots, this.clock);
    this.reloading = false;
    this.paused = false;
    this.ended = false;
    this.nextSpawn = this.clock + 700;
    this.weapon.reset();
    this.updateCombatUI();
    el("pause").textContent = "Пауза";
    el("reload").textContent = "Перезарядить · R";
    el<HTMLButtonElement>("pause").disabled = true;
    el<HTMLButtonElement>("reload").disabled = true;
    this.hud();
    el("boss-notice").hidden = selected !== 4;
    if (selected === 4) this.renderBoss();
  }
  startFight() {
    if (!this.intro || this.ended) return;
    this.intro = false;
    this.nextSpawn = this.clock + 700;
    this.encounter.nextAt = this.clock + bossTiming.first;
    el<HTMLButtonElement>("pause").disabled = false;
    el<HTMLButtonElement>("reload").disabled = false;
    this.game.canvas.tabIndex = 0;
    this.game.canvas.focus({ preventScroll: true });
    this.updateCombatUI();
  }
  hud() {
    const progressText =
      selected === 0
        ? `Попадания ${this.kills}`
        : `${this.kills}/${levels[selected].goal}`;
    el("stats").textContent =
      `♥ ${this.lives} / 3   ·   Патроны ${this.ammo}/${this.capacity}   ·   ${progressText}   ·   ${this.score} очков`;
    el("ammo-rounds").replaceChildren(
      ...Array.from({ length: this.capacity }, (_, i) => {
        const round = document.createElement("i");
        round.className = i < this.ammo ? "round loaded" : "round empty";
        return round;
      }),
    );
    el("life-count").textContent = `${this.lives}/3`;
    el("life-hearts").replaceChildren(
      ...Array.from({ length: 3 }, (_, i) => {
        const heart = document.createElement("i");
        heart.textContent = "♥";
        heart.className = i < this.lives ? "heart alive" : "heart lost";
        return heart;
      }),
    );
  }
  renderBoss() {
    this.bossView?.destroy();
    this.bossView = undefined;
    const phase = this.encounter.phase;
    const notice = el("boss-notice");
    notice.dataset.phase = phase;
    const action = phase === "hostage" ? "Сьюзи в плену — НЕ СТРЕЛЯЙТЕ!"
      : phase === "exposed" ? "Он открыт — стреляйте!" : "Меняет укрытие…";
    notice.textContent = phase === "defeated" ? "Сьюзи спасена!" : `Билли Пуля ${this.bossHP}/6 · ${action}`;
    if (phase === "hidden") return;
    const p = this.bossPosition;
    this.bossView = createBoss(this, p.x, p.bodyY, p.scale, this.map.tint,
      phase === "hostage" ? "shield" : phase === "defeated" ? "hostage" : "boss");
    this.bossView.setDepth(p.pixelsPerMeter);
    this.world.add(this.bossView).sort("depth");
    if (phase === "exposed") this.bossAimLane = this.movement.lane;
  }
  move(direction: number) {
    if (this.ended || this.intro || this.paused) return;
    this.movement.move(direction, this.clock); this.updateCombatUI();
  }
  stance(crouching: boolean) {
    if (this.ended || this.intro || this.paused) return;
    this.movement.stance(crouching, this.clock); this.updateCombatUI();
  }
  updateCombatUI() {
    const p = this.movement;
    const cover = playerCovers[this.map.id as keyof typeof playerCovers][p.lane];
    const text = `${p.lane + 1}/3 · ${cover.name}`;
    if (el("cover-status").textContent !== text) el("cover-status").textContent = text;
    el("play").dataset.cover = p.protected ? "safe" : "open";
    const locked = this.ended || this.intro || this.paused;
    el<HTMLButtonElement>("move-left").disabled = locked || p.lane === 0 || p.moving;
    el<HTMLButtonElement>("move-right").disabled = locked || p.lane === 2 || p.moving;
    el<HTMLButtonElement>("crouch").disabled = locked || p.crouching;
    el<HTMLButtonElement>("peek").disabled = locked || !p.crouching;
    el("crouch").setAttribute("aria-pressed", String(p.crouching));
  }
  receiveFire(x: number, y: number, lane: number) {
    if (this.ended || this.intro) return;
    const pan = (x - 480) / 480;
    gameAudio.play("enemyShot", pan);
    const outcome = this.movement.receive(lane);
    const hurt = outcome === "hit" && this.clock >= this.hurtUntil;
    const point = this.world.getWorldTransformMatrix().transformPoint(x, y);
    const endX = Math.max(-100, Math.min(1060, 480 + (lane - this.movement.position) * 650));
    this.combatView.impact(point.x, point.y, this.clock, hurt, endX,
      outcome === "cover" ? 470 - this.movement.duck * 190 : 500, outcome !== "hit");
    if (hurt) {
      this.hurtUntil = this.clock + combatTiming.immunity;
      this.lives--; gameAudio.play("playerHurt"); this.hud();
      if (this.lives <= 0) this.finish(false);
    } else if (outcome !== "hit") gameAudio.play("wood", (endX - 480) / 480);
  }
  reload() {
    if (this.intro || this.ended || this.paused || this.reloading || this.ammo === this.capacity) return;
    this.reloading = true;
    this.reloadEnd = this.clock + getWeapon(this.weaponId).reloadMs;
    this.weapon.reload(this.capacity - this.ammo);
    gameAudio.play("reload");
    el("reload").textContent = "Перезарядка…";
  }
  togglePause() {
    if (this.intro || this.ended) return;
    this.paused = !this.paused;
    gameAudio.setPaused(this.paused);
    el("pause").textContent = this.paused ? "Продолжить" : "Пауза";
    this.updateCombatUI();
  }
  shoot(x: number, y: number) {
    if (this.intro || this.ended || this.paused || this.reloading || this.ammo === 0 || !this.movement.canShoot) return;
    this.ammo--;
    const screenPoint = this.world.getWorldTransformMatrix().transformPoint(x, y);
    this.weapon.aim(screenPoint.x, screenPoint.y);
    this.weapon.fire();
    gameAudio.play("shot");
    let hitPerson = false;
    let outcome: "enemy" | "civilian" | "miss" = "miss";
    const pan = (x - 480) / 480;
    const flash = this.add.circle(x, y, 13, 0xffe9a9, 0.8);
    this.world.add(flash);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 170,
      onComplete: () => flash.destroy(),
    });
    if (selected === 4) {
      const hit = this.encounter.fire(x, y, this.clock, this.map.occluders);
      if (hit === "hostage") {
        hitPerson = true;
        outcome = "civilian";
        this.lives--;
        gameAudio.play("civilianDeath", pan);
        el("boss-notice").textContent = `Сьюзи перед ним! −1 жизнь · Билли Пуля ${this.bossHP}/6`;
        if (this.lives <= 0) this.finish(false);
      } else if (hit === "hit" || hit === "defeated") {
        hitPerson = true;
        outcome = "enemy";
        gameAudio.play(hit === "defeated" ? "bossDeath" : "pain", pan);
        this.kills++;
        this.score += 100;
        this.renderBoss();
        if (hit === "defeated") this.finish(true);
      }
    } else {
      const t = [...this.targets].sort((a, b) => (b.pixelsPerMeter ?? 0) - (a.pixelsPerMeter ?? 0))
        .find((target) => hitsTarget(x, y, { ...target, bodyY: target.appearedAt !== undefined ? target.view.y : target.bodyY })
          && !occludedByCover(x, y, target.pixelsPerMeter, this.map.occluders));
      if (t) {
        hitPerson = true;
        outcome = t.civilian ? "civilian" : "enemy";
        gameAudio.play(t.civilian ? "civilianDeath" : "banditDeath", pan);
        t.view.destroy();
        this.targets = this.targets.filter((v) => v !== t);
        if (t.civilian) this.lives--;
        else {
          this.kills++;
          this.score += 100;
        }
        if (this.lives <= 0) this.finish(false);
        else if (selected !== 0 && this.kills >= levels[selected].goal)
          this.finish(true);
      } else if (selected === 0) {
        this.lives--;
        if (this.lives <= 0) this.finish(false);
      }
    }
    armory.record(this.weaponId, outcome);
    if (!hitPerson && hitsWood(x, y, this.slots, this.map.id)) gameAudio.play("wood", pan);
    this.hud();
  }
  finish(win: boolean) {
    if (this.intro || this.ended) return;
    this.ended = true;
    this.updateCombatUI();
    gameAudio.stop("reload");
    let saved = true;
    const endlessRun = selected === 0;
    if (win || endlessRun) {
      progress = recordWin(progress, selected, this.score);
      try {
        storage.setItem("lastshot-progress", JSON.stringify(progress));
      } catch {
        saved = false;
      }
    }
    el("result-title").textContent = endlessRun
      ? "Конец игры"
      : win
        ? selected === 4
          ? "Город свободен!"
          : "Отличный выстрел, шериф Картер!"
        : "Город ждёт твоего возвращения";
    el("result-text").textContent = endlessRun
      ? `${this.score} очков · ${this.kills} бандитов. Три ошибки — и смена окончена. ${saved ? "Рекорд сохранён." : "Сохранение недоступно: рекорд действует до закрытия страницы."}`
      : `${this.score} очков · ${this.kills} попаданий. ${win ? (saved ? "Прогресс сохранён." : "Сохранение недоступно: прогресс действует до закрытия страницы.") : "Попробуй снова: следи за патронами и береги жителей."}${win && selected === 4 ? " Сьюзи спасена — вы снова вместе." : ""}`;
    el("retry").textContent = endlessRun ? "Начать заново" : "Ещё раз";
    el("choose").textContent = endlessRun ? "Главное меню" : "Выбор уровня";
    el("next").hidden = endlessRun || !win || selected === 4;
    el("result").hidden = false;
  }
  update(_time: number, delta: number) {
    if (this.intro || this.paused) return;
    if (this.ended) {
      this.weapon?.update(delta, false);
      return;
    }
    const time = (this.clock += delta);
    this.movement.tick(time);
    const pan = (this.movement.position - 1) * 30;
    const zoom = 1 + Math.abs(pan) / 480 + this.movement.duck * 0.12;
    this.world.setScale(zoom).setPosition(480 * (1 - zoom) - pan, 270 * (1 - zoom) - this.movement.duck * 24);
    this.weapon.coverAmount = this.movement.duck;
    this.weapon.update(delta, this.reloading);
    this.combatView.update(this.movement, time);
    this.updateCombatUI();
    if (this.reloading && time >= this.reloadEnd) {
      this.reloading = false;
      gameAudio.stop("reload");
      this.ammo = this.capacity;
      el("reload").textContent = "Перезарядить · R";
      this.hud();
    }
    if (selected === 4) {
      const attackPosition = this.encounter.position;
      const event = this.encounter.tick(time);
      if (event) {
        if (event === "attack") {
          this.receiveFire(attackPosition.x - 5 * attackPosition.scale,
            attackPosition.bodyY - 20 * attackPosition.scale, this.bossAimLane);
          this.bossRecoilUntil = time + combatTiming.recoil;
        } else this.renderBoss();
      }
      const aiming = this.encounter.phase === "exposed";
      if (this.bossView && (aiming || time < this.bossRecoilUntil)) {
        const progress = aiming ? 1 - (this.encounter.nextAt - time) / bossTiming.exposed : 1;
        animateGunman(this.bossView, progress, time, aiming ? undefined : this.bossRecoilUntil - combatTiming.recoil);
      } else if (this.encounter.phase === "hidden" && this.bossView) this.renderBoss();
      return;
    }
    for (const t of [...this.targets]) {
      if (t.appearedAt !== undefined) {
        const emergence = Math.min(1, (time - t.appearedAt) / 180);
        t.view.y = (t.bodyY ?? t.y) + 24 * (t.scale ?? 1) * (1 - emergence);
        t.view.alpha = 0.4 + emergence * 0.6;
      }
      if (t.attack) {
        const event = tickAttack(t.attack, time, this.movement.lane);
        if (event === "aim") t.expires = Math.max(t.expires, t.attack.fireAt + combatTiming.recoil);
        if (event === "fire") this.receiveFire(t.view.x - 5 * (t.scale ?? 1),
          t.view.y - 20 * (t.scale ?? 1), t.attack.lane);
        if (this.ended) return;
        if (t.attack.started) animateGunman(t.view, (time - t.attack.start) / combatTiming.warning, time,
          t.attack.fired ? t.attack.fireAt : undefined);
      }
      if (time >= t.expires) {
        t.view.destroy();
        this.targets = this.targets.filter((v) => v !== t);
      }
    }
    if (time >= this.nextSpawn) {
      const free = this.slots
        .map((_, i) => i)
        .filter((i) => !this.targets.some((t) => t.slot === i));
      if (free.length) {
        const slot = Phaser.Utils.Array.GetRandom(free),
          s = this.slots[slot],
          civilian = Math.random() < levels[selected].civilians;
        const view = this.person(s.x, s.y, civilian);
        if (this.map.emerge) view.setY(s.bodyY + 24 * s.scale).setAlpha(0.4);
        this.targets.push({
          ...s,
          slot,
          civilian,
          view,
          expires: time + levels[selected].lifetime,
          appearedAt: this.map.emerge ? time : undefined,
          attack: !civilian && Math.random() < 0.55 && !this.targets.some(t => t.attack && !t.attack.fired)
            ? planAttack(time) : undefined,
        });
      }
      this.nextSpawn = time + levels[selected].interval;
    }
  }
}
const scene = new Town();
export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 540,
  backgroundColor: "#dab57b",
  pixelArt: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [scene],
  audio: { noAudio: true },
});
const gameLayout = observeGameLayout(el("game-viewport"), el("game"), (width, height) => {
  if (!townReady) return;
  scene.scale.setParentSize(width, height);
  scene.scale.refresh();
});
game.events.once("destroy", () => { gameLayout.destroy(); openingStory.destroy(); });

function updateMapPicker() {
  const picker = el("map-options");
  if (!picker.childElementCount) {
    for (const map of maps) {
      const button = document.createElement("button");
      button.className = "map-card";
      button.dataset.map = map.id;
      button.innerHTML = `<i class="map-preview" aria-hidden="true"></i><span><b>${map.name}</b><small>${map.time}</small></span><i class="map-check" aria-hidden="true">✓</i>`;
      button.onclick = () => {
        if (openingStory.active) return;
        selectedMap = map;
        try {
          storage.setItem("lastshot-map", map.id);
          mapSaved = true;
        } catch {
          mapSaved = false;
        }
        updateMapPicker();
        gameAudio.play("hover");
      };
      button.addEventListener("pointerenter", (event) => {
        if (event.pointerType !== "touch") gameAudio.play("hover");
      });
      picker.append(button);
    }
  }
  for (const button of picker.querySelectorAll<HTMLButtonElement>("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.map === selectedMap.id));
  }
  document.body.dataset.map = selectedMap.id;
  el("map-description").textContent = `${selectedMap.description} ${mapSaved ? "Карта доступна во всех пяти режимах." : "Выбор действует до закрытия страницы."}`;
}

function menu() {
  introDialogue.close();
  gameAudio.stop();
  gameAudio.setMenu(!openingStory.active);
  gameAudio.setPaused(false);
  scene.ended = true;
  scene.intro = false;
  el("play").hidden = true;
  el("result").hidden = true;
  el("menu").hidden = false;
  el("arsenal").hidden = true;
  el<HTMLButtonElement>("arsenal-open").disabled = !townReady;
  document.body.classList.remove("in-arsenal", "in-play", "boss-mode");
  document.body.classList.toggle("in-menu", !openingStory.active);
  window.scrollTo(0, 0);
  document.querySelector(".saloon-transition")?.remove();
  updateMapPicker();
  el("levels").replaceChildren();
  levels.forEach((l, i) => {
    const b = document.createElement("button");
    b.className = "level";
    b.disabled = !townReady || i >= progress.unlocked;
    b.classList.toggle("locked", i >= progress.unlocked);
    const status =
      i >= progress.unlocked
      ? "ЗАКРЫТО"
      : progress.best[i]
        ? `РЕКОРД: ${progress.best[i]}`
        : i === 0
          ? "БЕСКОНЕЧНЫЙ РЕЖИМ"
          : i === 4
            ? "БОСС · 6 HP"
            : `${l.goal} БАНДИТОВ`;
    b.innerHTML = `
      <b>${i === 4 ? "★" : String(i + 1).padStart(2, "0")}</b>
      <i class="saloon-doors" aria-hidden="true">
        <i class="door-leaf door-left"></i><i class="door-leaf door-right"></i>
        <i class="door-lock"></i>
      </i>
      <span>${l.name}</span><small>${status}</small>`;
    b.addEventListener("pointerenter", (event) => {
      if (!b.disabled && event.pointerType !== "touch") gameAudio.play("hover");
    });
    b.onclick = () => start(i);
    el("levels").append(b);
  });
}
function start(i: number) {
  if (!townReady || openingStory.active) return;
  document.body.classList.remove("in-menu", "in-arsenal");
  document.body.classList.add("in-play");
  document.body.classList.toggle("boss-mode", i === 4);
  el("arsenal").hidden = true;
  // The doors reveal the selected map while the conversation holds gameplay.
  document.querySelector(".saloon-transition")?.remove();
  const entrance = document.createElement("div");
  entrance.className = "saloon-transition";
  entrance.setAttribute("aria-hidden", "true");
  entrance.innerHTML =
    '<i class="entrance-leaf entrance-left"></i><i class="entrance-leaf entrance-right"></i>';
  entrance.addEventListener("animationend", (event) => {
    if (event.target === entrance) entrance.remove();
  });
  document.body.append(entrance);
  selected = i;
  el("menu").hidden = true;
  el("result").hidden = true;
  el("play").hidden = false;
  el("level-name").textContent = `${i + 1}. ${levels[i].name} · ${selectedMap.name}`;
  scene.begin();
  gameLayout.fit();
  window.scrollTo(0, 0);
  gameAudio.play("door");
  introDialogue.open(
    `${selectedMap.name} · ${levels[i].name}`,
    getIntroDialogue(i, selectedMap.id),
    () => scene.startFight(),
    () => {
      menu();
      el("levels").querySelectorAll<HTMLButtonElement>(".level")[i]?.focus({ preventScroll: true });
    },
  );
}
el("arsenal-open").onclick = () => {
  if (!townReady || openingStory.active) return;
  scene.ended = true;
  el("menu").hidden = true;
  el("play").hidden = true;
  el("arsenal").hidden = false;
  document.body.classList.remove("in-menu", "in-play");
  document.body.classList.add("in-arsenal");
  gameAudio.setRoom("arsenal");
  armory.open();
  window.scrollTo(0, 0);
  el("arsenal-title").focus({ preventScroll: true });
  gameAudio.play("door");
};
el<HTMLButtonElement>("arsenal-open").addEventListener("pointerenter", event => {
  if (event.pointerType === "touch" || el<HTMLButtonElement>("arsenal-open").disabled ||
    openingStory.active || el("menu").hidden) return;
  gameAudio.stop("reload");
  gameAudio.play("reload");
});
el("arsenal-back").onclick = () => {
  menu();
  el("arsenal-open").focus({ preventScroll: true });
};
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !el("arsenal").hidden) {
    event.preventDefault();
    el("arsenal-back").click();
  }
});
el("reload").onclick = () => scene.reload();
el("pause").onclick = () => scene.togglePause();
el("move-left").onclick = () => scene.move(-1);
el("move-right").onclick = () => scene.move(1);
el("crouch").onclick = () => scene.stance(true);
el("peek").onclick = () => scene.stance(false);
el("back").onclick = menu;
el("choose").onclick = menu;
el("retry").onclick = () => start(selected);
el("next").onclick = () => start(selected + 1);
el("sound").onclick = () => {
  const loading = gameAudio.setEnabled(!gameAudio.enabled);
  el("sound").textContent = gameAudio.enabled
    ? "Звук: загрузка…"
    : "Звук: выкл.";
  void loading.then(() => {
    el("sound").textContent = gameAudio.failed
      ? "Звук недоступен"
      : `Звук: ${gameAudio.enabled ? "вкл." : "выкл."}`;
    el("sound").setAttribute("aria-pressed", String(gameAudio.enabled));
  });
};
document.addEventListener("visibilitychange", () => {
  document.body.classList.toggle("page-hidden", document.hidden);
  gameAudio.setHidden(document.hidden);
  if (document.hidden && !scene.ended && !scene.paused) scene.togglePause();
});
menu();
