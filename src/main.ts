import Phaser from "phaser";
import "./style.css";
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
  selected = 0,
  sound = false;
let audio: AudioContext | undefined;
function bang() {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(140, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(35, audio.currentTime + 0.09);
    g.gain.setValueAtTime(0.08, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.12);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.13);
  } catch {
    /* Audio is optional. */
  }
}
type Target = {
  x: number;
  y: number;
  slot: number;
  civilian: boolean;
  view: Phaser.GameObjects.Container;
  expires: number;
};
class Town extends Phaser.Scene {
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
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) =>
      this.shoot(p.x, p.y),
    );
    this.input.keyboard?.on("keydown-R", () => this.reload());
    this.input.keyboard?.on("keydown-ESC", () => this.togglePause());
    this.game.events.on("blur", () => {
      if (!this.ended && !this.paused) this.togglePause();
    });
  }
  drawTown() {
    const g = this.add.graphics();
    g.fillStyle(0xe0bc80);
    g.fillRect(0, 0, 960, 540);
    g.fillStyle(0xca9c64);
    g.fillRect(0, 420, 960, 120);
    g.fillStyle(0xb18a61);
    for (let i = 0; i < 9; i++)
      g.fillRect(i * 130 - 40, 125 + (i % 3) * 12, 100, 300);
    g.fillStyle(0x674433);
    g.fillRect(110, 132, 740, 330);
    g.fillStyle(0x9d6745);
    g.fillRect(125, 147, 710, 300);
    for (let y = 155; y < 447; y += 18) {
      g.lineStyle(2, 0x805036);
      g.lineBetween(125, y, 835, y);
    }
    g.fillStyle(0x452f2b);
    g.fillRect(95, 122, 770, 25);
    g.fillStyle(0xd9b070);
    g.fillRect(320, 69, 320, 66);
    this.add
      .text(480, 99, "S A L O O N", {
        fontFamily: "Georgia",
        fontSize: "34px",
        color: "#493329",
      })
      .setOrigin(0.5);
    for (const s of this.slots) {
      g.fillStyle(0xcca16b);
      g.fillRect(s.x - 61, s.y - 70, 122, 124);
      g.fillStyle(0x282529);
      g.fillRect(s.x - 49, s.y - 58, 98, 104);
      g.fillStyle(0x59392e);
      g.fillRect(s.x - 68, s.y + 44, 136, 12);
    }
    g.fillStyle(0x986641);
    g.fillRect(65, 470, 830, 12);
    for (let i = 0; i < 40; i++) {
      g.fillStyle(0xb08556);
      g.fillRect((i * 173) % 960, 495 + ((i * 13) % 43), 9, 3);
    }
    this.add.text(26, 24, "DUSTY TOWN · 1886", {
      fontFamily: "monospace",
      fontSize: "17px",
      color: "#6c4b35",
    });
  }
  person(x: number, y: number, civilian: boolean, boss = false) {
    const g = this.add.graphics();
    g.fillStyle(civilian ? 0x709071 : 0x6e4546);
    g.fillRect(-26, -2, 52, 45);
    g.fillStyle(0xd8a173);
    g.fillRect(-18, -39, 36, 35);
    g.fillStyle(boss ? 0x171c26 : 0x3c302e);
    g.fillRect(-25, -56, 50, 22);
    g.fillRect(-36, -36, 72, 9);
    g.fillStyle(0x201e23);
    g.fillRect(-11, -23, 6, 6);
    g.fillRect(7, -23, 6, 6);
    g.fillStyle(civilian ? 0xd5dba6 : 0xd35340);
    g.fillRect(-19, -5, 38, 12);
    if (!civilian) {
      g.fillStyle(0xbac2bb);
      g.fillRect(20, 13, 20, 9);
    } else {
      g.fillStyle(0xf7deb3);
      g.fillRect(20, 10, 14, 21);
    }
    return this.add.container(x, y, [g]);
  }
  begin() {
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
    el("pause").textContent = "Пауза";
    el("reload").textContent = "Перезарядить · R";
    this.hud();
  }
  hud() {
    el("stats").textContent =
      `♥ ${this.lives} / 3   ·   Патроны ${this.ammo}/6   ·   ${this.kills}/${levels[selected].goal}   ·   ${this.score} очков`;
  }
  reload() {
    if (this.ended || this.paused || this.reloading || this.ammo === 6) return;
    this.reloading = true;
    this.reloadEnd = this.clock + 1100;
    el("reload").textContent = "Перезарядка…";
  }
  togglePause() {
    if (this.ended) return;
    this.paused = !this.paused;
    el("pause").textContent = this.paused ? "Продолжить" : "Пауза";
  }
  shoot(x: number, y: number) {
    if (this.ended || this.paused || this.reloading || this.ammo === 0) return;
    this.ammo--;
    bang();
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
        t.view.destroy();
        this.targets = this.targets.filter((v) => v !== t);
        if (t.civilian) this.lives--;
        else {
          this.kills++;
          this.score += 100;
        }
        if (this.lives <= 0) this.finish(false);
        else if (this.kills >= levels[selected].goal) this.finish(true);
      }
    }
    this.hud();
  }
  finish(win: boolean) {
    if (this.ended) return;
    this.ended = true;
    let saved = true;
    if (win) {
      progress = recordWin(progress, selected, this.score);
      try {
        storage.setItem("lastshot-progress", JSON.stringify(progress));
      } catch {
        saved = false;
      }
    }
    el("result-title").textContent = win
      ? selected === 4
        ? "Город свободен!"
        : "Отличный выстрел, шериф!"
      : "Город ждёт твоего возвращения";
    el("result-text").textContent =
      `${this.score} очков · ${this.kills} попаданий. ${win ? (saved ? "Прогресс сохранён." : "Сохранение недоступно: прогресс действует до закрытия страницы.") : "Попробуй снова: следи за патронами и береги жителей."}`;
    el("next").hidden = !win || selected === 4;
    el("result").hidden = false;
  }
  update(_time: number, delta: number) {
    if (this.ended || this.paused) return;
    const time = (this.clock += delta);
    if (this.reloading && time >= this.reloadEnd) {
      this.reloading = false;
      this.ammo = 6;
      el("reload").textContent = "Перезарядить · R";
      this.hud();
    }
    if (selected === 4) {
      if (time >= this.nextSpawn) {
        this.bossOpen = !this.bossOpen;
        if(this.bossOpen) this.bossHit = false;
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
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [scene],
  audio: { noAudio: true },
});
function menu() {
  scene.ended = true;
  el("play").hidden = true;
  el("result").hidden = true;
  el("menu").hidden = false;
  el("levels").replaceChildren();
  levels.forEach((l, i) => {
    const b = document.createElement("button");
    b.className = "level";
    b.disabled = i >= progress.unlocked;
    b.innerHTML = `<b>${i === 4 ? "★" : String(i + 1).padStart(2, "0")}</b><span>${l.name}</span><small>${i >= progress.unlocked ? "ЗАКРЫТО" : progress.best[i] ? `РЕКОРД: ${progress.best[i]}` : i === 4 ? "БОСС · 6 HP" : `${l.goal} БАНДИТОВ`}</small>`;
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
  sound = !sound;
  el("sound").textContent = `Звук: ${sound ? "вкл." : "выкл."}`;
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !scene.ended && !scene.paused) scene.togglePause();
});
menu();
