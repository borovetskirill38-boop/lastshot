import shot1 from "./audio/shot-1.mp3?inline";
import shot2 from "./audio/shot-2.mp3?inline";
import reload from "./audio/reload.mp3?inline";
import wood1 from "./audio/wood-1.mp3?inline";
import wood2 from "./audio/wood-2.mp3?inline";
import body from "./audio/body.mp3?inline";
import pain1 from "./audio/pain-1.mp3?inline";
import pain2 from "./audio/pain-2.mp3?inline";
import pain3 from "./audio/pain-3.mp3?inline";

const clips = { shot1, shot2, reload, wood1, wood2, body, pain1, pain2, pain3 };
type Clip = keyof typeof clips;
export type SoundEffect = "shot" | "reload" | "wood" | "body" | "pain";
const variants: Record<SoundEffect, Clip[]> = {
  shot: ["shot1", "shot2"],
  reload: ["reload"],
  wood: ["wood1", "wood2"],
  body: ["body"],
  pain: ["pain1", "pain2", "pain3"],
};
const volumes: Record<SoundEffect, number> = {
  shot: 0.62,
  reload: 0.48,
  wood: 0.46,
  body: 0.4,
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
  private lastClip = new Map<SoundEffect, Clip>();

  get state() {
    return {
      enabled: this.enabled,
      paused: this.paused,
      failed: this.failed,
      context: this.context?.state ?? "uninitialized",
      loaded: this.buffers.size,
      active: this.voices.size,
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
      if (!this.paused) await this.context.resume();
      await this.ready;
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
      this.enabled && !this.paused ? 0.72 : 0,
      this.context.currentTime,
    );
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    this.setGain();
    if (!this.context) return;
    const change = paused
      ? this.context.suspend()
      : this.enabled
        ? this.context.resume()
        : undefined;
    void change?.catch(() => this.unavailable());
  }
  stop(kind?: SoundEffect) {
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
      kind === "reload"
        ? 1
        : kind === "pain"
          ? 0.96 + Math.random() * 0.08
          : 0.98 + Math.random() * 0.04;
    const start =
      context.currentTime +
      (kind === "pain"
        ? 0.045
        : kind === "wood" || kind === "body"
          ? 0.018
          : 0);
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
