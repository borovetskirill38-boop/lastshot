import shot1 from "./audio/shot-1.mp3?inline";
import shot2 from "./audio/shot-2.mp3?inline";
import reload from "./audio/reload.mp3?inline";
import wood1 from "./audio/wood-1.mp3?inline";
import wood2 from "./audio/wood-2.mp3?inline";
import banditDeath1 from "./audio/bandit-death-1.mp3?inline";
import banditDeath2 from "./audio/bandit-death-2.mp3?inline";
import civilianDeath from "./audio/civilian-death.mp3?inline";
import menuMusic from "./audio/menu-music.mp3?inline";
import menuAmbience from "./audio/menu-ambience.mp3?inline";
import pain1 from "./audio/pain-1.mp3?inline";
import pain2 from "./audio/pain-2.mp3?inline";
import pain3 from "./audio/pain-3.mp3?inline";

const clips = {
  shot1,
  shot2,
  reload,
  wood1,
  wood2,
  banditDeath1,
  banditDeath2,
  civilianDeath,
  pain1,
  pain2,
  pain3,
  menuMusic,
  menuAmbience,
};
type Clip = keyof typeof clips;
export type SoundEffect =
  "shot" | "reload" | "wood" | "banditDeath" | "civilianDeath" | "pain";
const variants: Record<SoundEffect, Clip[]> = {
  shot: ["shot1", "shot2"],
  reload: ["reload"],
  wood: ["wood1", "wood2"],
  banditDeath: ["banditDeath1", "banditDeath2"],
  civilianDeath: ["civilianDeath"],
  pain: ["pain1", "pain2", "pain3"],
};
const volumes: Record<SoundEffect, number> = {
  shot: 0.48,
  reload: 0.48,
  wood: 0.46,
  banditDeath: 0.68,
  civilianDeath: 0.7,
  pain: 0.55,
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
        const master = context.createGain(),
          limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -10;
        limiter.knee.value = 8;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.12;
        master.connect(limiter);
        limiter.connect(context.destination);
        this.master = master;
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
    source.playbackRate.value =
      kind === "reload" || kind === "shot"
        ? 1
        : kind === "civilianDeath"
          ? 1.06
          : kind === "banditDeath"
            ? 0.96
            : 0.98 + Math.random() * 0.04;
    const vocal =
      kind === "pain" || kind === "banditDeath" || kind === "civilianDeath";
    const start =
      context.currentTime + (vocal ? 0.065 : kind === "wood" ? 0.018 : 0);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volumes[kind], start + 0.002);
    const pan =
      typeof context.createStereoPanner === "function"
        ? context.createStereoPanner()
        : undefined;
    source.connect(gain);
    if (pan) {
      pan.pan.value = Math.max(-0.55, Math.min(0.55, position * 0.55));
      gain.connect(pan);
      pan.connect(master);
    } else gain.connect(master);
    const voice: Voice = { kind, source, gain, pan };
    this.voices.add(voice);
    source.onended = () => this.dispose(voice);
    source.start(start);
  }
}
