export const levels = [
  {
    name: "Первый выстрел",
    goal: 8,
    interval: 1500,
    lifetime: 2600,
    civilians: 0,
  },
  {
    name: "Мирные жители",
    goal: 12,
    interval: 1400,
    lifetime: 2400,
    civilians: 0.25,
  },
  {
    name: "Быстрая рука",
    goal: 16,
    interval: 1150,
    lifetime: 2100,
    civilians: 0.22,
  },
  {
    name: "Шесть патронов",
    goal: 18,
    interval: 1000,
    lifetime: 1900,
    civilians: 0.25,
  },
  {
    name: "Шериф Картер против Билли Пули",
    goal: 6,
    interval: 1600,
    lifetime: 1600,
    civilians: 0,
  },
];
export function readProgress(storage) {
  try {
    const p = JSON.parse(storage.getItem("lastshot-progress") || "{}");
    return {
      unlocked: Number.isInteger(p.unlocked)
        ? Math.max(1, Math.min(5, p.unlocked))
        : 1,
      best: Array.from({ length: 5 }, (_, i) =>
        Number.isFinite(p.best?.[i]) ? Math.max(0, p.best[i]) : 0,
      ),
    };
  } catch {
    return { unlocked: 1, best: [0, 0, 0, 0, 0] };
  }
}
export function recordWin(progress, index, score) {
  return {
    unlocked: Math.min(5, Math.max(progress.unlocked, index + 2)),
    best: progress.best.map((n, i) => (i === index ? Math.max(n, score) : n)),
  };
}
