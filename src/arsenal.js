/** @typedef {{hits: number, misses: number, civilianHits: number}} WeaponStats */
/** @typedef {{version: 1, selected: string, stats: Record<string, WeaponStats>}} ArsenalState */
/** @typedef {"enemy" | "civilian" | "miss"} ShotOutcome */

export const arsenalKey = "lastshot-arsenal";
export const weapons = [
  {
    id: "last-word",
    name: "Последний довод",
    kind: "Классический револьвер",
    capacity: 6,
    icon: 0,
    description: "Потёртая сталь и тёплая ореховая рукоять. Верный спутник шерифа: шесть патронов в барабане и привычный хват для каждой дуэли.",
  },
  {
    id: "dust-companion",
    name: "Пыльный спутник",
    kind: "Карманный револьвер",
    capacity: 5,
    icon: 1,
    description: "Короткий ствол, компактная рама и тёмное воронение. Пять патронов для того, кто привык беречь каждый выстрел и держать неприятности на расстоянии вытянутой руки.",
  },
  {
    id: "long-watch",
    name: "Дальний дозор",
    kind: "Длинноствольный револьвер",
    capacity: 8,
    icon: 2,
    description: "Длинный ствол, латунная отделка и вместительный барабан. Восемь патронов позволяют дольше оставаться на посту между перезарядками.",
  },
];

export function getWeapon(id) {
  return weapons.find((weapon) => weapon.id === id) || weapons[0];
}

/** @returns {ArsenalState} */
export function emptyArsenal() {
  return {
    version: 1,
    selected: weapons[0].id,
    stats: Object.fromEntries(weapons.map(({ id }) => [id, { hits: 0, misses: 0, civilianHits: 0 }])),
  };
}

/** @returns {ArsenalState} */
export function readArsenal(storage) {
  const state = emptyArsenal();
  try {
    const saved = JSON.parse(storage.getItem(arsenalKey) || "null");
    if (!saved || saved.version !== 1) return state;
    if (weapons.some(({ id }) => id === saved.selected)) state.selected = saved.selected;
    const count = (n) => Number.isSafeInteger(n) && n >= 0 ? n : 0;
    for (const { id } of weapons) {
      const row = saved.stats?.[id];
      const hits = count(row?.hits);
      state.stats[id] = {
        hits,
        misses: count(row?.misses),
        civilianHits: Math.min(hits, count(row?.civilianHits)),
      };
    }
  } catch { /* Unavailable or corrupt storage must not prevent play. */ }
  return state;
}

/** @param {ArsenalState} state @returns {ArsenalState} */
export function selectWeapon(state, id) {
  return weapons.some((weapon) => weapon.id === id) ? { ...state, selected: id } : state;
}

/** Each accepted shot has exactly one outcome; civilian hits are a subset of hits.
 * @param {ArsenalState} state
 * @param {string} weaponId
 * @param {ShotOutcome} outcome
 * @returns {ArsenalState}
 */
export function recordShot(state, weaponId, outcome) {
  if (!weapons.some(({ id }) => id === weaponId) || !["enemy", "civilian", "miss"].includes(outcome)) return state;
  const before = state.stats[weaponId];
  const add = (value) => Math.min(Number.MAX_SAFE_INTEGER, value + 1);
  const after = { ...before };
  if (outcome === "miss") after.misses = add(after.misses);
  else {
    after.hits = add(after.hits);
    if (outcome === "civilian") after.civilianHits = add(after.civilianHits);
  }
  return { ...state, stats: { ...state.stats, [weaponId]: after } };
}

/** @param {ArsenalState} state */
export function saveArsenal(storage, state) {
  try {
    storage.setItem(arsenalKey, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
