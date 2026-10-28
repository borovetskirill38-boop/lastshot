import { test } from "node:test";
import assert from "node:assert/strict";
import { projectTarget, CAMERA_EYE_HEIGHT_M, CAMERA_FOCAL_LENGTH } from "../src/projection.js";

const camera = { horizonY: 225, eyeHeightM: 1.65, focalLength: 720 };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);

test("nearer adults and cover grow together while projected distance decreases", () => {
  const far = projectTarget(camera, { x: 400, groundY: 307.5, coverY: 252.5 });
  const near = projectTarget(camera, { x: 600, groundY: 390, coverY: 280 });
  close(near.scale / far.scale, 2);
  close(near.personHeightPx, 180);
  close(far.personHeightPx, 90);
  close(near.distanceM, 7.2);
  close(far.distanceM, 14.4);
  close(near.coverHeightM, 1.1);
  close(far.coverHeightM, 1.1);
  close(near.personHeightPx / (near.groundY - near.coverY), 1.8 / 1.1);
  close(far.personHeightPx / (far.groundY - far.coverY), 1.8 / 1.1);
});

test("an upstairs floor changes image height without changing scale or distance at the same depth", () => {
  const downstairs = projectTarget(camera, { x: 230, groundY: 324, coverY: 264 });
  const upstairs = projectTarget(camera, { x: 230, groundY: 132, coverY: 72, floorElevationM: 3.2 });
  assert.ok(upstairs.groundY < camera.horizonY);
  close(upstairs.scale, downstairs.scale);
  close(upstairs.distanceM, downstairs.distanceM);
  close(upstairs.personHeightPx, downstairs.personHeightPx);
  close(upstairs.coverHeightM, downstairs.coverHeightM);
  close(downstairs.bodyY - upstairs.bodyY, 192);
  close(downstairs.y - upstairs.y, 192);
});

test("high cover keeps a hittable aim point above the edge even when the sprite origin is hidden", () => {
  const profile = [[350, 250], [450, 250]];
  const original = { x: 400, groundY: 390, coverY: 250, coverProfile: profile, prop: "crates" };
  const target = projectTarget(camera, original);
  close(target.bodyY, 269.85);
  close(target.y, 233.175);
  assert.ok(target.bodyY > target.coverY);
  assert.ok(target.y < target.coverY - 1);
  assert.equal(target.coverProfile, profile);
  assert.equal(target.prop, "crates");
  assert.equal(original.scale, undefined);
  assert.equal(original.y, undefined);
});

test("camera defaults use the common eye height and focal length", () => {
  assert.equal(CAMERA_EYE_HEIGHT_M, 1.65);
  assert.equal(CAMERA_FOCAL_LENGTH, 720);
  const spec = { x: 230, groundY: 390, coverY: 280 };
  assert.deepEqual(projectTarget({ horizonY: 225 }, spec), projectTarget(camera, spec));
});

test("invalid camera data, nonpositive projection and fully covered targets are rejected", () => {
  const spec = { x: 230, groundY: 390, coverY: 280 };
  for (const invalid of [
    { ...camera, horizonY: NaN }, { ...camera, eyeHeightM: 0 },
    { ...camera, eyeHeightM: -1 }, { ...camera, focalLength: 0 },
    { ...camera, focalLength: Infinity },
  ]) assert.throws(() => projectTarget(invalid, spec));
  for (const invalid of [
    { ...spec, x: NaN }, { ...spec, groundY: Infinity },
    { ...spec, coverY: undefined }, { ...spec, floorElevationM: NaN },
    { ...spec, groundY: 220 }, { ...spec, groundY: camera.horizonY },
    { ...spec, floorElevationM: camera.eyeHeightM },
    { ...spec, floorElevationM: 3.2 }, { ...spec, coverY: 200 },
  ]) assert.throws(() => projectTarget(camera, invalid));
});
