const epsilon = 1e-6;

/** A point on an edge belongs to the cover, matching a bullet stopped by its rim. */
export function pointInPolygon(x, y, polygon) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Array.isArray(polygon) || polygon.length < 3
    || !polygon.every((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[j], [bx, by] = polygon[i];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    const length = Math.hypot(bx - ax, by - ay);
    if (Math.abs(cross) <= epsilon * Math.max(1, length)
      && x >= Math.min(ax, bx) - epsilon && x <= Math.max(ax, bx) + epsilon
      && y >= Math.min(ay, by) - epsilon && y <= Math.max(ay, by) + epsilon) {
      return true;
    }
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
  }
  return inside;
}

/** Higher pixels-per-metre means nearer: distant furniture cannot block an actor. */
export function occludedByCover(x, y, pixelsPerMeter, occluders = []) {
  if (!Number.isFinite(pixelsPerMeter) || pixelsPerMeter <= 0 || !Array.isArray(occluders)) return false;
  return occluders.some((cover) => cover && Number.isFinite(cover.depth)
    && cover.depth > pixelsPerMeter + epsilon && pointInPolygon(x, y, cover.polygon));
}
