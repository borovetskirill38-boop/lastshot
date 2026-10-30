import "./investigation.css";
import { Investigation, investigationKey, investigationRules, readInvestigation, chooseCase,
  locations, suspects, methods, caches, evidenceSpots } from "./investigation.js";

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const iconPaths: Record<string, string> = {
  lock: '<rect x="17" y="28" width="30" height="25" rx="3"/><path d="M23 28V18a9 9 0 0 1 18 0v10M32 37v8"/>',
  fiber: '<path d="M10 16c25-17 21 50 44 28M10 31c20-22 22 38 44 10M12 46c16-23 26 16 40-20M18 10l-5 44M34 9l-5 47M50 10l-5 44"/>',
  boot: '<path d="M24 9h20l-3 25 12 10v9H13v-9l10-8zM24 18h18M15 45h36M18 53v4h10v-4"/>',
  paper: '<path d="M16 8h25l9 10v38H16zM40 9v11h10M23 28h19M23 35h19M23 42h13"/>',
  note: '<path d="M10 17h44v33H10zM11 18l21 18 21-18M11 49l15-15M53 49L38 34"/>',
  search: '<circle cx="27" cy="26" r="17"/><path d="M40 39l15 16M18 27l6 6 13-15"/>',
};
function icon(kind: string) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${iconPaths[kind] ?? iconPaths.search}</svg>`;
}
function option(value: string, label: string) {
  const item = document.createElement("option"); item.value = value; item.textContent = label; return item;
}

/** A self-contained, untimed investigation. No combat scene inputs or ammunition. */
export class InvestigationView {
  private record;
  private mission?: Investigation;
  private saved = true;
  private detail = el<HTMLDialogElement>("case-detail-dialog");
  private notebook = el<HTMLDialogElement>("case-notebook-dialog");
  private inspected = "";
  private person = "";
  private returnFocus = "";
  private paid?: number;

  constructor(private storage: Storage, private actions: { exit: () => void; reward: (errors: number) => number; sound: () => void; persisted: () => boolean }) {
    this.record = readInvestigation(storage);
    this.mission = this.record.active ?? undefined;
    el("case-back").onclick = () => this.actions.exit();
    el("case-outcome-back").onclick = () => this.actions.exit();
    el("case-new").onclick = () => { this.newCase(); this.open(); };
    el("case-notebook-open").onclick = () => this.openNotebook();
    el("case-notebook-close").onclick = () => this.notebook.close();
    el("case-detail-close").onclick = () => this.closeDetail();
    el("case-collect").onclick = () => {
      if (!this.mission?.collect(this.inspected)) return;
      this.actions.sound(); this.save(); this.render(); this.closeDetail();
    };
    el("case-present").onclick = () => this.present();
    el("case-report").onsubmit = event => { event.preventDefault(); this.accuse(); };
    this.detail.addEventListener("cancel", event => { event.preventDefault(); this.closeDetail(); });
    // Native Escape closes the active dialog; the next Escape returns to town.
    for (const dialog of [this.detail, this.notebook]) dialog.addEventListener("keydown", event => event.stopPropagation());
    el("investigation").addEventListener("keydown", event => {
      if (event.key === "Escape" && !event.repeat && !this.detail.open && !this.notebook.open) {
        event.preventDefault(); this.actions.exit();
      }
    });
    for (const location of locations) {
      const button = document.createElement("button"); button.type = "button"; button.dataset.location = location.id;
      button.textContent = location.name;
      button.onclick = () => { if (this.mission?.visit(location.id)) { this.actions.sound(); this.save(); this.render(); } };
      el("case-locations").append(button);
    }
    for (const [id, values] of [["case-accused", suspects], ["case-method", methods], ["case-cache", caches]] as const) {
      const select = el<HTMLSelectElement>(id); select.append(option("", "Выбери вывод…"));
      for (const value of values) select.append(option(value.id, value.name));
    }
    this.updateEntry();
  }
  get active() { return !el("investigation").hidden; }
  open() {
    if (!this.mission) this.newCase();
    el("investigation").hidden = false; this.render();
    el("case-title").focus({ preventScroll: true });
  }
  close() {
    this.detail.close(); this.notebook.close(); el("investigation").hidden = true;
  }
  private newCase() {
    this.mission = new Investigation(chooseCase(Math.random, this.mission?.file.id));
    this.paid = undefined; this.save();
  }
  private save() {
    try {
      this.storage.setItem(investigationKey, JSON.stringify({ version: 1, solved: this.record.solved,
        flawless: this.record.flawless, active: this.mission?.serialize() ?? null }));
      this.saved = true;
    } catch { this.saved = false; }
    this.updateEntry();
  }
  updateEntry() {
    const unfinished = this.mission?.phase === "active";
    el("investigation-best").textContent = `${unfinished ? "ПРОДОЛЖИТЬ ДЕЛО · " : ""}ПРЕМИЯ ДО +1 500 ОЧКОВ${this.record.solved ? ` · РАСКРЫТО: ${this.record.solved}` : ""}`;
  }
  private render() {
    const mission = this.mission!;
    el("case-title").textContent = `Дело № ${String(mission.file.number).padStart(2, "0")} · Пропавшая казна`;
    el("case-progress").textContent = `Улики ${mission.collected.length}/6 · Алиби ${mission.verified.length}/3 · Ошибки ${mission.errors}/3`;
    el("case-save-note").textContent = this.saved ? "Дело сохраняется автоматически. Можно вернуться в меню и продолжить позже."
      : "Сохранение недоступно: блокнот и результаты действуют до закрытия страницы.";
    const ended = mission.phase !== "active";
    el("case-fieldwork").hidden = ended; el("case-outcome").hidden = !ended;
    if (ended) { this.renderOutcome(); return; }
    const location = locations.find(l => l.id === mission.location)!;
    el("case-location-title").textContent = location.name; el("case-location-caption").textContent = location.caption;
    el("case-scene").dataset.location = location.id;
    el("case-scene").setAttribute("aria-label", `${location.name}: два предмета для осмотра`);
    for (const button of el("case-locations").querySelectorAll<HTMLButtonElement>("button"))
      button.setAttribute("aria-pressed", String(button.dataset.location === location.id));
    const spots = el("case-hotspots"); spots.replaceChildren();
    for (const spot of evidenceSpots.filter(s => s.location === location.id)) {
      const found = mission.collected.includes(spot.id), button = document.createElement("button");
      button.type = "button"; button.className = "case-hotspot"; button.dataset.evidence = spot.id;
      button.style.left = `${spot.x}%`; button.style.top = `${spot.y}%`;
      button.setAttribute("aria-label", `${spot.label}${found ? ", улика собрана" : ", осмотреть"}`);
      button.classList.toggle("is-collected", found);
      button.innerHTML = `<span class="case-marker" aria-hidden="true">${found ? "✓" : icon(spot.icon)}</span><span>${spot.label}</span>`;
      button.onclick = () => this.inspect(spot.id, `[data-evidence="${spot.id}"]`); spots.append(button);
    }
    const person = suspects.find(s => s.location === location.id)!, button = document.createElement("button");
    button.type = "button"; button.className = "case-witness"; button.dataset.person = person.id;
    button.innerHTML = `<span class="case-portrait" data-portrait="${person.portrait}" aria-hidden="true"></span><span>${person.name}<small>${mission.verified.includes(person.id) ? "Показания проверены" : "Поговорить"}</small></span>`;
    button.onclick = () => this.question(person.id); el("case-witness").replaceChildren(button);
    this.renderJournal();
  }
  private renderJournal() {
    const mission = this.mission!, list = el("case-evidence-list"); list.replaceChildren();
    evidenceSpots.forEach((spot, index) => {
      const found = mission.collected.includes(spot.id), row = document.createElement(found ? "button" : "p");
      row.className = `case-evidence-row${found ? " is-collected" : ""}`;
      row.innerHTML = `${icon(spot.icon)}<span>${found ? spot.name : `Улика ${index + 1} · ${locations.find(l => l.id === spot.location)!.name}`}</span><b aria-hidden="true">${found ? "✓" : "—"}</b>`;
      if (found) { (row as HTMLButtonElement).type = "button"; row.onclick = () => this.inspect(spot.id, "#case-notebook-open"); }
      list.append(row);
    });
    el("case-suspect-list").replaceChildren(...suspects.map(person => {
      const row = document.createElement("p"), verified = mission.verified.includes(person.id);
      row.className = "case-alibi-row";
      row.textContent = `${person.name} · ${verified ? person.id === mission.file.culprit ? "алиби опровергнуто" : "алиби подтверждено"
        : mission.questioned.includes(person.id) ? "нужна проверка" : "не опрошен"}`;
      return row;
    }));
  }
  private inspect(id: string, origin: string) {
    const spot = evidenceSpots.find(s => s.id === id); if (!spot || !this.mission) return;
    this.inspected = id; this.person = ""; this.returnFocus = origin;
    el("case-detail-icon").className = "case-evidence-icon"; el("case-detail-icon").innerHTML = icon(spot.icon);
    el("case-detail-kind").textContent = `ВЕЩЕСТВЕННАЯ УЛИКА · ${locations.find(l => l.id === spot.location)!.name}`;
    el("case-detail-title").textContent = spot.name; el("case-detail-text").textContent = this.mission.file.evidence[id];
    el("case-person-profile").replaceChildren(); el("case-question").hidden = true;
    el("case-detail-feedback").textContent = this.mission.collected.includes(id) ? "Улика уже в блокноте." : "Осмотр завершён. Забери улику, чтобы сопоставлять её с показаниями.";
    el("case-collect").hidden = this.mission.collected.includes(id) || this.mission.phase !== "active";
    this.detail.showModal();
    this.detail.scrollTop = 0;
    el(el("case-collect").hidden ? "case-detail-close" : "case-collect").focus({ preventScroll: true });
  }
  private question(id: string) {
    const mission = this.mission!, person = suspects.find(s => s.id === id)!;
    if (!mission.question(id)) return;
    this.person = id; this.inspected = ""; this.returnFocus = `[data-person="${id}"]`;
    this.save(); this.render();
    el("case-detail-icon").className = "case-portrait"; el("case-detail-icon").innerHTML = "";
    el("case-detail-icon").dataset.portrait = String(person.portrait);
    el("case-detail-kind").textContent = `ПОКАЗАНИЯ · ${person.role}`;
    el("case-detail-title").textContent = person.name;
    el("case-detail-text").textContent = `«${mission.file.testimonies[id]}»`;
    el("case-person-profile").replaceChildren(...[person.boots, person.fabric].map(text => {
      const p = document.createElement("p"); p.textContent = text; return p;
    }));
    el("case-collect").hidden = true;
    const select = el<HTMLSelectElement>("case-proof"); select.replaceChildren(option("", "Выбери собранную улику…"));
    for (const spot of evidenceSpots.filter(s => mission.collected.includes(s.id))) select.append(option(spot.id, spot.name));
    this.renderTestimony(); this.detail.showModal(); this.detail.scrollTop = 0; el("case-detail-close").focus({ preventScroll: true });
  }
  private renderTestimony() {
    const mission = this.mission!, verified = mission.verified.includes(this.person), guilty = mission.file.culprit === this.person;
    el("case-question").hidden = verified;
    el<HTMLButtonElement>("case-present").disabled = !mission.collected.length;
    el("case-detail-feedback").textContent = verified ? guilty
      ? "Картер: «Ваши следы и одежда связывают вас с кассой. Телеграфист не подтверждает ваше алиби». Алиби опровергнуто."
      : "Картер: «Независимый свидетель подтверждает, что во время кражи вы были в другом месте». Алиби подтверждено."
      : mission.collected.length ? "Проверь слова собеседника. Одежда и обувь тоже могут рассказать правду." : "Сначала осмотри предметы в городе и собери улики.";
  }
  private present() {
    if (!this.mission || !this.detail.open || !this.person) return;
    const proof = el<HTMLSelectElement>("case-proof").value;
    if (!proof) { el("case-detail-feedback").textContent = "Сначала выбери улику из блокнота."; return; }
    if (!this.mission.present(this.person, proof)) {
      el("case-detail-feedback").textContent = "Эта улика не проверяет его алиби. Сравни время, свидетельства, одежду и следы. За вопросы ошибок не начисляют."; return;
    }
    this.actions.sound(); this.save(); this.render(); this.renderTestimony();
  }
  private closeDetail() {
    this.detail.close(); if (this.active) el("investigation").querySelector<HTMLElement>(this.returnFocus)?.focus({ preventScroll: true });
  }
  private openNotebook() {
    const mission = this.mission!;
    const evidence = el("case-notebook-evidence"); evidence.replaceChildren();
    for (const spot of evidenceSpots.filter(s => mission.collected.includes(s.id))) {
      const article = document.createElement("article"), title = document.createElement("h3"), text = document.createElement("p");
      title.textContent = spot.name; text.textContent = mission.file.evidence[spot.id]; article.append(title, text); evidence.append(article);
    }
    if (!mission.collected.length) evidence.textContent = "Здесь появятся собранные улики.";
    el("case-notebook-testimony").replaceChildren(...suspects.map(person => {
      const p = document.createElement("p"); p.textContent = `${person.name}: ${mission.questioned.includes(person.id) ? mission.file.testimonies[person.id] : "Ещё не опрошен."}${mission.verified.includes(person.id) ? person.id === mission.file.culprit ? " Алиби опровергнуто." : " Алиби подтверждено." : ""}`; return p;
    }));
    el("case-report").hidden = mission.phase !== "active";
    el("case-report-help").textContent = mission.ready
      ? `Все материалы собраны. Осталось попыток: ${investigationRules.maxErrors - mission.errors}. Премия: ${investigationRules.reward - mission.errors * investigationRules.errorPenalty} очков. Ошибочное обвинение уменьшает её на 300.`
      : `Сначала собери все улики и проверь три алиби. Сейчас: улики ${mission.collected.length}/6, проверено ${mission.verified.length}/3.`;
    el<HTMLButtonElement>("case-accuse").disabled = !mission.ready;
    el("case-report-feedback").textContent = "";
    (el("case-report") as HTMLFormElement).reset();
    this.notebook.showModal(); this.notebook.scrollTop = 0; el("case-notebook-title").focus({ preventScroll: true });
  }
  private accuse() {
    const mission = this.mission; if (!mission || !this.notebook.open) return;
    const result = mission.accuse(el<HTMLSelectElement>("case-accused").value,
      el<HTMLSelectElement>("case-method").value, el<HTMLSelectElement>("case-cache").value);
    if (result === "incomplete" || result === "invalid" || result === "inactive") return;
    if (result === "won") {
      this.record.solved = Math.min(Number.MAX_SAFE_INTEGER, this.record.solved + 1);
      if (!mission.errors) this.record.flawless = Math.min(Number.MAX_SAFE_INTEGER, this.record.flawless + 1);
      // Persist the closed case before paying; restoring it never awards points again.
      this.save(); this.paid = this.actions.reward(mission.errors);
    } else this.save();
    this.render(); this.actions.sound();
    if (result === "wrong") {
      el("case-report-help").textContent = `Осталось попыток: ${investigationRules.maxErrors - mission.errors}. Премия при верном обвинении: ${investigationRules.reward - mission.errors * investigationRules.errorPenalty} очков.`;
      el("case-report-feedback").textContent = "Судья отклонил обвинение: хотя бы один вывод не подтверждается уликами. Перечитай блокнот и проверь все три пункта.";
    } else { this.notebook.close(); el("case-outcome-title").focus({ preventScroll: true }); }
  }
  private renderOutcome() {
    const mission = this.mission!, won = mission.phase === "won";
    el("case-outcome-title").textContent = won ? "Дело раскрыто. Казна возвращена!" : "Обвинение рассыпалось";
    el("case-outcome-text").textContent = `${won ? "Картер собрал доказательства, и судья выдал ордер. " : "Три необоснованных обвинения стоили доверия судьи. Премии нет. Истина по материалам дела: "}${mission.file.explanation}`;
    el("case-outcome-reward").textContent = won
      ? `Премия за дело: ${mission.reward.toLocaleString("ru-RU")} очков${this.paid !== undefined ? ` · В арсенал зачислено: +${this.paid.toLocaleString("ru-RU")}` : " · Выплата за это дело уже учтена"}. Раскрыто дел: ${this.record.solved}. Без ошибок: ${this.record.flawless}.${this.actions.persisted() ? "" : " Очки действуют до закрытия страницы: сохранение недоступно."}`
      : "Попробуй другое дело. Улики и проверка алиби помогут избежать догадок.";
  }
}
