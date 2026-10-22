import shot from "./audio/shot.mp3?inline";
import reload from "./audio/reload.mp3?inline";
import wood1 from "./audio/wood-1.mp3?inline";
import wood2 from "./audio/wood-2.mp3?inline";
import bossDeath from "./audio/bandit-death.mp3?inline";
import menuMusic from "./audio/menu-music.mp3?inline";
import menuAmbience from "./audio/menu-ambience.mp3?inline";
import pain from "./audio/pain.mp3?inline";
import door from "./audio/saloon-door.mp3?inline";
import hover from "./audio/menu-hover.mp3?inline";

const clips = {
  shot,
  reload,
  wood1,
  wood2,
  bossDeath,
  menuMusic,
  menuAmbience,
  pain,
  door,
  hover,
};
type Clip = keyof typeof clips;
export type SoundEffect =
  | "shot"
  | "reload"
  | "wood"
  | "bossDeath"
  | "banditDeath"
  | "civilianDeath"
  | "pain"
  | "door"
  | "hover";
const variants: Record<SoundEffect, Clip[]> = {
  shot: ["shot"],
  reload: ["reload"],
  wood: ["wood1", "wood2"],
  bossDeath: ["bossDeath"],
  banditDeath: ["pain"],
  civilianDeath: ["pain"],
  pain: ["pain"],
  door: ["door"],
  hover: ["hover"],
};
const volumes: Record<SoundEffect, number> = {
  shot: 0.48,
  reload: 0.48,
  wood: 0.46,
  bossDeath: 0.68,
  banditDeath: 0.55,
  civilianDeath: 0.55,
  pain: 0.55,
  door: 0.48,
  hover: 0.15,
};
type Voice = {
  kind: SoundEffect;
  source: AudioBufferSourceNode;
  gain: GainNode;
  pan?: StereoPannerNode;
};

/** Recorded samples are bundled as data URLs, including in the single-file build. */
export class GameAudio {
  enabled = false;
  paused = false;
  failed = false;
  ready: Promise<void> = Promise.resolve();
  private context?: AudioContext;
  private master?: GainNode;
  private shotOutput?: DynamicsCompressorNode;
  private effectOutput?: DynamicsCompressorNode;
  private buffers = new Map<Clip, AudioBuffer>();
  private voices = new Set<Voice>();
  private inMenu = true;
  private hidden = false;
  private beds = new Map<
    "menuMusic" | "menuAmbience",
    { source: AudioBufferSourceNode; gain: GainNode }
  >();
  private lastClip = new Map<SoundEffect, Clip>();

