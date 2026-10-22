import Phaser from "phaser";
import "./style.css";
import { GameAudio } from "./audio";
import { hitsWood } from "./surfaces.js";
import { drawTown, createPerson, ViewWeapon } from "./art";
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
export const gameAudio = new GameAudio();
type Target = {
  x: number;
  y: number;
  slot: number;
  civilian: boolean;
  view: Phaser.GameObjects.Container;
  expires: number;
};
class Town extends Phaser.Scene {
  weapon!: ViewWeapon;
  clock = 0;
  targets: Target[] = [];
  ammo = 6;
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
  slots = [
    { x: 230, y: 253 },
    { x: 480, y: 253 },
    { x: 730, y: 253 },
    { x: 230, y: 405 },
    { x: 480, y: 405 },
    { x: 730, y: 405 },
  ];
  constructor() {
    super("town");
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
  }
  drawTown() {
    drawTown(this, this.slots);
  }
  person(x: number, y: number, civilian: boolean, boss = false) {
    return createPerson(this, x, y, civilian, boss);
  }
  begin() {
    gameAudio.stop();
    gameAudio.setPaused(false);
    for (const t of this.targets) t.view.destroy();
    this.targets = [];
    this.bossView?.destroy();
    this.bossBar?.destroy();
    this.bossBar = undefined;
    this.bossOpen = false;
    this.bossHit = false;
    this.ammo = 6;
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
      `♥ ${this.lives} / 3   ·   Патроны ${this.ammo}/6   ·   ${progressText}   ·   ${this.score} очков`;
    el("ammo-rounds").replaceChildren(
      ...Array.from({ length: 6 }, (_, i) => {
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
    if (this.ended || this.paused || this.reloading || this.ammo === 6) return;
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
      if (this.bossOpen && Math.abs(x - 480) < 42 && y > 255 && y < 359) {
        hitPerson = true;
        gameAudio.play("body", pan);
        gameAudio.play("pain", pan);
        this.bossHP--;
        this.bossHit = true;
        this.kills++;
        this.score += 100;
        this.bossBar?.setText(`ГЛАВАРЬ  ${"♥".repeat(this.bossHP)}`);
        if (!this.bossHP) this.finish(true);
      }
    } else {
      const t = this.targets.find(
        (t) => Math.abs(t.x - x) <= 40 && y >= t.y - 56 && y <= t.y + 43,
      );
      if (t) {
        hitPerson = true;
        gameAudio.play("body", pan);
        if (!t.civilian) gameAudio.play("pain", pan);
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
    if (!hitPerson && hitsWood(x, y, this.slots)) gameAudio.play("wood", pan);
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
      this.ammo = 6;
      el("reload").textContent = "Перезарядить · R";
      this.hud();
    }
    if (selected === 4) {
      if (time >= this.nextSpawn) {
        this.bossOpen = !this.bossOpen;
        if (this.bossOpen) this.bossHit = false;
        this.bossView?.destroy();
        this.bossView = this.person(480, 315, false, true);
        this.bossView.setAlpha(this.bossOpen ? 1 : 0.3);
        this.bossBar ??= this.add
          .text(480, 192, "ГЛАВАРЬ  ♥♥♥♥♥♥", {
            fontSize: "23px",
            color: "#ffdf99",
            backgroundColor: "#402d2b",
            padding: { x: 12, y: 8 },
          })
          .setOrigin(0.5);
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
        this.targets.push({
          ...s,
          slot,
          civilian,
          view,
          expires: time + levels[selected].lifetime,
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
function menu() {
  gameAudio.stop();
  gameAudio.setPaused(false);
  scene.ended = true;
  el("play").hidden = true;
  el("result").hidden = true;
  el("menu").hidden = false;
  el("levels").replaceChildren();
  levels.forEach((l, i) => {
    const b = document.createElement("button");
    b.className = "level";
    b.disabled = i >= progress.unlocked;
    b.innerHTML = `<b>${i === 4 ? "★" : String(i + 1).padStart(2, "0")}</b><span>${l.name}</span><small>${i >= progress.unlocked ? "ЗАКРЫТО" : progress.best[i] ? `РЕКОРД: ${progress.best[i]}` : i === 0 ? "БЕСКОНЕЧНЫЙ РЕЖИМ" : i === 4 ? "БОСС · 6 HP" : `${l.goal} БАНДИТОВ`}</small>`;
    b.onclick = () => start(i);
    el("levels").append(b);
  });
}
function start(i: number) {
  selected = i;
  el("menu").hidden = true;
  el("result").hidden = true;
  el("play").hidden = false;
  el("level-name").textContent = `${i + 1}. ${levels[i].name}`;
  scene.scale.setParentSize(el("game").clientWidth, el("game").clientHeight);
  scene.scale.refresh();
  scene.begin();
}
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
  if (document.hidden && !scene.ended && !scene.paused) scene.togglePause();
});
menu();
