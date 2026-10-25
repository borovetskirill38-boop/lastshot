import { streetWood } from "./maps.js";
import { mapProps } from "./props.js";

function inPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i], [bx, by] = points[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

/** Match visible wooden scenery. Empty recesses, sky and dirt do not thud. */
export function hitsWood(x, y, slots, mapId = "saloon") {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    x > 960 ||
    y < 0 ||
    y > 540
  )
    return false;
  const inRect = (left, top, right, bottom) =>
    x >= left && x <= right && y >= top && y <= bottom;
  if (mapProps[mapId]?.some((prop) => inPolygon(x, y, prop.outline))) return true;
  if (mapId === "tavern") {
    // Wooden walls, floor and furniture; glass, mirrors, dark passage and rugs differ.
    return !(inPolygon(x, y, [[107, 52], [151, 77], [151, 222], [107, 221]])
      || inPolygon(x, y, [[231, 126], [252, 137], [252, 218], [231, 211]])
      || inPolygon(x, y, [[874, 30], [960, 0], [960, 225], [862, 213], [869, 85]])
      || inRect(448, 161, 508, 214)
      || inPolygon(x, y, [[0, 331], [93, 320], [123, 340], [0, 377]])
      || inPolygon(x, y, [[521, 278], [645, 279], [652, 298], [526, 290]]));
  }
  if (mapId === "street") {
    if (inRect(62, 174, 101, 282) || inRect(850, 173, 894, 288)) return false;
    return streetWood.some((polygon) => inPolygon(x, y, polygon));
  }
  if (
    slots.some(
      (s) => {
        const scale = s.scale ?? 1;
        return x > s.x - 49 * scale && x < s.x + 49 * scale
          && y > s.y - 58 * scale && y < Math.min(s.y + 44 * scale, s.coverY ?? Infinity);
      },
    )
  )
    return false;
  return (
    inRect(108, 109, 865, 455) ||
    inRect(94, 111, 873, 147) ||
    inRect(318, 58, 648, 130) ||
    inRect(66, 458, 908, 482) ||
    inRect(336, 482, 623, 518) || // New central wooden steps.
    inRect(310, 417, 350, 515) ||
    inRect(620, 417, 660, 515) || // Short porch handrails.
    inRect(26, 392, 80, 464) ||
    inRect(881, 405, 927, 467) ||
    inRect(8, 452, 69, 506)
  );
}
