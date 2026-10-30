export const telegraphMode = {
  name: "Линия жизни", goal: 3, interval: 7000, lifetime: 4000, civilians: 0,
  duration: 120000, maxBandits: 8,
};
export const telegraphKey = "lastshot-telegraph";
export const ports = { north: 1, east: 2, south: 4, west: 8 };
const masks = [3, 6, 12, 9, 5, 10];
const routes = [
  [0, 1, 5, 4, 8, 9, 10, 6, 7, 11],
  [4, 5, 1, 2, 6, 10, 9, 13, 14, 15],
  [12, 8, 9, 5, 4, 0, 1, 2, 6, 7],
  [8, 9, 13, 14, 10, 6, 5, 1, 2, 3],
];

/** @typedef {{tiles: number[], entry: number, exit: number}} RelayBoard */
export function turnContact(mask) { return ((mask << 1) & 15) | ((mask >> 3) & 1); }
const roll = random => {
  const value = random();
  return Number.isFinite(value) ? Math.max(0, Math.min(.999999, value)) : 0;
};
const direction = (from, to) => to === from - 4 ? 1 : to === from + 1 ? 2 : to === from + 4 ? 4 : 8;

/** A guaranteed route, random turns and harmless extra contacts. No stored solution. */
export function createRelayBoard(random = Math.random, salt = 0) {
  const variant = (Math.floor(roll(random) * routes.length) + salt) % routes.length;
  const flip = roll(random) < .5;
  const route = routes[variant].map(cell => flip ? (3 - Math.floor(cell / 4)) * 4 + cell % 4 : cell);
  const tiles = Array.from({ length: 16 }, () => masks[Math.floor(roll(random) * masks.length)]);
  route.forEach((cell, i) => {
    tiles[cell] = (i ? direction(cell, route[i - 1]) : ports.west)
      | (i + 1 < route.length ? direction(cell, route[i + 1]) : ports.east);
  });
  for (let i = 0; i < tiles.length; i++) {
    const turns = Math.floor(roll(random) * 4);
    for (let turn = 0; turn < turns; turn++) tiles[i] = turnContact(tiles[i]);
  }
  // Every run begins disconnected, even with a constant or broken random source.
  while (tiles[route[0]] & ports.west) tiles[route[0]] = turnContact(tiles[route[0]]);
  return { tiles, entry: Math.floor(route[0] / 4), exit: Math.floor(route.at(-1) / 4) };
}

/** Only mutually joined ports conduct; row wrapping, dangling ends and loops do not. */
export function signalPath(board) {
  if (!board || !Array.isArray(board.tiles) || board.tiles.length !== 16
    || !board.tiles.every(mask => masks.includes(mask))
    || ![board.entry, board.exit].every(row => Number.isInteger(row) && row >= 0 && row < 4)) {
    return { connected: false, powered: [] };
  }
  const start = board.entry * 4, end = board.exit * 4 + 3;
  if (!(board.tiles[start] & ports.west)) return { connected: false, powered: [] };
  const visited = new Set([start]), queue = [start];
  for (const cell of queue) {
    const row = Math.floor(cell / 4), col = cell % 4;
    for (const [port, opposite, neighbor, inside] of [
      [1, 4, cell - 4, row > 0], [2, 8, cell + 1, col < 3],
      [4, 1, cell + 4, row < 3], [8, 2, cell - 1, col > 0],
    ]) {
      if (inside && (board.tiles[cell] & port) && (board.tiles[neighbor] & opposite) && !visited.has(neighbor)) {
        visited.add(neighbor); queue.push(neighbor);
      }
    }
  }
  return { connected: visited.has(end) && !!(board.tiles[end] & ports.east), powered: [...visited] };
}

/** Scene time only: reading the intro, pausing and hiding a tab cannot consume time. */
export class TelegraphMission {
  /** @type {"ready" | "active" | "won" | "lost"} */
  phase = "ready";
  done = [false, false, false];
  startedAt = 0;
  deadline = Infinity;
  endedAt = 0;
  constructor(random = Math.random) {
    this.boards = Array.from({ length: 3 }, (_, i) => createRelayBoard(random, i));
  }
  start(now) {
    if (this.phase !== "ready") return;
    this.phase = "active"; this.startedAt = now; this.deadline = now + telegraphMode.duration;
  }
  tick(now) {
    if (this.phase === "active" && now >= this.deadline) {
      this.phase = "lost"; this.endedAt = this.deadline; return "timeout";
    }
    return null;
  }
  turn(station, cell, now) {
    this.tick(now);
    if (this.phase !== "active" || !Number.isInteger(station) || station < 0 || station > 2
      || this.done[station] || !Number.isInteger(cell) || cell < 0 || cell > 15) return false;
    this.boards[station].tiles[cell] = turnContact(this.boards[station].tiles[cell]);
    return true;
  }
  connect(station, now) {
    this.tick(now);
    if (this.phase !== "active" || !Number.isInteger(station) || station < 0 || station > 2
      || this.done[station] || !signalPath(this.boards[station]).connected) return false;
    this.done[station] = true;
    if (this.done.every(Boolean)) { this.phase = "won"; this.endedAt = now; }
    return true;
  }
  remaining(now) {
    if (this.phase === "ready") return telegraphMode.duration;
    return Math.max(0, this.deadline - (this.phase === "active" ? now : this.endedAt));
  }
  stop(now) {
    if (this.phase !== "active") return;
    this.phase = "lost"; this.endedAt = Math.min(now, this.deadline);
  }
  get restored() { return this.done.filter(Boolean).length; }
  get elapsed() { return Math.max(0, this.endedAt - this.startedAt); }
}

export function readTelegraphRecord(storage) {
  try {
    const saved = JSON.parse(storage.getItem(telegraphKey) || "null");
    const wins = Number.isSafeInteger(saved?.wins) && saved.wins >= 0 ? saved.wins : 0;
    const bestMs = wins > 0 && Number.isFinite(saved?.bestMs) && saved.bestMs > 0 && saved.bestMs < telegraphMode.duration ? saved.bestMs : null;
    return { wins, bestMs };
  } catch { return { wins: 0, bestMs: null }; }
}

export function recordTelegraphWin(record, elapsed) {
  if (!Number.isFinite(elapsed) || elapsed <= 0 || elapsed >= telegraphMode.duration) return record;
  return { wins: Math.min(Number.MAX_SAFE_INTEGER, record.wins + 1), bestMs: Math.min(record.bestMs ?? Infinity, elapsed) };
}

export function formatRelayTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
