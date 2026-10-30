import Phaser from "phaser";
import { CombatView } from "./combat-view";
import { TelegraphMission, signalPath, formatRelayTime } from "./telegraph.js";

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const names = ["Левый коммутатор", "Центральный коммутатор", "Правый коммутатор"];
const directions = [[1, "север"], [2, "восток"], [4, "юг"], [8, "запад"]] as const;

/** One small, front-mounted prop per cover. All art shares one inline texture. */
export class TelegraphView {
  readonly layer: Phaser.GameObjects.Container;
  private boxes: { image: Phaser.GameObjects.Image; lamp: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }[] = [];
  constructor(private scene: Phaser.Scene, world: Phaser.GameObjects.Container, private cover: CombatView) {
    this.layer = scene.add.container(0, 0).setDepth(9510).setName("telegraph-equipment");
    world.add(this.layer).sort("depth");
  }
  reset(active: boolean) {
    this.layer.removeAll(true); this.boxes = []; this.layer.setVisible(active);
    if (!active) return;
    for (let i = 0; i < 3; i++) {
      const image = this.scene.add.image(0, 0, "telegraph-box").setName(`relay-device-${i}`);
      const lamp = this.scene.add.circle(0, 0, 2, 0x513d20);
      const label = this.scene.add.text(0, 0, ["I", "II", "III"][i], {
        fontFamily: "Georgia", fontSize: "11px", color: "#f1d2a0", stroke: "#27190d", strokeThickness: 3,
      }).setOrigin(.5, 0);
      this.boxes.push({ image, lamp, label }); this.layer.add([image, lamp, label]);
    }
  }
  update(mission: TelegraphMission, lane: number) {
    this.boxes.forEach(({ image, lamp, label }, i) => {
      const p = this.cover.equipmentMount(i), height = p.width * image.frame.height / image.frame.width;
      image.setPosition(p.x, p.y).setDisplaySize(p.width, height);
      lamp.setPosition(p.x + p.width * .185, p.y - height * .295).setRadius(Math.max(1.5, p.width * .035))
        .setFillStyle(mission.done[i] ? 0x99d585 : lane === i ? 0xe8bc64 : 0x624c2a);
      label.setPosition(p.x, p.y + height * .43).setColor(mission.done[i] ? "#a7d59b" : "#f1d2a0");
    });
  }
  hit(x: number, y: number, lane: number) {
    const image = this.boxes[lane]?.image;
    return !!image && Math.abs(x - image.x) <= image.displayWidth / 2 && Math.abs(y - image.y) <= image.displayHeight / 2;
  }
}

/** Native modality isolates repair input while the pause-safe mission clock runs. */
export class RelayPanel {
  private dialog = el<HTMLDialogElement>("relay-dialog");
  private cells: HTMLButtonElement[] = [];
  private mission?: TelegraphMission;
  private station = 1;
  private paused = false;
  private lastTime = "";
  constructor(private actions: { turn: (station: number, cell: number) => void; connect: (station: number) => void;
    pause: () => void; abort: () => void; closed: () => void }) {
    for (let i = 0; i < 16; i++) {
      const button = document.createElement("button"); button.type = "button";
      button.className = "relay-contact"; button.dataset.cell = String(i);
      button.onclick = () => this.actions.turn(this.station, i);
      el("relay-board").append(button); this.cells.push(button);
    }
    el("relay-close").onclick = () => this.close(true);
    el("relay-connect").onclick = () => this.actions.connect(this.station);
    el("relay-pause").onclick = () => this.actions.pause();
    el("relay-abort").onclick = () => this.actions.abort();
    this.dialog.addEventListener("cancel", event => { event.preventDefault(); this.close(true); });
    this.dialog.addEventListener("keydown", event => {
      // Do not let game movement, reload or Escape also handle a dialog key.
      event.stopPropagation();
      if (event.key === "Escape" || event.code === "KeyE") { event.preventDefault(); if (!event.repeat) this.close(true); return; }
      if (!event.key.startsWith("Arrow")) return;
      const index = this.cells.indexOf(document.activeElement as HTMLButtonElement);
      if (index < 0) return;
      event.preventDefault();
      const row = Math.floor(index / 4), col = index % 4;
      const next = event.key === "ArrowLeft" ? row * 4 + (col + 3) % 4
        : event.key === "ArrowRight" ? row * 4 + (col + 1) % 4
          : event.key === "ArrowUp" ? ((row + 3) % 4) * 4 + col : ((row + 1) % 4) * 4 + col;
      this.cells[next].focus({ preventScroll: true });
    });
  }
  get active() { return this.dialog.open; }
  open(mission: TelegraphMission, station: number, now: number) {
    this.mission = mission; this.station = station; this.paused = false;
    el("relay-title").textContent = names[station];
    this.render(); this.updateClock(now);
    this.dialog.showModal(); this.cells[mission.boards[station].entry * 4].focus({ preventScroll: true });
  }
  close(restoreFocus = false) {
    if (!this.active) return;
    this.dialog.close(); this.mission = undefined;
    if (restoreFocus) this.actions.closed();
  }
  updateClock(now: number) {
    if (!this.mission) return;
    const text = formatRelayTime(this.mission.remaining(now));
    el("relay-clock").classList.toggle("is-urgent", this.mission.remaining(now) <= 20000);
    if (text !== this.lastTime) { el("relay-clock").textContent = text; this.lastTime = text; }
  }
  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    if (this.active) this.render();
  }
  render() {
    if (!this.mission) return;
    const board = this.mission.boards[this.station], path = signalPath(board);
    const powered = new Set(path.powered);
    this.cells.forEach((button, i) => {
      const mask = board.tiles[i];
      button.disabled = this.paused || this.mission!.done[this.station];
      button.classList.toggle("is-powered", powered.has(i));
      button.classList.toggle("relay-input", i === board.entry * 4);
      button.classList.toggle("relay-output", i === board.exit * 4 + 3);
      const description = directions.filter(([bit]) => mask & bit).map(([, name]) => name).join(", ");
      const terminal = i === board.entry * 4 ? "Вход. " : i === board.exit * 4 + 3 ? "Выход. " : "";
      button.setAttribute("aria-label", `${terminal}Ряд ${Math.floor(i / 4) + 1}, столбец ${i % 4 + 1}: ${description}`);
      button.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="contact-screw" cx="50" cy="50" r="13"/>${directions.filter(([bit]) => mask & bit).map(([bit]) => {
        const [x, y] = bit === 1 ? [50, 0] : bit === 2 ? [100, 50] : bit === 4 ? [50, 100] : [0, 50];
        return `<path class="contact-track" d="M50 50 L${x} ${y}"/>`;
      }).join("")}<circle class="contact-tip" cx="50" cy="50" r="5"/></svg>`;
    });
    el("relay-connection").textContent = this.paused ? "Пауза · время остановлено"
      : path.connected ? "Линия соединена. Можно подать сигнал." : "Соедини светящийся вход с выходом на правом краю.";
    el<HTMLButtonElement>("relay-connect").disabled = this.paused || !path.connected;
    el("relay-pause").textContent = this.paused ? "Продолжить" : "Пауза";
  }
}
