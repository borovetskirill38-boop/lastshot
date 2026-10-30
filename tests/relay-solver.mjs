// Independent search: choose a legal orientation for each two-port tile visited
// from the entry. This does not know or import the generator's route templates.
export function solveRelay(board) {
  const choices = mask => mask === 5 || mask === 10 ? [5, 10] : [3, 6, 9, 12];
  const visit = (cell, incoming, seen, path) => {
    if (seen.has(cell)) return null;
    const visited = new Set([...seen, cell]);
    for (const mask of choices(board.tiles[cell])) {
      if (!(mask & incoming)) continue;
      const outgoing = mask ^ incoming, row = cell >> 2, col = cell % 4;
      const result = [...path, { cell, mask }];
      if (cell === board.exit * 4 + 3 && outgoing === 2) return result;
      const next = outgoing === 1 ? row ? cell - 4 : -1
        : outgoing === 2 ? col < 3 ? cell + 1 : -1
          : outgoing === 4 ? row < 3 ? cell + 4 : -1 : col ? cell - 1 : -1;
      if (next < 0) continue;
      const found = visit(next, outgoing === 1 ? 4 : outgoing === 2 ? 8 : outgoing === 4 ? 1 : 2, visited, result);
      if (found) return found;
    }
    return null;
  };
  return visit(board.entry * 4, 8, new Set(), []);
}

export function turnsFor(mask, target) {
  let value = mask;
  for (let i = 0; i < 4; i++) {
    if (value === target) return i;
    value = ((value * 2) % 16) + (value >= 8 ? 1 : 0);
  }
  throw Error("Tile cannot match this orientation");
}
