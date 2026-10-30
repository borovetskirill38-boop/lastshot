import { economy } from "./arsenal.js";
export const investigationKey = "lastshot-investigation";
export const investigationRules = { reward: economy.investigationBonus, errorPenalty: economy.investigationPenalty, maxErrors: 3 };
export const locations = [
  { id: "saloon", name: "Крыльцо салуна", caption: "Здесь стояла касса с жалованьем городского патруля." },
  { id: "street", name: "Городская улица", caption: "Пыль хранит следы лучше, чем люди — свои обещания." },
  { id: "tavern", name: "Питейный зал", caption: "За каждым столом своя история. Не каждая — правда." },
];
export const suspects = [
  { id: "reed", name: "Элиас Рид", role: "Торговец", portrait: 0, location: "saloon",
    boots: "Широкие каблуки с тремя гвоздями треугольником", fabric: "Зелёный шерстяной жилет с медной нитью",
    trace: "Широкий каблук оставил три гвоздя треугольником.", fiber: "Зелёная шерсть, переплетённая с медной нитью.",
    alibi: "С 18:10 до 18:20 я был у телеграфиста. Отправлял заказ на муку — спросите его.",
    confirmation: "Телеграфист подтверждает: Рид диктовал заказ всё время с 18:10 до 18:20. На бланке — его подпись и время." },
  { id: "briggs", name: "Том Бриггс", role: "Конюх", portrait: 2, location: "street",
    boots: "Узкие каблуки и левая шпора с обломанным зубцом", fabric: "Оливковая хлопковая рубаха с белой штопкой",
    trace: "Узкий каблук. Слева — оттиск шпоры с одним обломанным зубцом.", fiber: "Оливковый хлопок и белая нить от штопки.",
    alibi: "С 18:10 до 18:20 я был у телеграфиста. Диктовал весть брату о лошади.",
    confirmation: "Телеграфист подтверждает: Бриггс диктовал сообщение брату всё время с 18:10 до 18:20. Подпись и время заверены." },
  { id: "bell", name: "Нед Белл", role: "Писарь", portrait: 3, location: "tavern",
    boots: "Гладкие узкие каблуки с ромбовидной латкой справа", fabric: "Тёмно-зелёный шёлковый галстук с синей кромкой",
    trace: "Гладкие узкие каблуки; на правом видна ромбовидная латка.", fiber: "Тёмно-зелёный шёлк с синей нитью по кромке.",
    alibi: "С 18:10 до 18:20 я был у телеграфиста. Передавал окружному судье ведомость.",
    confirmation: "Телеграфист подтверждает: Белл передавал ведомость всё время с 18:10 до 18:20. Подпись и время заверены." },
];
export const methods = [
  { id: "key", name: "Открыли дубликатом ключа", clue: "Дужка цела, следов взлома нет. В замочной скважине — свежая латунная стружка от грубо выпиленного дубликата.", conclusion: "Замок открыли грубым дубликатом ключа: целая дужка и латунная стружка исключают взлом." },
  { id: "pry", name: "Взломали рычагом", clue: "Дужка выгнута, на крышке две глубокие вмятины. Замочная скважина не тронута. Крышку подняли плоским железным рычагом.", conclusion: "Кассу вскрыли рычагом: выгнутая дужка и две вмятины сохранили следы взлома." },
];
export const caches = [
  { id: "steps", name: "Под ступенью крыльца", clue: "«Жалованье спрятал под третьей ступенью крыльца. Забери, когда погаснет фонарь. Билли — свою долю получишь»." },
  { id: "wagon", name: "В ящике под телегой", clue: "«Жалованье в плоском ящике под телегой на улице. Забери после заката. Билли — свою долю получишь»." },
  { id: "bar", name: "За нижней доской стойки", clue: "«Жалованье за нижней доской барной стойки. Забери, когда зал опустеет. Билли — свою долю получишь»." },
];
export const evidenceSpots = [
  { id: "lock", location: "saloon", name: "Замок кассы", label: "Касса у входа", x: 51, y: 66, icon: "lock" },
  { id: "fiber", location: "saloon", name: "Волокна на ручке", label: "Ручка кассы", x: 28, y: 76, icon: "fiber" },
  { id: "tracks", location: "street", name: "Следы у кассы", label: "Следы в пыли", x: 43, y: 75, icon: "boot" },
  { id: "dispatch", location: "street", name: "Заверенная телеграмма", label: "Почтовая сумка", x: 18, y: 51, icon: "paper" },
  { id: "receipt", location: "tavern", name: "Запись Сьюзи", label: "Стол у окна", x: 25, y: 57, icon: "paper" },
  { id: "note", location: "tavern", name: "Записка сообщнику", label: "За стойкой", x: 69, y: 47, icon: "note" },
];
// Six authored cases: evidence, testimony and the verdict always describe the same crime.
export const caseFiles = suspects.flatMap((suspect, person) => methods.map((method, technique) => {
  const innocent = suspects.filter(s => s !== suspect);
  const cache = caches[(person + technique) % caches.length];
  return {
    id: `case-${person * 2 + technique + 1}`, number: person * 2 + technique + 1,
    culprit: suspect.id, method: method.id, cache: cache.id,
    evidence: /** @type {Record<string, string>} */ ({
      lock: method.clue,
      fiber: `${suspect.fiber} Волокна зажаты под ручкой кассы; на остальной поверхности пыли нет таких нитей.`,
      tracks: `${suspect.trace} След начинается у кассы и идёт к улице. Это единственная свежая цепочка следов после полива крыльца в 18:10.`,
      dispatch: `${innocent[0].confirmation} Журнал посетителей закрыт: других посетителей в это время не было.`,
      receipt: `Сьюзи записала: «${innocent[1].name} сидел за столом у окна с 18:05 до 18:25. Я всё время была рядом и подавала ужин. Он не выходил».`,
      note: `${cache.clue} Бумага пахнет той же краской, что и печать на кассе. Речь о похищенном жалованье.`,
    }),
    testimonies: Object.fromEntries(suspects.map(s => [s.id, s === innocent[1]
      ? "С 18:05 до 18:25 я ужинал у окна. Сьюзи видела меня — никуда не отходил." : s.alibi])),
    proofs: { [suspect.id]: ["tracks", "fiber", "dispatch"], [innocent[0].id]: ["dispatch"], [innocent[1].id]: ["receipt"] },
    explanation: `${suspect.name} выдал себя: ${suspect.trace.toLowerCase()} На ручке остались волокна его одежды. Остальные двое имеют независимые алиби на всё время кражи. ${method.conclusion} Казна найдена: ${cache.name.toLowerCase()}. След ведёт к банде Билли Пули.`,
  };
}));

