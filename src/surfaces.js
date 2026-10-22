/** Match visible wooden scenery. Empty window recesses and open sky do not thud. */
export function hitsWood(x, y, slots) {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    x > 960 ||
    y < 0 ||
    y > 540
  )
    return false;
  if (
    slots.some(
      (s) => x > s.x - 49 && x < s.x + 49 && y > s.y - 58 && y < s.y + 44,
    )
  )
    return false;
  const inRect = (left, top, right, bottom) =>
    x >= left && x <= right && y >= top && y <= bottom;
  return (
    inRect(108, 109, 865, 455) ||
    inRect(94, 111, 873, 147) ||
    inRect(318, 58, 648, 130) ||
    inRect(66, 458, 908, 482) ||
    inRect(26, 392, 80, 464) ||
    inRect(881, 405, 927, 467) ||
    inRect(8, 452, 69, 506)
  );
}