  get state() {
    return {
      enabled: this.enabled,
      paused: this.paused,
      failed: this.failed,
      context: this.context?.state ?? "uninitialized",
      loaded: this.buffers.size,
      active: this.voices.size,
      background: [...this.beds.keys()],
      inMenu: this.inMenu,
      hidden: this.hidden,
    };
  }
  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
      this.setGain();
      return;
    }
    try {
      if (!this.context) {
        // Create/resume synchronously inside the sound-button gesture (mobile autoplay rules).
        const context = new AudioContext();
        this.context = context;
        const master = context.createGain();
        // Independent buses: an impact must never duck or recolor the gun recording.
        const shotOutput = context.createDynamicsCompressor(),
          effectOutput = context.createDynamicsCompressor();
        for (const limiter of [shotOutput, effectOutput]) {
          limiter.threshold.value = -10;
          limiter.knee.value = 8;
          limiter.ratio.value = 12;
          limiter.attack.value = 0.003;
          limiter.release.value = 0.12;
          limiter.connect(master);
        }
        master.connect(context.destination);
        this.master = master;
        this.shotOutput = shotOutput;
        this.effectOutput = effectOutput;
        this.setGain();
        this.ready = Promise.all(
          Object.entries(clips).map(async ([name, url]) => {
            const encoded = url.slice(url.indexOf(",") + 1);
            const bytes = Uint8Array.from(atob(encoded), (c) =>
              c.charCodeAt(0),
            );
            const buffer = await context.decodeAudioData(bytes.buffer);
            this.buffers.set(name as Clip, buffer);
          }),
        )
          .then(() => {})
          .catch(() => this.unavailable());
      }
      this.setGain();
      if (!this.paused && !this.hidden) await this.context.resume();
      await this.ready;
      this.syncMenu();
    } catch {
      this.unavailable();
    }
  }
  private unavailable() {
    this.failed = true;
    this.enabled = false;
    this.stop();
    this.setGain();
  }
  private setGain() {
    if (!this.context || !this.master) return;
    this.master.gain.setValueAtTime(
      this.enabled && !this.paused && !this.hidden ? 0.72 : 0,
      this.context.currentTime,
    );
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    this.syncContext();
  }
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    this.syncContext();
  }
  private syncContext() {
    this.setGain();
    if (!this.context) return;
    const blocked = this.paused || this.hidden;
    const change = blocked
      ? this.context.suspend()
      : this.enabled
        ? this.context.resume()
        : undefined;
    void change?.catch(() => this.unavailable());
    if (!blocked) this.syncMenu();
  }
  setMenu(inMenu: boolean) {
    this.inMenu = inMenu;
    this.syncMenu();
  }
  private syncMenu() {
    if (!this.inMenu || !this.enabled || this.failed) {
      this.stopBeds();
      return;
    }
    const context = this.context,
      master = this.master;
    if (!context || !master || this.paused || this.hidden) return;
    for (const clip of ["menuMusic", "menuAmbience"] as const) {
      if (this.beds.has(clip)) continue;
      const buffer = this.buffers.get(clip);
      if (!buffer) continue;
      const source = context.createBufferSource(),
        gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      gain.connect(master);
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(
        clip === "menuMusic" ? 0.22 : 0.16,
        context.currentTime + 0.6,
      );
      this.beds.set(clip, { source, gain });
      source.start();
    }
  }
  private stopBeds() {
    for (const { source, gain } of this.beds.values()) {
      try {
        source.stop();
      } catch {}
      source.disconnect();
      gain.disconnect();
    }
    this.beds.clear();
  }
  stop(kind?: SoundEffect) {
    if (!kind) this.stopBeds();
    for (const voice of [...this.voices]) {
      if (kind && voice.kind !== kind) continue;
      // stop() also cancels delayed pain samples, so mute/menu never play stale audio.
      try {
        voice.source.stop();
      } catch {
        /* The source may already have ended. */
      }
      this.dispose(voice);
    }
  }
  private dispose(voice: Voice) {
    voice.source.onended = null;
    voice.source.disconnect();
    voice.gain.disconnect();
    voice.pan?.disconnect();
    this.voices.delete(voice);
  }
  play(kind: SoundEffect, position = 0) {
    const context = this.context,
      master = this.master;
    if (
      !this.enabled ||
      this.paused ||
      this.hidden ||
      this.failed ||
      !context ||
      !master ||
      context.state !== "running"
    )
      return;
    const choices = variants[kind];
    const pool =
      choices.length > 1
        ? choices.filter((c) => c !== this.lastClip.get(kind))
        : choices;
    const clip = pool[Math.floor(Math.random() * pool.length)],
      buffer = this.buffers.get(clip);
    if (!buffer) return; // Do not replay old gameplay events when decoding finishes.
    this.lastClip.set(kind, clip);
    while (this.voices.size >= 18) {
      const oldest = this.voices.values().next().value;
      if (!oldest) break;
      try {
        oldest.source.stop();
      } catch {}
      this.dispose(oldest);
    }
    const source = context.createBufferSource(),
      gain = context.createGain();
    source.buffer = buffer;
    // Civilians share the boss hurt recording, raised by two semitones.
    // Boss voices and the fixed gun take retain their original pitch.
    source.playbackRate.value =
      kind === "civilianDeath"
        ? 2 ** (2 / 12)
        : kind === "wood"
          ? 0.98 + Math.random() * 0.04
          : 1;
    const start = context.currentTime;
    const output = kind === "shot" ? this.shotOutput! : this.effectOutput!;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volumes[kind], start + 0.002);
    const pan =
      typeof context.createStereoPanner === "function"
        ? context.createStereoPanner()
        : undefined;
    source.connect(gain);
    if (pan) {
      pan.pan.value = Math.max(
        -0.55,
        Math.min(0.55, (kind === "shot" ? 0 : position) * 0.55),
      );
      gain.connect(pan);
      pan.connect(output);
    } else gain.connect(output);
    const voice: Voice = { kind, source, gain, pan };
    this.voices.add(voice);
    source.onended = () => this.dispose(voice);
    source.start(start);
  }
}
