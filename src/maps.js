import { mapProps, propSlot } from "./props.js";
import { cameras, saloonGeometry } from "./cameras.js";
import { projectTarget } from "./projection.js";

// Upper edges measured on tavern.webp. The same lines mask sprites and stop shots.
const tavernBar = [[658, 231], [720, 235], [820, 243], [960, 260]];
const tavernRoundTable = [[156, 330], [164, 285], [186, 250], [218, 235], [244, 233], [276, 242], [301, 266], [322, 305], [332, 350]];
const tavernBarrels = [[99, 227], [119, 222], [137, 225], [149, 221], [177, 223], [189, 237]];
const tavernTippedTable = [[317, 243], [410, 244], [423, 251]];
const tavernCrates = [[444, 216], [466, 216], [466, 219], [502, 219]];

export const tavernCovers = [
  [...tavernBar, [960, 540], [913, 540], [757, 428], [672, 327]],
  [...tavernRoundTable, [328, 391], [311, 423], [284, 443], [247, 449], [210, 440], [178, 416], [157, 372]],
  [...tavernBarrels, [194, 291], [175, 303], [108, 304], [100, 289]],
  [...tavernTippedTable, [423, 302], [317, 309]],
  [...tavernCrates, [502, 264], [444, 264]],
];

/** World coordinates are shared by artwork, cover, spawning and hit testing. */
const mapDefinitions = [
  {
    id: "saloon",
    name: "Салун",
    time: "Полдень",
    tint: 0xffffff,
    emerge: false,
    description: "Салун с крыльцом, ступенями и перилами. Наверху — три спальни, внизу — кухня, питейный зал и бар.",
    camera: cameras.saloon,
    slots: saloonGeometry.openings.map((opening) => projectTarget(cameras.saloon, {
      x: (opening.left + opening.right) / 2, groundY: opening.floorY,
      floorElevationM: opening.floorElevationM, coverY: opening.coverY ?? opening.bottom,
      coverProfile: opening.coverProfile,
      aperture: opening,
    })),
  },
  {
    id: "street",
    name: "Улица городка",
    time: "Лёгкие сумерки",
    tint: 0xe4d8d6,
    emerge: true,
    description: "Сумеречная улица с восемью укрытиями: телега, ящики, бочки, высокие штабели и опрокинутая грузовая тележка. Поилка — низкая декорация.",
    camera: cameras.street,
    slots: [
      propSlot("street", "door-left"),
      projectTarget(cameras.street, { x: 241, groundY: 405, coverY: 278 }),
      projectTarget(cameras.street, { x: 356, groundY: 312, coverY: 272 }),
      projectTarget(cameras.street, { x: 528, groundY: 353, coverY: 282 }),
      propSlot("street", "door-right"),
      projectTarget(cameras.street, { x: 728, groundY: 468, coverY: 337 }),
      propSlot("street", "supply-stack"),
      propSlot("street", "handcart"),
    ],
  },
  {
    id: "tavern",
    name: "Внутри салуна",
    time: "Свет керосиновых ламп",
    tint: 0xffe4c4,
    emerge: true,
    description: "Восемь укрытий среди столов, бочек и барной стойки. Бандиты прячутся за высокими штабелями ящиков; низкий сундук служит декорацией.",
    camera: cameras.tavern,
    slots: [
      projectTarget(cameras.tavern, { x: 151, groundY: 304, coverY: 222, coverProfile: tavernBarrels }),
      projectTarget(cameras.tavern, { x: 241, groundY: 390, coverY: 234, coverProfile: tavernRoundTable }),
      projectTarget(cameras.tavern, { x: 365, groundY: 309, coverY: 244, coverProfile: tavernTippedTable }),
      projectTarget(cameras.tavern, { x: 474, groundY: 264, coverY: 219, coverProfile: tavernCrates }),
      projectTarget(cameras.tavern, { x: 697, groundY: 350, coverY: 234, coverProfile: tavernBar }),
      projectTarget(cameras.tavern, { x: 866, groundY: 390, coverY: 249, coverProfile: tavernBar }),
      propSlot("tavern", "tavern-supply"),
      propSlot("tavern", "beer-crates"),
    ],
  },
];

export function readMap(storage) {
  try {
    return maps.find((map) => map.id === storage.getItem("lastshot-map")) || maps[0];
  } catch {
    return maps[0];
  }
}

/** Follow slanted and curved cover edges; legacy maps retain horizontal sills. */
export function coverTopAt(x, target) {
  const profile = target.coverProfile ?? [];
  for (let i = 1; i < profile.length; i++) {
    const [left, top] = profile[i - 1], [right, bottom] = profile[i];
    if (x >= left && x <= right) return top + (bottom - top) * (x - left) / (right - left);
  }
  return target.coverY ?? Infinity;
}

/** Covered body parts cannot be shot through furniture, barrels or window sills. */
export function hitsTarget(x, y, target) {
  const scale = target.scale ?? 1;
  const bodyY = target.bodyY ?? target.y;
  const opening = target.aperture;
  return Number.isFinite(x) && Number.isFinite(y)
    && (!opening || (x >= opening.left && x <= opening.right && y >= opening.top && y <= opening.bottom))
    && Math.abs(x - target.x) <= (target.hitHalfWidth ?? 40) * scale
    && y >= bodyY - 56 * scale
    && y <= Math.min(bodyY + 43 * scale, coverTopAt(x, target) - 1);
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

const rectangle = (left, top, right, bottom) => [[left, top], [right, top], [right, bottom], [left, bottom]];
const tableNames = ["bar", "round-table", "barrels", "tipped-table", "storeroom"];
const tableGrounds = [540, 449, 304, 309, 264];

export const maps = mapDefinitions.map((map) => {
  const paintedCovers = map.id === "tavern"
    ? tavernCovers.map((polygon, i) => ({ id: tableNames[i], polygon,
      depth: (tableGrounds[i] - map.camera.horizonY) / map.camera.eyeHeightM + 0.1 }))
    : map.slots.filter((slot) => !("prop" in slot)).map((slot, i) => {
      const saloon = map.id === "saloon";
      const left = saloon ? slot.aperture.left - 8 : slot.x - 60 * slot.scale;
      const right = saloon ? slot.aperture.right + 8 : slot.x + 60 * slot.scale;
      const bottom = saloon ? Math.max(slot.coverY + 14, slot.bodyY + 48 * slot.scale + 2) : slot.groundY + 4;
      return { id: `${map.id}-${i}`, polygon: saloon && slot.coverProfile
        ? [...slot.coverProfile, [right, bottom], [left, bottom]] : rectangle(left, slot.coverY, right, bottom),
        depth: slot.pixelsPerMeter + 0.1 };
    });
  const occluders = [
    ...paintedCovers,
    ...(mapProps[map.id] ?? []).map((prop) => ({ depth: prop.depth, polygon: prop.outline })),
  ];
  return { ...map, paintedCovers, occluders };
});
