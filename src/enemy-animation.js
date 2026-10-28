export const gunmanAnimation = { frames: 96, raiseFrames: 48, raiseFraction: 0.72, recoveryMs: 600 };
const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => { const t = clamp(n); return t * t * (3 - 2 * t); };

/** Three authored arm poses supply a continuous draw/lower path. Recoil is small,
 * keeping the muzzle in front of the torso rather than swinging over the head. */
export function gunmanPose(frame) {
  if (frame < 48) return { draw: 2 * ease(frame / 47), kick: 0 };
  const age = (frame - 48) / 47 * gunmanAnimation.recoveryMs;
  return {
    draw: age <= 190 ? 2 : 2 * (1 - ease((age - 190) / 410)),
    kick: age >= 170 ? 0 : Math.sin(Math.PI * age / 170) * Math.exp(-age / 190),
  };
}

/** Pure sampling: seeking, pause and delayed frames never create firing events. */
export function sampleGunmanFrame(progress, now, firedAt) {
  if (firedAt === undefined) return Math.round(clamp(progress / gunmanAnimation.raiseFraction) * 47);
  const age = Math.max(0, now - firedAt);
  return 48 + Math.round(clamp(age / gunmanAnimation.recoveryMs) * 47);
}
