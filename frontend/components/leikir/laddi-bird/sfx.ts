/**
 * Laddí-bird sound effects on the Web Audio API.
 *
 * The first port played each effect through its own HTMLAudioElement, rewinding
 * and calling play() on every flap. On mobile that is the laggiest thing in the
 * game: media-element playback goes through the full media pipeline, a play()
 * can stall the main thread for tens of milliseconds, and with preload="none"
 * the first flap also started a network fetch. A flap is the one input the
 * player times precisely, so a hitch there reads as the whole game lagging.
 *
 * Here each file is fetched once, decoded once into an AudioBuffer, and played
 * as a throwaway buffer source — no seeking, no network, and overlapping
 * effects mix instead of cutting each other off.
 *
 * Browsers only let an AudioContext run after a user gesture, so the playing
 * context is created in unlock(), which the engine calls from its input handler.
 * Decoding does not need one: an OfflineAudioContext decodes ahead of time, and
 * an AudioBuffer plays on any context — so the very first tap already has its
 * sound ready instead of losing it to a decode that only just started.
 */

type Webkit = {
  webkitAudioContext?: typeof AudioContext;
  webkitOfflineAudioContext?: typeof OfflineAudioContext;
};

function audioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  return window.AudioContext ?? (window as unknown as Webkit).webkitAudioContext;
}

function offlineContextCtor(): typeof OfflineAudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  return window.OfflineAudioContext ?? (window as unknown as Webkit).webkitOfflineAudioContext;
}

export interface Sfx<Name extends string> {
  /** Start downloading every file. Safe to call more than once. */
  preload(): void;
  /** Create or resume the audio context. Call from inside a user gesture. */
  unlock(): void;
  /** Play an effect if it is ready; silently skip it otherwise. */
  play(name: Name): void;
  /** Abort downloads and close the context. */
  dispose(): void;
}

export function createSfx<Name extends string>(files: Record<Name, string>): Sfx<Name> {
  const buffers = new Map<Name, AudioBuffer>();
  const abort = new AbortController();
  let ctx: AudioContext | null = null;
  let requested = false;
  let disposed = false;

  return {
    preload() {
      const Offline = offlineContextCtor();
      if (requested || disposed || !Offline || !audioContextCtor()) return;
      requested = true;
      let decoder: OfflineAudioContext;
      try {
        // Length and rate are irrelevant: it is only ever used to decode.
        decoder = new Offline(1, 1, 44100);
      } catch {
        return; // no audio on this device
      }
      for (const name of Object.keys(files) as Name[]) {
        fetch(files[name], { signal: abort.signal })
          .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
          .then((data) => decoder.decodeAudioData(data))
          .then((buffer) => {
            if (!disposed) buffers.set(name, buffer);
          })
          .catch(() => {}); // decorative: a missing sound is not an error
      }
    },

    unlock() {
      if (disposed) return;
      const Ctor = audioContextCtor();
      if (!Ctor) return;
      try {
        ctx ??= new Ctor();
        // "suspended" before the first gesture; iOS also reports "interrupted"
        // after a call or a trip to the home screen.
        if (ctx.state !== "running") ctx.resume().catch(() => {});
      } catch {
        ctx = null; // no audio on this device
      }
    },

    play(name) {
      const buffer = buffers.get(name);
      // A context still resuming from this same gesture is fine: the source is
      // scheduled now and heard as soon as it starts running.
      if (!ctx || !buffer || ctx.state === "closed") return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    },

    dispose() {
      disposed = true;
      abort.abort();
      buffers.clear();
      ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}
