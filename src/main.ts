import Phaser from "phaser";
import "./style.css";
import { GameAudio } from "./audio";
import { Armory } from "./armory";
import { observeGameLayout } from "./layout";
import { hitsWood } from "./surfaces.js";
import { preloadArt, drawTown, drawStreet, createPerson, ViewWeapon } from "./art";
import { maps, readMap, hitsTarget } from "./maps.js";
import { levels, readProgress, recordWin } from "./rules.js";
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
type Target = {
  x: number;
  y: number;
  slot: number;
  civilian: boolean;
  view: Phaser.GameObjects.Container;
  expires: number;
  scale?: number;
  coverY?: number;
  appearedAt?: number;
};
class Town extends Phaser.Scene {
  weapon!: ViewWeapon;
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
  ended = true;
  nextSpawn = 0;
  reloadEnd = 0;
  bossHP = 6;
  bossOpen = false;
  bossHit = false;
  bossView?: Phaser.GameObjects.Container;
  bossBar?: Phaser.GameObjects.Text;
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
    this.drawTown();
    this.weapon = new ViewWeapon(this);
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.ended && !this.paused) this.weapon.aim(p.x, p.y);
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.shoot(p.x, p.y);
    });
    this.input.keyboard?.on("keydown-R", () => this.reload());
    this.input.keyboard?.on("keydown-ESC", () => this.togglePause());
    this.game.events.on("blur", () => {
      if (!this.ended && !this.paused) this.togglePause();
    });
    townReady = true;
    menu();
  }
  drawTown() {
    for (const layer of this.scenery) layer.destroy();
    this.scenery = this.map.id === "street"
      ? drawStreet(this, [...this.slots, this.map.boss])
      : drawTown(this, this.slots);
  }
  person(x: number, y: number, civilian: boolean, boss = false) {
    const position = boss ? this.map.boss : this.slots.find((slot) => slot.x === x && slot.y === y);
    return createPerson(this, x, y, civilian, boss, position?.scale ?? 1, this.map.id === "street");
  }
  begin() {
    gameAudio.setMenu(false);
    gameAudio.stop();
    gameAudio.setPaused(false);
    for (const t of this.targets) t.view.destroy();
    this.targets = [];
    this.bossView?.destroy();
    this.bossBar?.destroy();
    this.bossBar = undefined;
    this.bossOpen = false;
    this.bossHit = false;
    if (this.map.id !== selectedMap.id) {
      this.map = selectedMap;
      this.slots = this.map.slots;
      this.drawTown();
    }
    this.weaponId = armory.equipped.id;
    this.capacity = armory.equipped.capacity;
    this.ammo = this.capacity;
    this.weapon.setWeapon(this.weaponId);
    el("equipped-name").textContent = `В руках: ${armory.equipped.name}`;
    this.lives = 3;
    this.score = 0;
    this.kills = 0;
    this.bossHP = 6;
    this.reloading = false;
    this.paused = false;
    this.ended = false;
    this.nextSpawn = this.clock + 700;
    this.weapon.reset();
    el("pause").textContent = "Пауза";
    el("reload").textContent = "Перезарядить · R";
    this.hud();
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
  reload() {
    if (this.ended || this.paused || this.reloading || this.ammo === this.capacity) return;
    this.reloading = true;
    this.reloadEnd = this.clock + 1100;
    gameAudio.play("reload");
    el("reload").textContent = "Перезарядка…";
  }
  togglePause() {
    if (this.ended) return;
    this.paused = !this.paused;
    gameAudio.setPaused(this.paused);
    el("pause").textContent = this.paused ? "Продолжить" : "Пауза";
  }
  shoot(x: number, y: number) {
    if (this.ended || this.paused || this.reloading || this.ammo === 0) return;
    this.ammo--;
    this.weapon.aim(x, y);
    this.weapon.fire();
    gameAudio.play("shot");
    let hitPerson = false;
    let outcome: "enemy" | "civilian" | "miss" = "miss";
    const pan = (x - 480) / 480;
    const flash = this.add.circle(x, y, 13, 0xffe9a9, 0.8);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 170,
      onComplete: () => flash.destroy(),
    });
    if (selected === 4) {
      if (this.bossOpen && hitsTarget(x, y, this.map.boss)) {
        hitPerson = true;
        outcome = "enemy";
        gameAudio.play(this.bossHP === 1 ? "bossDeath" : "pain", pan);
        this.bossHP--;
        this.bossHit = true;
        this.kills++;
        this.score += 100;
        this.bossBar?.setText(`ГЛАВАРЬ  ${"♥".repeat(this.bossHP)}`);
        if (!this.bossHP) this.finish(true);
      }
    } else {
      const t = this.targets.find((target) => hitsTarget(x, y, target));
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
    if (this.ended) return;
    this.ended = true;
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
          : "Отличный выстрел, шериф!"
        : "Город ждёт твоего возвращения";
    el("result-text").textContent = endlessRun
      ? `${this.score} очков · ${this.kills} бандитов. Три ошибки — и смена окончена. ${saved ? "Рекорд сохранён." : "Сохранение недоступно: рекорд действует до закрытия страницы."}`
      : `${this.score} очков · ${this.kills} попаданий. ${win ? (saved ? "Прогресс сохранён." : "Сохранение недоступно: прогресс действует до закрытия страницы.") : "Попробуй снова: следи за патронами и береги жителей."}`;
    el("retry").textContent = endlessRun ? "Начать заново" : "Ещё раз";
    el("choose").textContent = endlessRun ? "Главное меню" : "Выбор уровня";
    el("next").hidden = endlessRun || !win || selected === 4;
    el("result").hidden = false;
  }
  update(_time: number, delta: number) {
    if (this.paused) return;
    if (this.ended) {
      this.weapon?.update(delta, false);
      return;
    }
    this.weapon.update(delta, this.reloading);
    const time = (this.clock += delta);
    if (this.reloading && time >= this.reloadEnd) {
      this.reloading = false;
      gameAudio.stop("reload");
      this.ammo = this.capacity;
      el("reload").textContent = "Перезарядить · R";
      this.hud();
    }
    if (selected === 4) {
      if (time >= this.nextSpawn) {
        this.bossOpen = !this.bossOpen;
        if (this.bossOpen) this.bossHit = false;
        this.bossView?.destroy();
        const boss = this.map.boss;
        this.bossView = this.person(boss.x, boss.y, false, true);
        this.bossView.setVisible(this.bossOpen);
        this.bossBar ??= this.add
          .text(boss.x, boss.y - 123, "ГЛАВАРЬ  ♥♥♥♥♥♥", {
            fontSize: "23px",
            color: "#ffdf99",
            backgroundColor: "#402d2b",
            padding: { x: 12, y: 8 },
          })
          .setOrigin(0.5).setDepth(20);
        if (!this.bossOpen && !this.bossHit) {
          this.lives--;
          this.hud();
          if (this.lives <= 0) this.finish(false);
        }
        this.nextSpawn = time + (this.bossOpen ? 2200 : 900);
      }
      return;
    }
    for (const t of [...this.targets]) {
      if (t.appearedAt !== undefined) {
        const emergence = Math.min(1, (time - t.appearedAt) / 180);
        t.view.y = t.y + 24 * (1 - emergence);
        t.view.alpha = 0.4 + emergence * 0.6;
      }
      if (time >= t.expires) {
        t.view.destroy();
        this.targets = this.targets.filter((v) => v !== t);
        if (!t.civilian) {
          this.lives--;
          this.hud();
          if (this.lives <= 0) {
            this.finish(false);
            return;
          }
        }
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
        if (this.map.id === "street") view.setY(s.y + 24).setAlpha(0.4);
        this.targets.push({
          ...s,
          slot,
          civilian,
          view,
          expires: time + levels[selected].lifetime,
          appearedAt: this.map.id === "street" ? time : undefined,
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
game.events.once("destroy", () => gameLayout.destroy());

function updateMapPicker() {
  const picker = el("map-options");
  if (!picker.childElementCount) {
    for (const map of maps) {
      const button = document.createElement("button");
      button.className = "map-card";
      button.dataset.map = map.id;
      button.innerHTML = `<i class="map-preview" aria-hidden="true"></i><span><b>${map.name}</b><small>${map.time}</small></span><i class="map-check" aria-hidden="true">✓</i>`;
      button.onclick = () => {
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
  gameAudio.stop();
  gameAudio.setPaused(false);
  gameAudio.setMenu(true);
  scene.ended = true;
  el("play").hidden = true;
  el("result").hidden = true;
  el("menu").hidden = false;
  el("arsenal").hidden = true;
  el<HTMLButtonElement>("arsenal-open").disabled = !townReady;
  document.body.classList.remove("in-arsenal", "in-play");
  document.body.classList.add("in-menu");
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
  if (!townReady) return;
  document.body.classList.remove("in-menu", "in-arsenal");
  document.body.classList.add("in-play");
  el("arsenal").hidden = true;
  // The overlay opens over the live scene without delaying input or sound.
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
}
el("arsenal-open").onclick = () => {
  if (!townReady) return;
  scene.ended = true;
  el("menu").hidden = true;
  el("play").hidden = true;
  el("arsenal").hidden = false;
  document.body.classList.remove("in-menu", "in-play");
  document.body.classList.add("in-arsenal");
  armory.open();
  window.scrollTo(0, 0);
  el("arsenal-title").focus({ preventScroll: true });
  gameAudio.play("door");
};
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
