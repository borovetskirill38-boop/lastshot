import { getWeapon, weapons, readArsenal, selectWeapon, recordShot, saveArsenal } from "./arsenal.js";
import weaponIcons from "./visuals/weapon-icons.webp?inline";

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// Measured atlas rows keep the full grips visible without stretching the artwork.
const iconRows = [{ top: 0, height: 500 }, { top: 500, height: 380 }, { top: 880, height: 374 }];
let iconNumber = 0;
function weaponIcon(index: number) {
  const ns = "http://www.w3.org/2000/svg";
  const { top, height } = iconRows[index];
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 ${top} 1254 ${height}`);
  svg.setAttribute("aria-hidden", "true");
  const defs = document.createElementNS(ns, "defs");
  const clip = document.createElementNS(ns, "clipPath");
  clip.id = `weapon-icon-${++iconNumber}`;
  const rect = document.createElementNS(ns, "rect");
  rect.setAttribute("y", String(top));
  rect.setAttribute("width", "1254");
  rect.setAttribute("height", String(height));
  clip.append(rect);
  defs.append(clip);
  const image = document.createElementNS(ns, "image");
  image.setAttribute("href", weaponIcons);
  image.setAttribute("width", "1254");
  image.setAttribute("height", "1254");
  image.setAttribute("clip-path", `url(#${clip.id})`);
  svg.append(defs, image);
  return svg;
}

/** Persistent loadout and its workshop view. Shot counting never depends on the UI. */
export class Armory {
  private state;
  private inspected: string;
  private saved = true;
  private cards = new Map<string, HTMLButtonElement>();

  constructor(private storage: Storage) {
    this.state = readArsenal(storage);
    this.inspected = this.state.selected;
    for (const weapon of weapons) {
      const card = document.createElement("button");
      card.className = "weapon-card";
      card.type = "button";
      card.dataset.weaponId = weapon.id;
      card.setAttribute("aria-label", weapon.name);
      card.innerHTML = `<i class="weapon-icon" aria-hidden="true"></i><span>${weapon.name}</span><small></small>`;
      card.querySelector(".weapon-icon")!.append(weaponIcon(weapon.icon));
      card.onclick = () => {
        this.inspected = weapon.id;
        el("arsenal-feedback").textContent = "";
        this.render();
      };
      this.cards.set(weapon.id, card);
      el("weapon-list").append(card);
    }
    el("equip-weapon").onclick = () => {
      this.state = selectWeapon(this.state, this.inspected);
      this.saved = saveArsenal(this.storage, this.state);
      this.render();
      el("arsenal-feedback").textContent = `Выбрано: ${this.equipped.name}`;
    };
    this.render();
  }

  get equipped() {
    return getWeapon(this.state.selected);
  }

  open() {
    this.inspected = this.state.selected;
    el("arsenal-feedback").textContent = "";
    this.render();
  }

  record(weaponId: string, outcome: "enemy" | "civilian" | "miss") {
    this.state = recordShot(this.state, weaponId, outcome);
    this.saved = saveArsenal(this.storage, this.state);
  }

  private render() {
    const weapon = getWeapon(this.inspected);
    const stats = this.state.stats[weapon.id];
    for (const item of weapons) {
      const card = this.cards.get(item.id)!;
      card.classList.toggle("is-inspected", item.id === weapon.id);
      card.setAttribute("aria-pressed", String(item.id === weapon.id));
      card.querySelector("small")!.textContent = item.id === this.state.selected
        ? "В РУКАХ" : `${item.capacity} ПАТРОНОВ`;
    }
    el("weapon-name").textContent = weapon.name;
    el("weapon-kind").textContent = weapon.kind;
    el("weapon-description").textContent = weapon.description;
    el("weapon-preview").replaceChildren(weaponIcon(weapon.icon));
    el("weapon-hits").textContent = String(stats.hits);
    el("weapon-misses").textContent = String(stats.misses);
    el("weapon-civilians").textContent = String(stats.civilianHits);
    el("weapon-capacity").textContent = String(weapon.capacity);
    el("loadout-label").textContent = this.equipped.name;
    const equip = el<HTMLButtonElement>("equip-weapon");
    equip.disabled = weapon.id === this.state.selected;
    equip.textContent = equip.disabled ? "Оружие выбрано" : "Взять оружие";
    el("arsenal-save-note").textContent = this.saved
      ? "Статистика за всё время на этом устройстве. Попадания по мирным входят в общее число."
      : "Сохранение недоступно: выбор и статистика действуют до закрытия страницы.";
  }
}