const known = (values, allowed) => Array.isArray(values) ? [...new Set(values.filter(value => allowed.includes(value)))] : [];
export function chooseCase(random = Math.random, previous) {
  const available = caseFiles.filter(file => file.id !== previous), roll = random();
  const index = Number.isFinite(roll) ? Math.floor(Math.max(0, Math.min(.999999, roll)) * available.length) : 0;
  return available[index].id;
}

export class Investigation {
  phase = "active";
  collected = [];
  questioned = [];
  verified = [];
  errors = 0;
  location = "saloon";
  constructor(id = chooseCase(), saved) {
    this.file = caseFiles.find(file => file.id === id) ?? caseFiles[0];
    if (!saved) return;
    this.collected = known(saved.collected, evidenceSpots.map(s => s.id));
    this.questioned = known(saved.questioned, suspects.map(s => s.id));
    this.verified = known(saved.verified, this.questioned).filter(id => this.file.proofs[id].some(proof => this.collected.includes(proof)));
    this.errors = Number.isInteger(saved.errors) ? Math.max(0, Math.min(investigationRules.maxErrors, saved.errors)) : 0;
    this.location = locations.some(l => l.id === saved.location) ? saved.location : "saloon";
    if (this.errors === investigationRules.maxErrors) this.phase = "lost";
    else if (saved.phase === "won" && this.ready) this.phase = "won";
  }
  get ready() { return this.collected.length === evidenceSpots.length && this.verified.length === suspects.length; }
  get reward() { return this.phase === "won" ? investigationRules.reward - investigationRules.errorPenalty * this.errors : 0; }
  visit(id) {
    if (this.phase !== "active" || !locations.some(l => l.id === id)) return false;
    this.location = id; return true;
  }
  collect(id) {
    if (this.phase !== "active" || this.collected.includes(id)
      || !evidenceSpots.some(s => s.id === id && s.location === this.location)) return false;
    this.collected.push(id); return true;
  }
  question(id) {
    if (this.phase !== "active" || !suspects.some(s => s.id === id && s.location === this.location)) return false;
    if (!this.questioned.includes(id)) this.questioned.push(id);
    return true;
  }
  present(id, proof) {
    if (this.phase !== "active" || !this.questioned.includes(id) || this.verified.includes(id)
      || !suspects.some(s => s.id === id && s.location === this.location)
      || !this.collected.includes(proof) || !this.file.proofs[id]?.includes(proof)) return false;
    this.verified.push(id); return true;
  }
  accuse(person, method, cache) {
    if (this.phase !== "active") return "inactive";
    if (!this.ready) return "incomplete";
    if (!suspects.some(s => s.id === person) || !methods.some(m => m.id === method) || !caches.some(c => c.id === cache)) return "invalid";
    if (person === this.file.culprit && method === this.file.method && cache === this.file.cache) {
      this.phase = "won"; return "won";
    }
    this.errors++;
    if (this.errors === investigationRules.maxErrors) { this.phase = "lost"; return "lost"; }
    return "wrong";
  }
  serialize() {
    return { id: this.file.id, phase: this.phase, location: this.location, collected: [...this.collected],
      questioned: [...this.questioned], verified: [...this.verified], errors: this.errors };
  }
}

export function readInvestigation(storage) {
  const empty = { solved: 0, flawless: 0, active: null };
  try {
    const saved = JSON.parse(storage.getItem(investigationKey) || "null");
    if (saved?.version !== 1) return empty;
    const solved = Number.isSafeInteger(saved.solved) && saved.solved >= 0 ? saved.solved : 0;
    const flawless = Number.isSafeInteger(saved.flawless) && saved.flawless >= 0 ? Math.min(solved, saved.flawless) : 0;
    const active = caseFiles.some(file => file.id === saved.active?.id) ? new Investigation(saved.active.id, saved.active) : null;
    return { solved, flawless, active };
  } catch { return empty; }
}
