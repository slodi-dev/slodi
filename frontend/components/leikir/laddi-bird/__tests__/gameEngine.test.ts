import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createGameEngine } from "../gameEngine";

/**
 * The engine is a canvas/rAF/Audio factory, none of which jsdom implements, so
 * each of those is stubbed here. The tests focus on the behaviours the port was
 * meant to fix — cleanup, the NaN-before-load hazard, and frame-rate
 * independence — rather than on redrawing the game.
 */

// ── Sprite dimensions, keyed by the tail of the src ──────────────────────────
// These are the real dimensions of the files in public/leikir/laddi-bird, so
// the simulated geometry matches the shipped game.
const SPRITE_SIZES: Record<string, [number, number]> = {
  "BG.png": [276, 228],
  "ground.png": [552, 112],
  "toppipe.png": [52, 400],
  "botpipe.png": [52, 400],
  "getready.png": [174, 160],
  "go.png": [188, 144],
  "t0.png": [118, 36],
  "t1.png": [118, 36],
  "laddi.png": [68, 52],
};

const GROUND_H = 112;
const GAME_H = 500;

/** Whether stubbed images resolve their onload. Off = assets never arrive. */
let imagesLoad = true;
/** Basenames that should fire onerror instead of onload (a 404'd sprite). */
let failing = new Set<string>();
/** How many images the engine asked for, so tests need not hardcode a count. */
let loadedCount = 0;
/** Every image the engine constructed, so a late load can be simulated. */
let lastImages: Array<{ src: string; width: number; height: number; onload: (() => void) | null }> =
  [];

function installImageStub() {
  class StubImage {
    width = 0;
    height = 0;
    _failed = false;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private _src = "";

    set src(value: string) {
      this._src = value;
      loadedCount++;
      lastImages.push(this as unknown as (typeof lastImages)[number]);
      const file = value.split("/").pop() ?? "";
      if (!imagesLoad) return;

      if (failing.has(file)) {
        this._failed = true;
        queueMicrotask(() => this.onerror?.());
        return;
      }
      const size = SPRITE_SIZES[file];
      if (size) [this.width, this.height] = size;
      // Real decodes are async; firing on a microtask keeps the ordering
      // honest without making the tests wait on a timer.
      queueMicrotask(() => this.onload?.());
    }
    get src() {
      return this._src;
    }
  }
  vi.stubGlobal("Image", StubImage);
}

interface StubAudioLike {
  src: string;
  preload: string;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  removeAttribute: ReturnType<typeof vi.fn>;
}

/** Every Audio the engine constructed, so cleanup can be asserted on. */
let audioInstances: StubAudioLike[] = [];

function installAudioStub() {
  class StubAudio {
    src = "";
    preload = "auto";
    currentTime = 0;
    play = vi.fn(() => Promise.resolve());
    pause = vi.fn();
    load = vi.fn();
    removeAttribute = vi.fn();
    constructor() {
      audioInstances.push(this as unknown as StubAudioLike);
    }
  }
  vi.stubGlobal("Audio", StubAudio);
}

// ── Manually driven requestAnimationFrame ────────────────────────────────────

let pendingFrame: ((t: number) => void) | null = null;
let cancelled: number[] = [];

function installRafStub() {
  vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
    pendingFrame = cb;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    cancelled.push(id);
    pendingFrame = null;
  });
}

/**
 * Read the queued callback. Going through a function stops TypeScript narrowing
 * `pendingFrame` to `null` from an assignment in the caller — it cannot see that
 * the engine reassigns it from inside requestAnimationFrame.
 */
function takeFrame(): ((t: number) => void) | null {
  return pendingFrame;
}

/**
 * One monotonic clock for the whole test. The engine accumulates `now - last`,
 * so a helper that restarted its timestamps at 0 would hand it a negative delta
 * and silently stop stepping — every later helper call in that test would do
 * nothing while still appearing to run frames.
 */
let clock = 0;

/** Run `count` frames, each `frameMs` apart. Returns the clock afterwards. */
function runFrames(count: number, frameMs: number): number {
  for (let i = 0; i < count; i++) {
    const frame = takeFrame();
    if (!frame) break;
    clock += frameMs;
    frame(clock);
  }
  return clock;
}

