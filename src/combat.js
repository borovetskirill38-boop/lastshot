export const combatTiming = { move: 360, stance: 200, warning: 1100, recoil: 300, immunity: 650 };
export const playerCovers = {
  saloon: [{ name: "Бочки у крыльца", frame: "barrels" }, { name: "Ящики с припасами", frame: "crates" }, { name: "Бочки у коновязи", frame: "barrels" }],
  street: [{ name: "Бочки торговца", frame: "barrels" }, { name: "Грузовая телега", frame: "wagon" }, { name: "Ящики у лавки", frame: "crates" }],
  tavern: [{ name: "Перевёрнутый стол", frame: "table" }, { name: "Пивные бочки", frame: "barrels" }, { name: "Стол у лестницы", frame: "table" }],
};
const smooth = n => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };

/** Time is the scene's pause-safe clock, never wall time. */
export class CoverMovement {
  lane = 1;
  position = 1;
  duck = 0;
  crouching = false;
  from = 1;
  moveAt = -Infinity;
  stanceAt = -Infinity;
  stanceFrom = 0;
  tick(now) {
    this.position = this.from + (this.lane - this.from) * smooth((now - this.moveAt) / combatTiming.move);
    this.duck = this.stanceFrom + (Number(this.crouching) - this.stanceFrom) * smooth((now - this.stanceAt) / combatTiming.stance);
  }
  move(direction, now) {
    this.tick(now);
    if (Math.abs(this.position - this.lane) > 0.01) return false;
    const lane = Math.max(0, Math.min(2, this.lane + Math.sign(direction)));
    if (lane === this.lane) return false;
    this.from = this.position; this.lane = lane; this.moveAt = now;
    return true;
  }
  stance(crouching, now) {
    this.tick(now);
    if (this.crouching === crouching) return;
    this.stanceFrom = this.duck; this.stanceAt = now; this.crouching = crouching;
  }
  get moving() { return Math.abs(this.position - this.lane) > 0.01; }
  get protected() { return this.duck >= 0.9 && !this.moving; }
  get canShoot() { return !this.crouching && this.duck <= 0.1; }
  receive(aimedLane) {
    if (this.protected) return "cover";
    return Math.abs(this.position - aimedLane) > 0.65 ? "dodge" : "hit";
  }
}

export function planAttack(now) {
  return { readyAt: now + 300, started: false, fired: false, start: 0, fireAt: Infinity, lane: 1 };
}

/** A delayed frame starts a fresh warning instead of dealing unseen damage. */
export function tickAttack(attack, now, playerLane) {
  if (attack.fired || now < attack.readyAt) return null;
  if (!attack.started) {
    attack.started = true; attack.start = now; attack.fireAt = now + combatTiming.warning; attack.lane = playerLane;
    return "aim";
  }
  if (now >= attack.fireAt) { attack.fired = true; return "fire"; }
  return null;
}
