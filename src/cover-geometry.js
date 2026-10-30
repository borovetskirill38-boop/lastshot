import { cameras } from "./cameras.js";

// Physical, immutable scene positions. Camera motion never changes these anchors.
export const coverCamera = {
  zoom: 1.16, focusDistanceM: 18, backdropDistanceM: 14.4,
  laneSpacingM: 2.6, crouchDropM: 0.72,
};
export const coverFrames = {
  barrels: [19, 87, 644, 531], crates: [697, 73, 593, 558],
  wagon: [14, 686, 639, 422], table: [678, 678, 613, 445],
};
const widthsM = { barrels: 1.6, crates: 1.4, wagon: 2, table: 1.8 };
const distancesM = { saloon: 6.7, street: 4.2, tavern: 3.9 };

export function coverAnchor(map, frame, lane) {
  const z = distancesM[map];
  const widthM = widthsM[frame];
  const [, , w, h] = coverFrames[frame];
  return Object.freeze({ x: (lane - 1) * coverCamera.laneSpacingM * (1 - z / coverCamera.focusDistanceM),
    z, widthM, heightM: widthM * h / w });
}

/** Yaw keeps the distant fight in view; nearby objects have stronger parallax. */
export function coverWorldView(position, duck) {
  const { zoom, laneSpacingM, focusDistanceM, backdropDistanceM, crouchDropM } = coverCamera;
  const cameraX = (position - 1) * laneSpacingM;
  return { zoom,
    x: 480 * (1 - zoom) + zoom * 720 * cameraX * (1 / focusDistanceM - 1 / backdropDistanceM),
    y: 270 * (1 - zoom) - zoom * 720 * duck * crouchDropM / backdropDistanceM };
}

/**
 * Ground contacts stay in the painting's floor plane. In this 2.5D view crouching
 * tilts the entire camera, rather than lifting individual props off that floor.
 * Only lateral parallax differs with depth; feet and their shadows share one Y.
 */
export function projectPlayerCover(map, anchor, position) {
  const camera = cameras[map];
  const cameraX = (position - 1) * coverCamera.laneSpacingM;
  const ppm = camera.focalLength / anchor.z;
  const backdropPPM = camera.focalLength / coverCamera.backdropDistanceM;
  return {
    x: 480 + anchor.x * ppm - cameraX * (ppm - backdropPPM),
    groundY: camera.horizonY + camera.eyeHeightM * ppm,
    width: anchor.widthM * ppm, height: anchor.heightM * ppm, pixelsPerMeter: ppm,
  };
}
