import { getWeapon, weapons, readArsenal, selectWeapon, recordShot, saveArsenal, nextWeapon, purchaseWeapon, awardVictory, awardInvestigation, economy } from "./arsenal.js";
import weaponIcons from "./visuals/weapon-icons.webp?inline";
import longGunIcons from "./visuals/long-gun-icons.webp?inline";

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// Measured atlas rows keep the full grips visible without stretching the artwork.
const iconRows = [{ top: 0, height: 500 }, { top: 500, height: 380 }, { top: 880, height: 374 },
  { top: 0, height: 385 }, { top: 385, height: 310 }, { top: 695, height: 263 }, { top: 958, height: 296 }];
let iconNumber = 0;
const roundNames = { one: "ПАТРОН", few: "ПАТРОНА", many: "ПАТРОНОВ", other: "ПАТРОНОВ" };
const roundPlural = new Intl.PluralRules("ru-RU");
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
  image.setAttribute("href", index < 3 ? weaponIcons : longGunIcons);
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
      card.querySelector("small")!.id = `weapon-status-${weapon.id}`;
      card.setAttribute("aria-describedby", `weapon-status-${weapon.id}`);
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
      if (!this.state.owned.includes(this.inspected)) return;
      this.state = selectWeapon(this.state, this.inspected);
      this.saved = saveArsenal(this.storage, this.state);
      this.render();
      el("arsenal-feedback").textContent = `Выбрано: ${this.equipped.name}`;
    };
    el("buy-weapon").onclick = () => {
      const purchased = purchaseWeapon(this.state, this.inspected);
      if (purchased === this.state) return;
      this.state = purchased;
      this.saved = saveArsenal(this.storage, this.state);
      this.render();
      el("arsenal-feedback").textContent = `Куплено и выбрано: ${this.equipped.name}`;
    };
    this.render();
  }

  get equipped() {
    return getWeapon(this.state.selected);
  }

  get balance() { return this.state.balance; }
  get persisted() { return this.saved; }

  rewardInvestigation(errors: number) {
    const before = this.balance;
    this.state = awardInvestigation(this.state, errors);
    this.saved = saveArsenal(this.storage, this.state);
    this.renderFunds();
    return this.balance - before;
  }

  private renderFunds() {
    el("arsenal-balance").textContent = this.balance.toLocaleString("ru-RU");
    el("menu-wallet").textContent = this.balance.toLocaleString("ru-RU");
  }

  open() {
    this.inspected = this.state.selected;
    el("arsenal-feedback").textContent = "";
    this.render();
  }

  record(weaponId: string, outcome: "enemy" | "civilian" | "miss") {
    const before = this.balance;
    this.state = recordShot(this.state, weaponId, outcome);
    this.saved = saveArsenal(this.storage, this.state);
    this.renderFunds();
    return this.balance - before;
  }

  rewardVictory(level: number) {
    const before = this.balance;
    this.state = awardVictory(this.state, level);
    this.saved = saveArsenal(this.storage, this.state);
    this.renderFunds();
    return this.balance - before;
  }

  private render() {
    const weapon = getWeapon(this.inspected);
    const stats = this.state.stats[weapon.id];
    const next = nextWeapon(this.state);
    const owned = this.state.owned.includes(weapon.id);
    this.renderFunds();
    for (const item of weapons) {
      const card = this.cards.get(item.id)!;
      card.classList.toggle("is-inspected", item.id === weapon.id);
      card.setAttribute("aria-pressed", String(item.id === weapon.id));
      card.classList.toggle("is-locked", !this.state.owned.includes(item.id));
      card.querySelector("small")!.textContent = item.id === this.state.selected
        ? "В РУКАХ" : this.state.owned.includes(item.id)
          ? `КУПЛЕНО · ${item.capacity} ${roundNames[roundPlural.select(item.capacity) as keyof typeof roundNames]}`
          : `${item.id === next?.id ? "СЛЕДУЮЩАЯ ПОКУПКА" : "ЗАКРЫТО"} · ${item.price.toLocaleString("ru-RU")} ОЧКОВ`;
    }
    el("weapon-name").textContent = weapon.name;
    el("weapon-kind").textContent = weapon.kind;
    el("weapon-description").textContent = weapon.description;
    el("weapon-preview").replaceChildren(weaponIcon(weapon.icon));
    el("weapon-preview").setAttribute("aria-label", `${weapon.kind}: ${weapon.name}`);
    el("weapon-cartridge").textContent = weapon.cartridge;
    el("weapon-mechanism").textContent = weapon.mechanism;
    el("weapon-reload").textContent = `${(weapon.reloadMs / 1000).toLocaleString("ru-RU")} с`;
    el("weapon-recoil").textContent = `×${weapon.recoil.toLocaleString("ru-RU")} от базовой`;
    el("weapon-hits").textContent = String(stats.hits);
    el("weapon-misses").textContent = String(stats.misses);
    el("weapon-civilians").textContent = String(stats.civilianHits);
    el("weapon-capacity").textContent = String(weapon.capacity);
    el("loadout-label").textContent = this.equipped.name;
    const equip = el<HTMLButtonElement>("equip-weapon");
    equip.hidden = !owned;
    equip.disabled = weapon.id === this.state.selected;
    equip.textContent = equip.disabled ? "Оружие выбрано" : "Взять оружие";
    const buy = el<HTMLButtonElement>("buy-weapon");
    buy.hidden = owned;
    buy.disabled = weapon.id !== next?.id || this.balance < weapon.price;
    buy.textContent = `Купить и взять · ${weapon.price.toLocaleString("ru-RU")} очков`;
    el("weapon-purchase-note").textContent = owned
      ? weapon.price === 0 ? "Стартовое оружие шерифа · бесплатно" : "Куплено навсегда. Можно брать в любой бой."
      : weapon.id !== next?.id
        ? `Сначала купите «${weapons[weapons.indexOf(weapon) - 1].name}».`
        : this.balance < weapon.price
          ? `Нужно ещё ${(weapon.price - this.balance).toLocaleString("ru-RU")} очков.`
          : "Очков достаточно. Покупка сразу выдаст оружие.";
    el("arsenal-save-note").textContent = this.saved
      ? `Покупки, очки и статистика сохраняются на этом устройстве. Попадания по мирным входят в общее число, но не приносят ${economy.enemyBounty} очков.`
      : "Сохранение недоступно: покупки, очки, выбор и статистика действуют до закрытия страницы.";
  }
}
