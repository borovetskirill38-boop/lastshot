// Measured floor planes in the 960×540 paintings. Elevation is independent of depth.
export const cameras = {
  saloon: { horizonY: 344.5, eyeHeightM: 1.65, focalLength: 720 },
  street: { horizonY: 225, eyeHeightM: 1.65, focalLength: 720 },
  tavern: { horizonY: 185, eyeHeightM: 1.65, focalLength: 720 },
};

export const saloonGeometry = {
  pixelsPerMeter: 50,
  characterScale: 1.25,
  floorY: 427,
  upperFloorY: 282,
  storeyHeightM: 2.9,
  openings: [
    { left: 204, right: 308, top: 143, bottom: 232, floorY: 282, floorElevationM: 2.9 },
    { left: 429, right: 532, top: 143, bottom: 232, floorY: 282, floorElevationM: 2.9 },
    { left: 650, right: 754, top: 143, bottom: 232, floorY: 282, floorElevationM: 2.9 },
    { left: 207, right: 309, top: 296, bottom: 367, floorY: 427, floorElevationM: 0 },
    { left: 430, right: 532, top: 289, bottom: 380, floorY: 427, floorElevationM: 0, door: true,
      coverY: 362, coverProfile: [[422, 369], [446, 373], [462, 370], [477, 362], [485, 362], [500, 370], [516, 373], [540, 369]] },
    { left: 650, right: 754, top: 296, bottom: 367, floorY: 427, floorElevationM: 0 },
  ],
};
