/**
 * Tiny WebAudio blips. The AudioContext is created lazily by unlock(), which the
 * UI calls from a user gesture, so browsers never block or warn about autoplay.
 */

/** Tone recipes: start/end frequency (Hz), length (s), wave, volume, start delay (s). */
const SOUNDS = Object.freeze({
  flap: [{ from: 520, to: 780, length: 0.08, wave: 'triangle', volume: 0.05, delay: 0 }],
  score: [
    { from: 880, to: 880, length: 0.07, wave: 'sine', volume: 0.06, delay: 0 },
    { from: 1320, to: 1320, length: 0.1, wave: 'sine', volume: 0.05, delay: 0.07 },
  ],
  hit: [{ from: 220, to: 55, length: 0.28, wave: 'square', volume: 0.05, delay: 0 }],
  best: [660, 880, 1100, 1320].map((f, i) => ({ from: f, to: f, length: 0.1, wave: 'triangle', volume: 0.05, delay: 0.3 + i * 0.08 })),
});

function playTone(ctx, tone) {
  const start = ctx.currentTime + tone.delay;
  const end = start + tone.length;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = tone.wave;
  osc.frequency.setValueAtTime(tone.from, start);
  osc.frequency.exponentialRampToValueAtTime(tone.to, end);
  gain.gain.setValueAtTime(tone.volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

/**
 * Create the sound player.
 * @param {{ muted?: boolean }} [options]
 * @returns {{ unlock(): void, play(name: 'flap' | 'score' | 'hit' | 'best'): void, setMuted(muted: boolean): void, isMuted(): boolean }}
 */
export function createAudio({ muted = false } = {}) {
  let ctx = null;
  let silent = muted;

  return {
    /** Create or resume the AudioContext; call only from a user gesture. */
    unlock() {
      if (silent) return;
      try {
        if (!ctx) {
          const AudioCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
          if (!AudioCtor) return;
          ctx = new AudioCtor();
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      } catch {
        ctx = null;
      }
    },

    /** Play a named blip if sound is on and unlocked. */
    play(name) {
      if (silent || !ctx || ctx.state !== 'running') return;
      for (const tone of SOUNDS[name] ?? []) playTone(ctx, tone);
    },

    setMuted(value) {
      silent = Boolean(value);
    },

    isMuted() {
      return silent;
    },
  };
}