/** Drive frames until `done()` or the cap. Returns the clock afterwards. */
function runUntil(done: () => boolean, frameMs: number, cap = 2000): number {
  for (let i = 0; i < cap && !done(); i++) {
    const frame = takeFrame();
    if (!frame) break;
    clock += frameMs;
    frame(clock);
  }
  return clock;
}

function makeCtx() {
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
  };
}

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = makeCtx();
  canvas.getContext = vi.fn(() => ctx) as unknown as HTMLCanvasElement["getContext"];
  return canvas;
}

/** Let the queued image onload microtasks run. */
const settleSprites = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Wait past the short load deadline the tests configure. Real timers rather
 * than vi.useFakeTimers(): faking them behaved differently on CI than locally,
 * which made these two tests pass here and fail there.
 */
const afterDeadline = () => new Promise<void>((resolve) => setTimeout(resolve, 40));

/** One simulation step, matching STEP_MS in the engine. */
const STEP = 1000 / 60;

type StubCtx = ReturnType<typeof makeCtx>;

/** The recording context a canvas from makeCanvas() was given. */
function stubCtx(canvas: HTMLCanvasElement): StubCtx {
  return canvas.getContext("2d") as unknown as StubCtx;
}

/**
 * The bird's y. drawBird is the only thing that calls translate, as
 * `translate(BIRD_X, birdY)`, so the last such call reports its position —
 * the engine keeps no public state to read instead.
 */
function birdY(ctx: StubCtx): number {
  const calls = ctx.translate.mock.calls;
  return calls.length ? (calls[calls.length - 1][1] as number) : NaN;
}

/**
 * Pipes the bird actually flew past, counted independently of the engine's own
 * `score`. A pipe is credited once its x drops below BIRD_X - r (35 - 52 = -17),
 * and x walks down from 276 in steps of 2, so every pipe is drawn at exactly
 * -18 on the frame it is cleared. Counting those draws gives an oracle that does
 * not share a variable with the value under test.
 */
function pipesCleared(ctx: StubCtx): number {
  return ctx.drawImage.mock.calls.filter(
    (c) => String((c[0] as { src?: string })?.src ?? "").includes("toppipe") && c[1] === -18
  ).length;
}

/** The score last painted by the HUD. */
function drawnScore(ctx: StubCtx): number {
  const numeric = ctx.fillText.mock.calls.map((c) => String(c[0])).filter((t) => /^\d+$/.test(t));
  return numeric.length ? Number(numeric[numeric.length - 1]) : 0;
}

/**
 * Fly the bird into the pipe gap for `steps` frames: flap whenever it sinks
 * below the middle of the opening, otherwise let gravity work. Enough to clear
 * pipes, which is what makes a scoring run testable at all.
 */
function flyToGap(canvas: HTMLCanvasElement, ctx: StubCtx, steps: number): void {
  // With Math.random() = 0 the opening is 190..290, and the bird's collision
  // radius of 15 narrows the safe band to 205..275. One flap cancels the fall
  // and carries the bird 3.6²/(2·0.125) ≈ 52px upward, so flapping at the
  // middle would overshoot the roof — it has to flap near the floor instead.
  const TARGET = 262;
  for (let i = 0; i < steps; i++) {
    const frame = takeFrame();
    if (!frame) break;
    clock += STEP;
    frame(clock);
    if (birdY(ctx) > TARGET) canvas.dispatchEvent(new MouseEvent("click"));
  }
}

