import { hitsTarget } from "./maps.js";

export const bossTiming = { first: 700, hidden: 650, hostage: 1500, exposed: 2200 };

/** One clock drives movement, safe waiting windows and vulnerable appearances. */
export class BossEncounter {
  /** @type {"hidden" | "hostage" | "exposed" | "defeated"} */
  phase = "hidden";
  hp = 6;
  index = -1;
  nextHostage = true;
  remaining = [];

  constructor(positions, now = 0, random = Math.random) {
    if (!positions.length) throw new Error("Boss needs at least one cover position");
    this.positions = positions;
    this.position = positions[0];
    this.random = random;
    this.nextAt = now + bossTiming.first;
  }

  tick(now) {
    if (this.phase === "defeated" || now < this.nextAt) return null;
    if (this.phase === "hidden") {
      if (!this.remaining.length) this.remaining = this.positions.map((_, i) => i);
      const choices = this.remaining.filter((i) => i !== this.index);
      const roll = this.random();
      const fraction = Number.isFinite(roll) ? Math.max(0, Math.min(0.999999, roll)) : 0;
      this.index = choices[Math.floor(fraction * choices.length)] ?? 0;
      this.remaining = this.remaining.filter((i) => i !== this.index);
      this.position = this.positions[this.index];
      this.phase = this.nextHostage ? "hostage" : "exposed";
      this.nextHostage = !this.nextHostage;
      this.nextAt = now + bossTiming[this.phase];
      return "appeared";
    }
    const attack = this.phase === "exposed";
    this.retreat(now);
    return attack ? "attack" : "retreated";
  }

  fire(x, y, now) {
    if (this.phase !== "exposed" && this.phase !== "hostage") return "miss";
    const target = { ...this.position, hitHalfWidth: this.phase === "hostage" ? 50 : 40 };
    if (!hitsTarget(x, y, target)) return "miss";
    if (this.phase === "hostage") return "hostage";
    this.hp--;
    if (this.hp === 0) {
      this.phase = "defeated";
      this.nextAt = Infinity;
      return "defeated";
    }
    this.retreat(now);
    return "hit";
  }

  retreat(now) {
    this.phase = "hidden";
    this.nextAt = now + bossTiming.hidden;
  }
}
