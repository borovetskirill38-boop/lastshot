export const CAMERA_EYE_HEIGHT_M = 1.65;
export const CAMERA_FOCAL_LENGTH = 720;
export const HUMAN_HEIGHT_M = 1.8;
export const UPPER_BODY_HEIGHT_M = 1.05;
export const SPRITE_HEIGHT_PX = 112;
export const SPRITE_ORIGIN_Y = 0.57;
export const HIT_TOP_PX = 56;
export const HIT_BOTTOM_PX = 43;

/**
 * Project an adult and its cover from a measured floor contact into the painting.
 * Upper floors may lie above the horizon: both projection terms then change sign.
 * The returned y is a visible aiming point; bodyY remains the sprite's origin.
 * @template {{x: number, groundY: number, coverY: number, floorElevationM?: number}} T
 * @param {{horizonY: number, eyeHeightM?: number, focalLength?: number}} camera
 * @param {T} spec
 */
export function projectTarget(camera, spec) {
  const { horizonY, eyeHeightM = CAMERA_EYE_HEIGHT_M, focalLength = CAMERA_FOCAL_LENGTH } = camera;
  const { x, groundY, coverY, floorElevationM = 0 } = spec;
  if (![horizonY, eyeHeightM, focalLength, x, groundY, coverY, floorElevationM].every(Number.isFinite)) {
    throw new TypeError("Projection requires finite camera, floor and cover coordinates");
  }
  if (eyeHeightM <= 0 || focalLength <= 0) {
    throw new RangeError("Camera eye height and focal length must be positive");
  }
  const pixelsPerMeter = (groundY - horizonY) / (eyeHeightM - floorElevationM);
  const distanceM = focalLength / pixelsPerMeter;
  const scale = pixelsPerMeter * UPPER_BODY_HEIGHT_M / SPRITE_HEIGHT_PX;
  const bodyY = groundY - (HUMAN_HEIGHT_M - SPRITE_ORIGIN_Y * UPPER_BODY_HEIGHT_M) * pixelsPerMeter;
  const personHeightPx = HUMAN_HEIGHT_M * pixelsPerMeter;
  const coverHeightM = (groundY - coverY) / pixelsPerMeter;
  if (![pixelsPerMeter, distanceM, scale, bodyY, personHeightPx, coverHeightM].every(Number.isFinite)
    || pixelsPerMeter <= 0 || distanceM <= 0 || scale <= 0) {
    throw new RangeError("Floor contact must produce a positive finite projection");
  }
  const top = bodyY - HIT_TOP_PX * scale;
  const bottom = Math.min(bodyY + HIT_BOTTOM_PX * scale, coverY - 1);
  if (bottom <= top) throw new RangeError("The cover leaves no visible target to aim at");
  return {
    ...spec, floorElevationM, scale, bodyY, pixelsPerMeter, distanceM,
    personHeightPx, coverHeightM, y: (top + bottom) / 2,
  };
}
