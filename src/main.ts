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
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const sight = el("crosshair");
      sight.style.left = `${(p.x / 960) * 100}%`;
      sight.style.top = `${(p.y / 540) * 100}%`;
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
    const g = this.add.graphics();
    // Desert sky with atmospheric bands and a low, dusty horizon.
    g.fillGradientStyle(0x8ea9ae, 0x8ea9ae, 0xe9c98f, 0xe9c98f, 1);
    g.fillRect(0, 0, 960, 430);
    g.fillStyle(0xf0cf91, 0.55);
    g.fillCircle(808, 104, 48);
    g.fillStyle(0xa88362, 0.55);
    g.fillTriangle(0, 302, 170, 178, 330, 302);
    g.fillTriangle(650, 302, 830, 195, 960, 302);
    g.fillStyle(0xb99970, 0.7);
    g.fillTriangle(70, 317, 270, 225, 455, 317);
    g.fillStyle(0xc89962);
    g.fillRect(0, 405, 960, 135);

    // Saloon: shadow, weathered timber facade, roof and sign supports.
    g.fillStyle(0x3a2922, 0.28);
    g.fillRect(103, 146, 766, 326);
    g.fillStyle(0x5b3928);
    g.fillRect(110, 132, 740, 330);
    g.fillStyle(0x945d38);
    g.fillRect(125, 147, 710, 300);
    for (let y = 153, i = 0; y < 447; y += 18, i++) {
      g.fillStyle(i % 2 ? 0x9d6742 : 0x925a37);
      g.fillRect(125, y, 710, 17);
      g.lineStyle(1, 0x663b28, 0.8);
      g.lineBetween(125, y + 17, 835, y + 17);
      for (let x = 145 + ((i * 47) % 73); x < 820; x += 190) {
        g.lineStyle(1, 0xbf8458, 0.48);
        g.lineBetween(x, y + 5, x + 62, y + 5);
      }
    }
    g.fillStyle(0x38231d);
    g.fillRect(94, 120, 772, 18);
    g.fillStyle(0x67432e);
    g.fillRect(105, 138, 750, 10);
    g.fillStyle(0x5a3827);
    g.fillRect(300, 62, 12, 69);
    g.fillRect(648, 62, 12, 69);
    g.fillStyle(0xc5904f);
    g.fillRoundedRect(315, 67, 330, 65, 4);
    g.lineStyle(3, 0x674226);
    g.strokeRoundedRect(315, 67, 330, 65, 4);
    this.add
      .text(480, 99, "S A L O O N", {
        fontFamily: "Georgia",
        fontSize: "32px",
        fontStyle: "bold",
        color: "#3d261c",
        stroke: "#ddb979",
        strokeThickness: 1,
      })
      .setOrigin(0.5);
    for (const s of this.slots) {
      g.fillStyle(0x3b251d, 0.35);
      g.fillRect(s.x - 65, s.y - 67, 130, 126);
      g.fillStyle(0x5f3b27);
      g.fillRect(s.x - 61, s.y - 70, 122, 124);
      g.fillStyle(0x1b1b1d);
      g.fillRect(s.x - 49, s.y - 58, 98, 104);
      g.fillGradientStyle(0x252226, 0x252226, 0x0b0b0d, 0x0b0b0d, 1);
      g.fillRect(s.x - 45, s.y - 54, 90, 100);
      g.lineStyle(3, 0xb9804e);
      g.strokeRect(s.x - 54, s.y - 63, 108, 114);
      g.fillStyle(0x4a2c20);
      g.fillRect(s.x - 68, s.y + 44, 136, 12);
      g.fillStyle(0xbb8654);
      g.fillRect(s.x - 68, s.y + 44, 136, 3);
    }
    g.fillStyle(0x69432e);
    g.fillRect(65, 468, 830, 14);
    g.fillStyle(0xb77a47);
    g.fillRect(65, 468, 830, 3);
    for (let i = 0; i < 40; i++) {
      g.fillStyle(i % 3 ? 0x9e744c : 0xd1a66c, 0.7);
      g.fillEllipse((i * 173) % 960, 489 + ((i * 13) % 48), 10, 3);
    }
    this.add.text(26, 24, "DUSTY TOWN · 1886", {
      fontFamily: "monospace",
      fontSize: "17px",
      color: "#4d3a30",
    });
  }
  person(x: number, y: number, civilian: boolean, boss = false) {
    const g = this.add.graphics();
    const coat = civilian ? 0x687c69 : boss ? 0x252b35 : 0x684442;
    const coatLight = civilian ? 0x82947a : boss ? 0x3d4652 : 0x865752;
    const skin = civilian ? 0xd4a074 : boss ? 0xb77d58 : 0xc98d64;
    const hat = boss ? 0x171a20 : civilian ? 0x695442 : 0x382b27;

    // Cast shadow, legs, boots and a shaped torso.
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(0, 45, boss ? 80 : 64, 12);
    g.fillStyle(0x302823);
    g.fillRect(-21, 30, 17, 18);
    g.fillRect(5, 30, 17, 18);
    g.fillStyle(0x171719);
    g.fillRoundedRect(-25, 42, 22, 7, 2);
    g.fillRoundedRect(4, 42, 24, 7, 2);
    g.fillStyle(coat);
    g.fillTriangle(-30, 38, -23, -4, 0, -9);
    g.fillTriangle(30, 38, 23, -4, 0, -9);
    g.fillStyle(coatLight);
    g.fillTriangle(-23, -4, 0, -10, 0, 37);
    g.fillStyle(0x3a2822);
    g.fillRect(-29, 25, 58, 6);
    g.fillStyle(0xb18445);
    g.fillRect(-2, 25, 5, 6);

    // Neck, ears and a less geometric face with nose, brows and stubble.
    g.fillStyle(skin);
    g.fillRect(-8, -9, 16, 9);
    g.fillEllipse(-19, -24, 7, 11);
    g.fillEllipse(19, -24, 7, 11);
    g.fillEllipse(0, -25, 37, 36);
    g.fillStyle(0x9d6449, 0.35);
    g.fillEllipse(2, -19, 7, 9);
    g.lineStyle(2, 0x4a3028, 0.8);
    g.lineBetween(-12, -31, -5, -32);
    g.lineBetween(6, -32, 13, -30);
    g.fillStyle(0x221d1b);
    g.fillCircle(-8, -27, 2);
    g.fillCircle(9, -27, 2);
    g.lineStyle(2, boss ? 0x38251f : 0x734936, 0.8);
    g.lineBetween(-7, -15, 8, -15);
    if (!civilian) {
      g.fillStyle(0x3b2823, 0.7);
      g.fillTriangle(-14, -15, 14, -15, 0, -5);
    }

    // Crown and curved brim of the hat.
    g.fillStyle(hat);
    g.fillRoundedRect(-22, -54, 44, 23, 7);
    g.fillStyle(boss ? 0x5b3030 : 0x8c6541);
    g.fillRect(-22, -38, 44, 5);
    g.fillStyle(hat);
    g.fillEllipse(0, -34, boss ? 78 : 68, 11);
    g.fillStyle(0xffffff, 0.08);
    g.fillRoundedRect(-17, -51, 28, 3, 2);

    // Neckerchief is still the clear gameplay cue, but now follows the body.
    g.fillStyle(civilian ? 0xc8c58e : 0xb83f36);
    g.fillTriangle(-17, -7, 17, -7, 0, 10);
    g.fillStyle(civilian ? 0xa8aa77 : 0x7d2827);
    g.fillCircle(0, -5, 4);
    if (!civilian) {
      // Revolver and holster remain decorative; shot mechanics are untouched.
      g.fillStyle(skin);
      g.fillEllipse(31, 13, 10, 8);
      g.fillStyle(0x37383a);
      g.fillRoundedRect(25, 8, 23, 8, 2);
      g.fillStyle(0x777b7b);
      g.fillRect(43, 10, 10, 4);
      g.fillStyle(0x4a2f22);
      g.fillTriangle(22, 18, 36, 18, 29, 34);
    } else {
      g.fillStyle(skin);
      g.fillEllipse(29, 17, 10, 13);
      g.fillStyle(0xddd0ac);
      g.fillRoundedRect(21, 8, 14, 24, 3);
      g.lineStyle(1, 0x756653);
      g.lineBetween(24, 14, 32, 14);
      g.lineBetween(24, 19, 32, 19);
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
    const progressText =
      selected === 0 ? `Попадания ${this.kills}` : `${this.kills}/${levels[selected].goal}`;
    el("stats").textContent =
      `♥ ${this.lives} / 3   ·   Патроны ${this.ammo}/6   ·   ${progressText}   ·   ${this.score} очков`;
    el("ammo-rounds").replaceChildren(
      ...Array.from({ length: 6 }, (_, i) => {
        const round = document.createElement("i");
        round.className = i < this.ammo ? "round loaded" : "round empty";
        return round;
      }),
    );
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
    const revolver = el("revolver-icon");
    revolver.classList.remove("firing");
    void revolver.offsetWidth;
    revolver.classList.add("firing");
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
        else if (selected !== 0 && this.kills >= levels[selected].goal)
          this.finish(true);
      } else if (selected === 0) {
        this.lives--;
        if (this.lives <= 0) this.finish(false);
      }
    }
    this.hud();
  }
  finish(win: boolean) {
    if (this.ended) return;
    this.ended = true;
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
  pixelArt: false,
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
  sound = !sound;
  el("sound").textContent = `Звук: ${sound ? "вкл." : "выкл."}`;
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !scene.ended && !scene.paused) scene.togglePause();
});
menu();
