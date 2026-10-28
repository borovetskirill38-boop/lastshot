import { cameras } from "./cameras.js";
import { projectTarget } from "./projection.js";

// Atlas frames and upper silhouettes measured from cover-props.webp (alpha > 127).
// The same placement drives drawing, visible hit regions and wooden impacts.
export const propFrames = {
  trough: [18, 295, 609, 300],
  handcart: [627, 152, 614, 458],
  chest: [18, 833, 609, 314],
  crates: [627, 748, 611, 426],
};
const edges = {
  trough: [[0.0, 0.49261], [0.03125, 0.09852], [0.0625, 0.07225], [0.09375, 0.03941], [0.125, 0.00821], [0.15625, 0.00821], [0.1875, 0.0197], [0.21875, 0.0197], [0.25, 0.01806], [0.28125, 0.0197], [0.3125, 0.01806], [0.34375, 0.01806], [0.375, 0.01806], [0.40625, 0.01806], [0.4375, 0.01806], [0.46875, 0.01806], [0.5, 0.01806], [0.53125, 0.01806], [0.5625, 0.01806], [0.59375, 0.01806], [0.625, 0.01806], [0.65625, 0.01806], [0.6875, 0.01806], [0.71875, 0.01806], [0.75, 0.01806], [0.78125, 0.01806], [0.8125, 0.00985], [0.84375, 0.00493], [0.875, 0.00657], [0.90625, 0.0197], [0.9375, 0.06404], [0.96875, 0.09688], [1.0, 0.11987]],
  handcart: [[0.0, 0.35342], [0.03125, 0.46254], [0.0625, 0.35831], [0.09375, 0.24593], [0.125, 0.02443], [0.15625, 0.02443], [0.1875, 0.0228], [0.21875, 0.02117], [0.25, 0.02117], [0.28125, 0.01954], [0.3125, 0.01792], [0.34375, 0.01792], [0.375, 0.01629], [0.40625, 0.01629], [0.4375, 0.01466], [0.46875, 0.01466], [0.5, 0.01303], [0.53125, 0.01303], [0.5625, 0.0114], [0.59375, 0.0114], [0.625, 0.00977], [0.65625, 0.00977], [0.6875, 0.00814], [0.71875, 0.00651], [0.75, 0.00651], [0.78125, 0.00489], [0.8125, 0.00489], [0.84375, 0.00163], [0.875, 0.00163], [0.90625, 0.2329], [0.9375, 0.27036], [0.96875, 0.42834], [1.0, 0.74593]],
  chest: [[0.0, 0.5156], [0.03125, 0.08539], [0.0625, 0.07225], [0.09375, 0.05583], [0.125, 0.03941], [0.15625, 0.02299], [0.1875, 0.00493], [0.21875, 0.00164], [0.25, 0.00493], [0.28125, 0.00164], [0.3125, 0.00328], [0.34375, 0.00493], [0.375, 0.00657], [0.40625, 0.00657], [0.4375, 0.00657], [0.46875, 0.00657], [0.5, 0.00657], [0.53125, 0.00657], [0.5625, 0.00657], [0.59375, 0.00821], [0.625, 0.00821], [0.65625, 0.00821], [0.6875, 0.00985], [0.71875, 0.00985], [0.75, 0.00985], [0.78125, 0.00985], [0.8125, 0.00657], [0.84375, 0.00985], [0.875, 0.00657], [0.90625, 0.01149], [0.9375, 0.00821], [0.96875, 0.01149], [1.0, 0.20854]],
  crates: [[0.0, 0.34861], [0.03125, 0.69722], [0.0625, 0.28151], [0.09375, 0.27496], [0.125, 0.2635], [0.15625, 0.04583], [0.1875, 0.03601], [0.21875, 0.02782], [0.25, 0.018], [0.28125, 0.00491], [0.3125, 0.00164], [0.34375, 0.00655], [0.375, 0.00818], [0.40625, 0.00818], [0.4375, 0.00982], [0.46875, 0.00982], [0.5, 0.01146], [0.53125, 0.01146], [0.5625, 0.01309], [0.59375, 0.01309], [0.625, 0.01473], [0.65625, 0.01473], [0.6875, 0.01637], [0.71875, 0.018], [0.75, 0.018], [0.78125, 0.01964], [0.8125, 0.018], [0.84375, 0.01964], [0.875, 0.25532], [0.90625, 0.25696], [0.9375, 0.25859], [0.96875, 0.25859], [1.0, 0.69722]],
};

function obstacle(camera, id, frame, x, groundY, widthM, active = true, floorElevationM = 0) {
  const pixelsPerMeter = (groundY - camera.horizonY) / (camera.eyeHeightM - floorElevationM);
  const width = widthM * pixelsPerMeter;
  const [, , sourceWidth, sourceHeight] = propFrames[frame];
  const height = sourceHeight * width / sourceWidth;
  const y = groundY - height;
  const coverProfile = edges[frame].map(([u, v]) => [x + (u - 0.5) * width, y + v * width]);
  const coverY = coverProfile[Math.floor(coverProfile.length / 2)][1];
  return {
    id, frame, x, y, groundY, width, height, widthM, pixelsPerMeter, active,
    depth: pixelsPerMeter + 0.1,
    slot: active ? projectTarget(camera, { x, groundY, floorElevationM, coverY, coverProfile, prop: id }) : undefined,
    outline: [...coverProfile, [x + width / 2, groundY], [x - width / 2, groundY]],
  };
}

export const mapProps = {
  street: [
    obstacle(cameras.street, "door-left", "crates", 83, 282, 1.3, true, 0.6),
    obstacle(cameras.street, "door-right", "crates", 871, 288, 1.3, true, 0.6),
    obstacle(cameras.street, "supply-stack", "crates", 410, 390, 1.65),
    obstacle(cameras.street, "handcart", "handcart", 607, 425, 1.65),
    obstacle(cameras.street, "trough", "trough", 410, 460, 1.4, false),
  ],
  tavern: [
    obstacle(cameras.tavern, "chest", "chest", 410, 464, 1.2, false),
    obstacle(cameras.tavern, "tavern-supply", "crates", 410, 365, 1.65),
    obstacle(cameras.tavern, "beer-crates", "crates", 600, 405, 1.65),
  ],
};

export function propSlot(mapId, id) {
  const slot = mapProps[mapId].find((prop) => prop.id === id)?.slot;
  if (!slot) throw new Error(`No active cover ${mapId}/${id}`);
  return slot;
}