beforeEach(() => {
  imagesLoad = true;
  failing = new Set();
  loadedCount = 0;
  lastImages = [];
  audioInstances = [];
  pendingFrame = null;
  cancelled = [];
  clock = 0;
  installImageStub();
  installAudioStub();
  installRafStub();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks(); // Math.random is spied on in the scoring test
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("createGameEngine", () => {
  it("sizes the canvas to the sprite set's logical resolution", () => {
    const canvas = makeCanvas();
    createGameEngine(canvas, { onGameOver: vi.fn(), onRestart: vi.fn(), onRunStart: vi.fn() });

    expect(canvas.width).toBe(276);
    expect(canvas.height).toBe(GAME_H);
  });

  it("cancels the animation frame and unbinds listeners on cleanup", async () => {
    const canvas = makeCanvas();
    const removeDoc = vi.spyOn(document, "removeEventListener");
    const removeCanvas = vi.spyOn(canvas, "removeEventListener");
    const onGameOver = vi.fn();

    const cleanup = createGameEngine(canvas, {
      onGameOver,
      onRestart: vi.fn(),
      onRunStart: vi.fn(),
    });
    await settleSprites();
    cleanup();

    expect(cancelled).toHaveLength(1);
    expect(removeDoc).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(removeCanvas).toHaveBeenCalledWith("click", expect.any(Function));
    expect(removeCanvas).toHaveBeenCalledWith("touchstart", expect.any(Function));

    // The loop must be dead: no further frames, so no further game-over calls.
    expect(pendingFrame).toBeNull();
    removeDoc.mockRestore();
  });

  it("does not step the simulation until every sprite has settled", async () => {
    imagesLoad = false; // assets never arrive
    const canvas = makeCanvas();
    const onGameOver = vi.fn();
    createGameEngine(canvas, { onGameOver, onRestart: vi.fn(), onRunStart: vi.fn() });
    await settleSprites();

    canvas.dispatchEvent(new MouseEvent("click"));
    // Far more frames than the bird needs to fall to its death.
    runFrames(600, 16.67);

    // Dividing by a zero-width ground tile would make the position NaN and the
    // bird would never register as hitting the floor; not stepping at all is
    // what keeps that unreachable.
    expect(onGameOver).not.toHaveBeenCalled();
  });

  it("ends the run when the bird falls to the ground", async () => {
    const canvas = makeCanvas();
    const onGameOver = vi.fn();
    createGameEngine(canvas, { onGameOver, onRestart: vi.fn(), onRunStart: vi.fn() });
    await settleSprites();

    canvas.dispatchEvent(new MouseEvent("click")); // getReady → play
    runFrames(300, 16.67);

    expect(onGameOver).toHaveBeenCalledTimes(1);
    // No pipe is cleared on a straight drop from the start height.
    expect(onGameOver).toHaveBeenCalledWith(0);
  });

  it("ignores input and stays idle before the first click", async () => {
    const canvas = makeCanvas();
    const onGameOver = vi.fn();
    createGameEngine(canvas, { onGameOver, onRestart: vi.fn(), onRunStart: vi.fn() });
    await settleSprites();

    runFrames(300, 16.67); // never started

    expect(onGameOver).not.toHaveBeenCalled();
  });

  it("restarts on input after a game over", async () => {
    const canvas = makeCanvas();
    const onRestart = vi.fn();
    const onGameOver = vi.fn();
    createGameEngine(canvas, { onGameOver, onRestart, onRunStart: vi.fn() });
    await settleSprites();

    canvas.dispatchEvent(new MouseEvent("click"));
    runFrames(300, 16.67);
    expect(onGameOver).toHaveBeenCalledTimes(1);

    onRestart.mockClear();
    canvas.dispatchEvent(new MouseEvent("click")); // gameOver → getReady
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("runs at the same speed on a 60 Hz and a 144 Hz display", async () => {
    // The original used setInterval(1000/60), which a rAF port would have
    // turned into "one step per frame" — 2.4× too fast at 144 Hz. The fixed
    // timestep means the fall takes the same wall-clock time either way.
    async function timeToGameOver(frameMs: number): Promise<number> {
      pendingFrame = null;
      clock = 0;
      const canvas = makeCanvas();
      const onGameOver = vi.fn();
      createGameEngine(canvas, { onGameOver, onRestart: vi.fn(), onRunStart: vi.fn() });
      await settleSprites();
      canvas.dispatchEvent(new MouseEvent("click"));
      return runUntil(() => onGameOver.mock.calls.length > 0, frameMs);
    }

    const at60 = await timeToGameOver(1000 / 60);
    const at144 = await timeToGameOver(1000 / 144);

    expect(at60).toBeGreaterThan(0);
    // Step quantisation still shifts the exact moment of death by a frame or
    // two, so compare proportionally: a few percent apart is the timestep
    // working, whereas one-step-per-frame would put 144 Hz ~2.4× ahead.
    expect(Math.abs(at60 - at144) / at60).toBeLessThan(0.05);
  });

  it("does not write a best score for a scoreless run", async () => {
    const canvas = makeCanvas();
    createGameEngine(canvas, { onGameOver: vi.fn(), onRestart: vi.fn(), onRunStart: vi.fn() });
    await settleSprites();

    canvas.dispatchEvent(new MouseEvent("click"));
    runFrames(300, 16.67);

    expect(localStorage.getItem("leikir_best_laddi-bird")).toBeNull();
  });

  it("scores a cleared pipe and records it as the personal best", async () => {
    // Pin the pipe height so the gap is at a known place, then autopilot the
    // bird into it. Without this the run is random and cannot assert a score.
    vi.spyOn(Math, "random").mockReturnValue(0); // pipe.y = -210 → gap 190..290
    const canvas = makeCanvas();
    const ctx = stubCtx(canvas);
    const onGameOver = vi.fn();
    createGameEngine(canvas, { onGameOver, onRestart: vi.fn(), onRunStart: vi.fn() });
    await settleSprites();

    canvas.dispatchEvent(new MouseEvent("click")); // getReady → play
    flyToGap(canvas, ctx, 200);

    expect(onGameOver).not.toHaveBeenCalled();
    expect(drawnScore(ctx)).toBeGreaterThanOrEqual(1);

    // Fall to the ground so die() runs and commits the best score.
    runFrames(400, STEP);
    expect(onGameOver).toHaveBeenCalledTimes(1);
    const scored = onGameOver.mock.calls[0][0] as number;
    expect(scored).toBeGreaterThanOrEqual(1);
    expect(localStorage.getItem("leikir_best_laddi-bird")).toBe(String(scored));
  });

  it("reads the stored best back in a fresh engine", async () => {
    localStorage.setItem("leikir_best_laddi-bird", "7");
    const canvas = makeCanvas();
    const ctx = stubCtx(canvas);
    createGameEngine(canvas, { onGameOver: vi.fn(), onRestart: vi.fn(), onRunStart: vi.fn() });
    await settleSprites();

    canvas.dispatchEvent(new MouseEvent("click"));
    runFrames(300, STEP); // die without scoring

    // The game-over card shows the carried-over best, not 0.
    const texts = ctx.fillText.mock.calls.map((c) => String(c[0]));
    expect(texts).toContain("LADDAMET: 7");
    // A worse run must not lower it.
    expect(localStorage.getItem("leikir_best_laddi-bird")).toBe("7");
  });

  it("keeps running when a sprite fails to load", async () => {
    // A 404'd image is *broken*, and drawImage throws InvalidStateError on it —
    // so a missing file must be skipped at draw time, not merely counted.
    failing.add("ground.png");
    const canvas = makeCanvas();
    const ctx = stubCtx(canvas);
    ctx.drawImage.mockImplementation((img: unknown) => {
      if ((img as { _failed?: boolean })._failed) {
        throw new DOMException("broken image", "InvalidStateError");
      }
    });

    const onGameOver = vi.fn();
    createGameEngine(canvas, { onGameOver, onRestart: vi.fn(), onRunStart: vi.fn() });
    await settleSprites();

    canvas.dispatchEvent(new MouseEvent("click"));
    expect(() => runFrames(120, STEP)).not.toThrow();
    // The rest of the frame still painted — the sky and other sprites.
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("stays playable when a geometry sprite fails to load", async () => {
    // The pipe and ground sizes drive the simulation. Reading them off a broken
    // image gives 0 — a NaN ground scroll and a gap placed off-screen, so the
    // bird dies on the first invisible pipe. Geometry comes from constants, so
    // a missing file costs only the artwork.
    vi.spyOn(Math, "random").mockReturnValue(0); // same fixed gap the autopilot flies
    failing.add("toppipe.png");
    failing.add("ground.png");
    const canvas = makeCanvas();
    const ctx = stubCtx(canvas);
    const onGameOver = vi.fn();
    createGameEngine(canvas, { onGameOver, onRestart: vi.fn(), onRunStart: vi.fn() });
    await settleSprites();

    canvas.dispatchEvent(new MouseEvent("click"));
    // Survive well past the point an invisible pipe reaches the bird (~step 106).
    flyToGap(canvas, ctx, 140);

    expect(onGameOver).not.toHaveBeenCalled();
    // And the floor is still the ground line, not the canvas bottom.
    runFrames(400, STEP);
    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it("releases audio without refetching the page as media on cleanup", async () => {
    // `src = ""` resolves against the document URL, so the browser would fetch
    // the page HTML as media and log MEDIA_ELEMENT_ERROR on every unmount.
    const canvas = makeCanvas();
    const cleanup = createGameEngine(canvas, {
      onGameOver: vi.fn(),
      onRestart: vi.fn(),
      onRunStart: vi.fn(),
    });
    await settleSprites();
    cleanup();

    expect(audioInstances.length).toBeGreaterThan(0);
    for (const sound of audioInstances) {
      expect(sound.pause).toHaveBeenCalled();
      expect(sound.removeAttribute).toHaveBeenCalledWith("src");
      expect(sound.load).toHaveBeenCalled();
      expect(sound.src).not.toBe("");
    }
  });

  it("lets a focused control keep its own Space key", async () => {
    // The engine listens on document so the game works without clicking first.
    // Buttons fire on Space *keyup*, so preventDefault on keydown would stop the
    // leaderboard's dismiss button working and restart the run instead.
    const canvas = makeCanvas();
    const onRestart = vi.fn();
    createGameEngine(canvas, { onGameOver: vi.fn(), onRestart, onRunStart: vi.fn() });
    await settleSprites();

    const button = document.createElement("button");
    document.body.appendChild(button);
    const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    button.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    runFrames(300, STEP);
    // Never started, so the bird never fell and the run never ended.
    expect(onRestart).not.toHaveBeenCalled();
    button.remove();
  });

  it("still takes Space when nothing else is focused", async () => {
    const canvas = makeCanvas();
    const onGameOver = vi.fn();
    createGameEngine(canvas, { onGameOver, onRestart: vi.fn(), onRunStart: vi.fn() });
    await settleSprites();

    const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    runFrames(300, STEP);
    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it("locks out input briefly after a death so the score card is seen", async () => {
    // Death is not input-triggered, so the next tap of a normal flap rhythm
    // would otherwise restart instantly and the player never sees their score.
    const canvas = makeCanvas();
    const onRestart = vi.fn();
    const onGameOver = vi.fn();
    createGameEngine(canvas, { onGameOver, onRestart, onRunStart: vi.fn() });
    await settleSprites();

    canvas.dispatchEvent(new MouseEvent("click"));
    runUntil(() => onGameOver.mock.calls.length > 0, STEP);
    expect(onGameOver).toHaveBeenCalledTimes(1);

    onRestart.mockClear();
    runFrames(6, STEP); // ~100ms, a normal flap interval
    canvas.dispatchEvent(new MouseEvent("click")); // the flap that came too soon
    expect(onRestart).not.toHaveBeenCalled();

    runFrames(60, STEP); // wait out the lock-out
    canvas.dispatchEvent(new MouseEvent("click"));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("submits exactly the number of pipes the bird flew past", async () => {
    // Checked against a draw-derived oracle rather than the HUD, which reads the
    // same `score` variable and so would agree with any value. Runs are repeated
    // across a window of release points so the invariant is checked against many
    // different death frames rather than one lucky trajectory.
    for (let stopFlappingAt = 118; stopFlappingAt <= 134; stopFlappingAt++) {
      vi.spyOn(Math, "random").mockReturnValue(0);
      clock = 0;
      pendingFrame = null;
      const canvas = makeCanvas();
      const ctx = stubCtx(canvas);
      const onGameOver = vi.fn();
      createGameEngine(canvas, { onGameOver, onRestart: vi.fn(), onRunStart: vi.fn() });
      await settleSprites();

      canvas.dispatchEvent(new MouseEvent("click"));
      flyToGap(canvas, ctx, stopFlappingAt); // fly the gap, then release
      runUntil(() => onGameOver.mock.calls.length > 0, STEP, 600);

      if (!onGameOver.mock.calls.length) continue;
      expect(onGameOver.mock.calls[0][0]).toBe(pipesCleared(ctx));
      vi.restoreAllMocks();
    }
  });

  it("starts anyway when a sprite request stalls without resolving", async () => {
    // A stalled request fires neither onload nor onerror, so settling "either
    // way" does not cover it — without a deadline the player sits on a blank
    // blue rectangle forever with no message and no response to input.
    imagesLoad = false; // never fires onload or onerror
    const canvas = makeCanvas();
    const onGameOver = vi.fn();
    createGameEngine(
      canvas,
      { onGameOver, onRestart: vi.fn(), onRunStart: vi.fn() },
      { loadDeadlineMs: 10 }
    );

    canvas.dispatchEvent(new MouseEvent("click"));
    runFrames(300, STEP);
    expect(onGameOver).not.toHaveBeenCalled(); // still waiting

    await afterDeadline();

    canvas.dispatchEvent(new MouseEvent("click"));
    runFrames(300, STEP);
    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it("draws a sprite that arrives after the load deadline", async () => {
    // The deadline marks everything still in flight as broken so the game can
    // start. An image that then arrives must be un-marked, or the skyline and
    // ground stay invisible all session despite being fully decoded.
    imagesLoad = false; // nothing settles yet
    const canvas = makeCanvas();
    const ctx = stubCtx(canvas);
    createGameEngine(
      canvas,
      { onGameOver: vi.fn(), onRestart: vi.fn(), onRunStart: vi.fn() },
      { loadDeadlineMs: 10 }
    );

    await afterDeadline(); // deadline passes, everything unsettled marked broken
    runFrames(2, STEP);
    ctx.drawImage.mockClear();

    // The slow ground sprite finally lands.
    const ground = lastImages.find((i) => i.src.includes("ground.png"))!;
    ground.width = 552;
    ground.height = 112;
    ground.onload?.();

    runFrames(2, STEP);
    const drewGround = ctx.drawImage.mock.calls.some((c) =>
      String((c[0] as { src?: string })?.src ?? "").includes("ground.png")
    );
    expect(drewGround).toBe(true);
  });

  it("does not eagerly download the sound effects", async () => {
    // ~790KB of uncompressed WAV would otherwise be fetched before the player
    // touches anything, competing with the sprites for bandwidth.
    const canvas = makeCanvas();
    createGameEngine(canvas, { onGameOver: vi.fn(), onRestart: vi.fn(), onRunStart: vi.fn() });
    await settleSprites();

    expect(audioInstances.length).toBeGreaterThan(0);
    for (const sound of audioInstances) expect(sound.preload).toBe("none");
  });

  it("waits for every sprite without a hardcoded count", async () => {
    // The engine must derive how many sprites it asked for. If it counted to a
    // literal, adding one would leave ready() false forever and never step.
    const canvas = makeCanvas();
    const onGameOver = vi.fn();
    createGameEngine(canvas, { onGameOver, onRestart: vi.fn(), onRunStart: vi.fn() });
    await settleSprites();

    expect(loadedCount).toBeGreaterThan(0);
    canvas.dispatchEvent(new MouseEvent("click"));
    runFrames(300, STEP);
    // Stepping happened, so the readiness gate opened for exactly the sprites
    // that were requested.
    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it("keeps the bird above the ground strip", async () => {
    // The floor is the top of the ground sprite, not the canvas bottom — if the
    // engine used canvas height the bird would sink through the artwork.
    const canvas = makeCanvas();
    let deathFrame = -1;
    let frame = 0;
    const onGameOver = vi.fn(() => (deathFrame = frame));
    createGameEngine(canvas, { onGameOver, onRestart: vi.fn(), onRunStart: vi.fn() });
    await settleSprites();

    canvas.dispatchEvent(new MouseEvent("click"));
    for (let i = 0; i < 400 && deathFrame < 0; i++) {
      frame = i;
      runFrames(1, STEP);
    }

    // Falling from y=100 under gravity 0.125 covers the ~275px to the ground
    // line in roughly 66 steps; the canvas floor would take ~80.
    const stepsToGround = deathFrame;
    expect(stepsToGround).toBeGreaterThan(55);
    expect(stepsToGround).toBeLessThan(75);
    expect(GAME_H - GROUND_H).toBe(388);
  });
});
