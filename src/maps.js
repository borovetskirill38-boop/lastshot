/** World coordinates are shared by artwork, cover, spawning and hit testing. */
export const maps = [
  {
    id: "saloon",
    name: "Салун",
    time: "Полдень",
    description: "Знакомый салун: шесть окон, выжженная солнцем древесина и пыльная площадь.",
    slots: [
      { x: 230, y: 253, scale: 1, coverY: 297 },
      { x: 480, y: 253, scale: 1, coverY: 297 },
      { x: 730, y: 253, scale: 1, coverY: 297 },
      { x: 230, y: 405, scale: 1, coverY: 449 },
      { x: 480, y: 405, scale: 1, coverY: 449 },
      { x: 730, y: 405, scale: 1, coverY: 449 },
    ],
    boss: { x: 480, y: 315, scale: 1, coverY: 359 },
  },
  {
    id: "street",
    name: "Улица городка",
    time: "Лёгкие сумерки",
    description: "Дома и освещённые веранды по обе стороны улицы. Бандиты прячутся за телегой, ящиками и бочками.",
    slots: [
      { x: 83, y: 242, scale: 1, coverY: 282 },
      { x: 241, y: 240, scale: 1, coverY: 278 },
      { x: 356, y: 242, scale: 0.8, coverY: 272 },
      { x: 528, y: 249, scale: 0.9, coverY: 282 },
      { x: 871, y: 242, scale: 1, coverY: 288 },
      { x: 728, y: 303, scale: 1.06, coverY: 337 },
    ],
    boss: { x: 528, y: 249, scale: 1.1, coverY: 282 },
  },
];

export function readMap(storage) {
  try {
    return maps.find((map) => map.id === storage.getItem("lastshot-map")) || maps[0];
  } catch {
    return maps[0];
  }
}

/** Covered body parts cannot be shot through the wagon, barrels or window sill. */
export function hitsTarget(x, y, target) {
  const scale = target.scale ?? 1;
  return Number.isFinite(x) && Number.isFinite(y)
    && Math.abs(x - target.x) <= 40 * scale
    && y >= target.y - 56 * scale
    && y <= Math.min(target.y + 43 * scale, (target.coverY ?? Infinity) - 1);
}

// Measured on street-dusk.webp, in the fixed 960×540 game world.
export const streetWood = [
  // Facades and porches follow the receding skyline rather than covering the sky.
  [[0, 0], [202, 0], [279, 67], [279, 81], [315, 70], [345, 125], [342, 141], [370, 147], [374, 207], [405, 212], [406, 232], [440, 250], [443, 280], [0, 337]],
  [[960, 0], [814, 0], [808, 88], [708, 98], [702, 161], [663, 178], [633, 218], [600, 241], [580, 272], [960, 352]],
  // Wagon body and wheels, central crates, near barrels, left crate and hitch rail.
  [[95, 278], [346, 278], [343, 348], [104, 359]],
  [[88, 352], [115, 351], [135, 377], [124, 409], [99, 418], [84, 389]],
  [[282, 318], [304, 307], [323, 322], [326, 389], [310, 423], [284, 412], [274, 374]],
  [[335, 302], [354, 296], [365, 319], [365, 369], [349, 392], [338, 373]],
  [[448, 303], [505, 303], [505, 282], [555, 282], [555, 316], [579, 316], [579, 353], [448, 353]],
  [[690, 343], [721, 335], [762, 338], [779, 356], [773, 457], [733, 468], [686, 458], [681, 382]],
  [[779, 356], [824, 346], [883, 355], [896, 392], [893, 476], [857, 490], [790, 481], [775, 453]],
  [[0, 345], [84, 340], [85, 410], [15, 423], [0, 413]],
  [[837, 296], [960, 297], [960, 476], [936, 479], [933, 323], [837, 313]],
];
