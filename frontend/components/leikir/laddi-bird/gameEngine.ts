/* token-check-ignore-file: every colour here is a canvas fill, and a 2D
   context cannot read CSS custom properties. */
/**
 * Laddí-bird game engine.
 *
 * A pure factory function: call createGameEngine(canvas, callbacks) to start
 * the game. The returned function cancels the animation frame, stops audio and
 * removes every event listener — pass it directly as the useEffect cleanup.
 *
 * Ported from the original Skátaþing 2023 JavaScript build. Four things changed
 * in the port, each of which was a real defect rather than a style preference:
 *
 *  - The loop was `setInterval(…, 1000/60)` with no cleanup, so it kept running
 *    after unmount and ran twice under React StrictMode. It is now rAF with a
 *    fixed-timestep accumulator, which also stops the game running at 2.4×
 *    speed on a 144 Hz display.
 *  - The canvas was sized from `window.innerWidth/innerHeight`, so the playfield
 *    changed shape per device and pipe spacing became trivial on a wide screen.
 *    It is now a fixed logical resolution that CSS scales.
 *  - Sprite paths were relative (`img/…`) and the background and ground were
 *    commented out entirely. They are namespaced under /leikir/laddi-bird/ and
 *    both layers are drawn.
 *  - `localStorage` was touched directly inside a try/catch; it now goes through
 *    safeLocalStorage like the rest of the app.
 */

import { safeLocalStorage } from "@/lib/safe-storage";
import { createSfx } from "./sfx";

// ── Types ────────────────────────────────────────────────────────────────────

interface Pipe {
  x: number;
  /** Top-pipe y. Negative — the sprite hangs off the top of the canvas. */
  y: number;
  /** Whether this pipe has already been scored. */
  passed: boolean;
}

export interface GameCallbacks {
  onGameOver: (score: number) => void;
  onRestart: () => void;
  /** Fired when a run actually begins, so the server can stamp its start. */
  onRunStart: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Logical playfield. Matches the sprite set (BG and ground tiles are 276 wide). */
const GAME_W = 276;
const GAME_H = 500;

const ASSETS = "/leikir/laddi-bird";

const GRAVITY = 0.125;
const THRUST = 3.6;
const SCROLL_SPEED = 2;
const PIPE_GAP = 100;
const PIPE_INTERVAL = 100; // frames between spawns
const BIRD_X = 50;
const BIRD_START_Y = 100;
const BIRD_W = 34;
const BIRD_H = 26;

/**
 * Sprite geometry, as constants rather than `img.width/height`.
 *
 * A sprite that 404s is *settled* but has zero dimensions, and reading those
 * back into the simulation is not a cosmetic problem: `groundX % (0/2)` is NaN
 * forever, and a zero-height pipe puts its gap off-screen so the bird dies the
 * instant an invisible pipe reaches it. Fixed assets have fixed sizes, so the
 * simulation uses these and a missing file costs only the artwork — which is
 * what `drawSprite`'s broken-image skip is meant to guarantee.
 */
const PIPE_W = 52;
const PIPE_H = 400;
/** Two 276-wide tiles, so the scroll wraps at half the width. */
const GROUND_W = 552;
const GROUND_H = 112;
const BG_H = 228;
const GETREADY_W = 174;
const GETREADY_H = 160;
const GAMEOVER_W = 188;
const GAMEOVER_H = 144;
const TAP_W = 118;
const TAP_H = 36;

const BEST_SCORE_KEY = "leikir_best_laddi-bird";
const SKY = "#30c0df";
const RAD = Math.PI / 180;

/** One simulation step, in ms. The original ran on a 60 Hz interval. */
const STEP_MS = 1000 / 60;
/**
 * A frame this close to one step counts as exactly one step. rAF timestamps on
 * a 60 Hz phone wander by a millisecond or so, and with the accumulator sitting
 * right at the boundary that turns "one step per frame" into a run of 0s and 2s
 * — the playfield visibly stutters even though the frame rate is fine.
 */
const STEP_SNAP_MS = 1;
/** Never simulate more than this per frame, so a backgrounded tab cannot
 *  return and run thousands of catch-up steps in one blocking burst. */
const MAX_STEPS_PER_FRAME = 5;
/** How long to wait for sprites before starting without the ones that stalled. */
const LOAD_DEADLINE_MS = 5000;
/** Input is ignored for this long after a death, so the score card is seen. */
const RESTART_LOCK_FRAMES = 40;

const SCORE_TEXT = "STIG: ";
const BEST_TEXT = "LADDAMET: ";

type Phase = "getReady" | "play" | "gameOver";

// ── Asset helpers ────────────────────────────────────────────────────────────

function loadImage(
  path: string,
  onSettled: (img: HTMLImageElement, ok: boolean) => void
): HTMLImageElement {
  const img = new Image();
  // Settle either way, so one missing file cannot leave the game waiting on a
  // load that will never come. Failures are recorded rather than merely counted:
  // drawImage throws InvalidStateError on a *broken* image, so a 404'd sprite
  // has to be skipped at draw time, not just tolerated at load time.
  img.onload = () => onSettled(img, true);
  img.onerror = () => onSettled(img, false);
  img.src = `${ASSETS}/${path}`;
  return img;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export interface GameOptions {
  /**
   * Override the sprite-load deadline, in ms.
   *
   * A seam for tests: the deadline is the one behaviour here that only happens
   * after several seconds, and driving it with fake timers proved to behave
   * differently between local runs and CI. A short real deadline is
   * deterministic everywhere.
   */
  loadDeadlineMs?: number;
}

export function createGameEngine(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
  options: GameOptions = {}
): () => void {
  // Opaque: the sky fill covers every pixel each frame, and an opaque canvas
  // spares the compositor blending it against the page on every frame.
  const ctx = canvas.getContext("2d", { alpha: false })!;
  canvas.width = GAME_W;
  canvas.height = GAME_H;

  // ── Sprites ───────────────────────────────────────────────────────────────
  // The loop paints but does not step until every sprite has settled, so a run
  // cannot begin on an empty screen. Geometry comes from the constants above
  // rather than from these images, so a sprite that fails costs only its art.
  //
  // The expected count is derived from the calls below rather than written out,
  // so adding a sprite cannot leave the game stuck on a blank canvas forever.
  const requested: HTMLImageElement[] = [];
  const settled = new Set<HTMLImageElement>();
  const broken = new Set<HTMLImageElement>();
  let loadDeadlinePassed = false;

  const image = (path: string) => {
    const img = loadImage(path, (loaded, ok) => {
      settled.add(loaded);
      // Un-mark as well as mark: the load deadline below marks everything still
      // in flight as broken, and an image that then arrives a moment later would
      // otherwise stay invisible for the whole session despite being decoded.
      if (ok) broken.delete(loaded);
      else broken.add(loaded);
    });
    requested.push(img);
    return img;
  };

  const sprites = {
    bg: image("img/BG.png"),
    ground: image("img/ground.png"),
    pipeTop: image("img/toppipe.png"),
    pipeBot: image("img/botpipe.png"),
    getReady: image("img/getready.png"),
    gameOver: image("img/go.png"),
    tap: [image("img/tap/t0.png"), image("img/tap/t1.png")],
    // Laddi with the skátar cap — the custom Skátaþing 2023 sprite that
    // replaces Flappy Bird's yellow bird. A single frame, as in the original:
    // the artwork is a photo cutout, not a wing-flap cycle.
    bird: image("img/bird/laddi.png"),
  };

  // A request that *stalls* fires neither onload nor onerror — a dropped
  // connection or a hung CDN. Settling "either way" does not cover that, so
  // without a deadline the player would sit on a blank blue rectangle forever
  // with no message and no response to input. Past the deadline, whatever has
  // not arrived counts as broken and the game starts without it.
  const loadTimer = setTimeout(() => {
    loadDeadlinePassed = true;
    for (const img of requested) if (!settled.has(img)) broken.add(img);
  }, options.loadDeadlineMs ?? LOAD_DEADLINE_MS);

  const ready = () => loadDeadlinePassed || settled.size >= requested.length;

  /**
   * drawImage on an image that failed to load throws InvalidStateError, which
   * would abort the rest of the frame — every frame — and take the bird, the
   * ground and the score down with the one missing file. Skipping the broken
   * sprite leaves a gap in the art and keeps the game running.
   */
  function drawSprite(img: HTMLImageElement, x: number, y: number, w?: number, h?: number): void {
    if (broken.has(img)) return;
    if (w !== undefined && h !== undefined) ctx.drawImage(img, x, y, w, h);
    else ctx.drawImage(img, x, y);
  }

  const sfx = createSfx({
    start: `${ASSETS}/sfx/start.wav`,
    flap: `${ASSETS}/sfx/flap.wav`,
    score: `${ASSETS}/sfx/score.wav`,
    hit: `${ASSETS}/sfx/hit.wav`,
    die: `${ASSETS}/sfx/die.wav`,
  });

  // ── Mutable game state ────────────────────────────────────────────────────
  let phase: Phase = "getReady";
  let frames = 0;
  let score = 0;
  let best = readBest();
  let diePlayed = false;

  let birdY = BIRD_START_Y;
  let birdSpeed = 0;
  let birdRotation = 0;

  let pipes: Pipe[] = [];
  let groundX = 0;
  let uiFrame = 0;

  /** Frame at which input may restart the run again. See die(). */
  let restartUnlockFrame = 0;

  let rafId = 0;
  let lastTime = 0;
  let accumulator = 0;

  function readBest(): number {
    const stored = Number(safeLocalStorage.getItem(BEST_SCORE_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }

  /** y of the top of the ground strip — the floor the bird dies on. */
  function groundY(): number {
    return GAME_H - GROUND_H;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  function reset(): void {
    phase = "getReady";
    score = 0;
    birdY = BIRD_START_Y;
    birdSpeed = 0;
    birdRotation = 0;
    pipes = [];
    diePlayed = false;
    callbacks.onRestart();
  }

  function start(): void {
    phase = "play";
    callbacks.onRunStart();
    sfx.play("start");
  }

  function flap(): void {
    if (birdY <= 0) return;
    sfx.play("flap");
    birdSpeed = -THRUST;
  }

  function die(): void {
    phase = "gameOver";
    // Death is not input-triggered, so without this the next tap of a normal
    // flap rhythm restarts instantly and the player never sees their score.
    restartUnlockFrame = frames + RESTART_LOCK_FRAMES;
    if (score > best) {
      best = score;
      safeLocalStorage.setItem(BEST_SCORE_KEY, String(best));
    }
    callbacks.onGameOver(score);
  }

  /** One input event — click, tap or key. Meaning depends on the phase. */
  function onInput(): void {
    // Every input is a user gesture, which is the only place audio may start.
    sfx.unlock();
    if (!ready()) return; // nothing to fly through yet
    switch (phase) {
      case "getReady":
        start();
        break;
      case "play":
        flap();
        break;
      case "gameOver":
        if (frames >= restartUnlockFrame) reset();
        break;
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────

  function updatePipes(): void {
    if (phase !== "play") return;

    if (frames % PIPE_INTERVAL === 0) {
      // Negative y hangs the top pipe off-screen; the visible opening lands
      // between roughly a fifth and a half of the way down the playfield.
      //
      // Scaled, not clamped. The original `Math.min(Math.random() + 1, 1.8)`
      // drew from [1, 2) and flattened everything above 1.8 onto it, so a fifth
      // of all pipes were the single tightest ceiling-hugging gap rather than
      // one point in a spread.
      pipes.push({ x: GAME_W, y: -210 * (1 + Math.random() * 0.8), passed: false });
    }

    for (const p of pipes) p.x -= SCROLL_SPEED;

    if (pipes.length && pipes[0].x < -PIPE_W) pipes.shift();
  }

  function updateGround(): void {
    if (phase !== "play") return;
    // The strip is two tiles wide, so wrapping at half its width is seamless.
    groundX = (groundX - SCROLL_SPEED) % (GROUND_W / 2);
  }

  /** True if the bird overlaps a pipe. Also credits the pipe once cleared. */
  function collided(): boolean {
    const r = BIRD_W / 4 + BIRD_H / 4;

    for (const p of pipes) {
      const w = PIPE_W;
      const roof = p.y + PIPE_H;
      const floor = roof + PIPE_GAP;

      const overlapsX = BIRD_X + r >= p.x && BIRD_X - r <= p.x + w;
      if (overlapsX && (birdY - r <= roof || birdY + r >= floor)) {
        sfx.play("hit");
        return true;
      }

      if (!p.passed && BIRD_X - r > p.x + w) {
        p.passed = true;
        score++;
        sfx.play("score");
      }
    }
    return false;
  }

  function updateBird(): void {
    const r = BIRD_H / 2;

    switch (phase) {
      case "getReady":
        // Idle bob while waiting for the first input.
        birdRotation = 0;
        birdY += frames % 10 === 0 ? Math.sin(frames * RAD) : 0;
        break;

      case "play":
        birdY += birdSpeed;
        birdSpeed += GRAVITY;
        setRotation();
        // collided() is not a pure predicate — it also credits cleared pipes.
        // Calling it before the ground test stops `||` short-circuiting away a
        // point the player genuinely flew through on their dying frame.
        const hitPipe = collided();
        if (hitPipe || birdY + r >= groundY()) die();
        break;

      case "gameOver":
        // Keep falling until the bird hits the ground, then lie there.
        if (birdY + r < groundY()) {
          birdY += birdSpeed;
          birdSpeed += GRAVITY * 2;
          setRotation();
        } else {
          birdSpeed = 0;
          birdY = groundY() - r;
          birdRotation = 90;
          if (!diePlayed) {
            sfx.play("die");
            diePlayed = true;
          }
        }
        break;
    }
  }

  function setRotation(): void {
    birdRotation =
      birdSpeed <= 0
        ? Math.max(-25, (-25 * birdSpeed) / -THRUST)
        : Math.min(90, (90 * birdSpeed) / (THRUST * 2));
  }

  function updateUI(): void {
    if (phase === "play") return;
    uiFrame += frames % 10 === 0 ? 1 : 0;
    uiFrame %= sprites.tap.length;
  }

  function update(): void {
    updateBird();
    updateGround();
    updatePipes();
    updateUI();
    frames++;
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  function drawBackground(): void {
    ctx.fillStyle = SKY;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    // Skyline is bottom-aligned; the sky fill shows above it.
    drawSprite(sprites.bg, 0, GAME_H - BG_H);
  }

  /** How far the playfield scrolls in `alpha` of a step. */
  function scrollAhead(alpha: number): number {
    return phase === "play" ? SCROLL_SPEED * alpha : 0;
  }

  function drawPipes(alpha: number): void {
    const ahead = scrollAhead(alpha);
    for (const p of pipes) {
      drawSprite(sprites.pipeTop, p.x - ahead, p.y);
      drawSprite(sprites.pipeBot, p.x - ahead, p.y + PIPE_H + PIPE_GAP);
    }
  }

  function drawGround(alpha: number): void {
    // Two tiles so the wrap point is always off-screen. The look-ahead can carry
    // it just past a tile, so wrap again rather than show a sliver of sky.
    let x = groundX - scrollAhead(alpha);
    if (x <= -GROUND_W / 2) x += GROUND_W / 2;
    drawSprite(sprites.ground, x, groundY());
  }

  function drawBird(alpha: number): void {
    // birdSpeed is exactly what the next step adds to birdY, so this is where
    // the bird will be — clamped so it never sinks into the ground art.
    const y =
      phase === "getReady" ? birdY : Math.min(birdY + birdSpeed * alpha, groundY() - BIRD_H / 2);
    ctx.save();
    ctx.translate(BIRD_X, y);
    ctx.rotate(birdRotation * RAD);
    drawSprite(sprites.bird, -BIRD_W / 2, -BIRD_H / 2, BIRD_W, BIRD_H);
    ctx.restore();
  }

  /**
   * Centre an overlay card and hang the tap prompt off its bottom edge. Sized
   * from constants for the same reason the simulation is: a card that failed to
   * load reports height 0, which would stack the prompt 144px too high, on top
   * of the bird.
   */
  function drawCentred(sprite: HTMLImageElement, w: number, h: number): void {
    const y = (GAME_H - h) / 2;
    drawSprite(sprite, (GAME_W - w) / 2, y);
    drawSprite(sprites.tap[uiFrame], (GAME_W - TAP_W) / 2, y + h - TAP_H);
  }

  function drawScore(): void {
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;

    if (phase === "play") {
      ctx.font = "35px Verdana";
      ctx.textAlign = "center";
      ctx.strokeText(String(score), GAME_W / 2, 50);
      ctx.fillText(String(score), GAME_W / 2, 50);
      return;
    }

    if (phase === "gameOver") {
      ctx.font = "20px Verdana";
      ctx.textAlign = "center";
      // Start below the game-over card. The card is centred and 144 tall, and
      // the tap prompt sits along its bottom edge — anchoring to the card's
      // foot keeps the two score lines off the prompt instead of over it.
      const cardBottom = (GAME_H + GAMEOVER_H) / 2;
      const lines = [SCORE_TEXT + score, BEST_TEXT + best];
      lines.forEach((line, i) => {
        const y = cardBottom + 18 + i * 28;
        ctx.strokeText(line, GAME_W / 2, y);
        ctx.fillText(line, GAME_W / 2, y);
      });
    }
  }

  /**
   * Paint the frame. `alpha` is how far, as a fraction of a step, real time has
   * run past the last simulated step.
   *
   * The simulation is fixed at 60 Hz but a phone may refresh at 90 or 120 Hz,
   * where some frames get no step at all. Drawing only the last step would hold
   * the pipes still on those frames and then jump them — steady judder at a
   * perfectly healthy frame rate. Moving things by their known per-step motion
   * times alpha keeps the scroll even, and because it looks ahead rather than
   * interpolating back from the previous step, it adds no input latency.
   */
  function draw(alpha: number): void {
    drawBackground();
    drawPipes(alpha);
    drawBird(alpha);
    drawGround(alpha);

    if (phase === "getReady") drawCentred(sprites.getReady, GETREADY_W, GETREADY_H);
    if (phase === "gameOver") drawCentred(sprites.gameOver, GAMEOVER_W, GAMEOVER_H);
    drawScore();
  }

  // ── Loop ──────────────────────────────────────────────────────────────────

  function loop(now: number): void {
    rafId = requestAnimationFrame(loop);

    if (!ready()) {
      ctx.fillStyle = SKY;
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      return;
    }
    // Only once the sprites are in, so the sounds never compete with them.
    sfx.preload();

    if (!lastTime) lastTime = now;
    let delta = now - lastTime;
    lastTime = now;
    if (Math.abs(delta - STEP_MS) < STEP_SNAP_MS) delta = STEP_MS;
    accumulator += delta;

    let steps = 0;
    while (accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      update();
      accumulator -= STEP_MS;
      steps++;
    }
    // Drop the rest of the backlog instead of carrying it into the next frame.
    if (accumulator > STEP_MS) accumulator = 0;

    draw(accumulator / STEP_MS);
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  /**
   * The listener is on `document` so the game is playable without first
   * clicking the canvas — but that means it also sees keys aimed at real
   * controls. A button is activated by Space on *keyup*, so swallowing Space
   * here would stop the leaderboard's dismiss button from working and restart
   * the run instead. Anything focusable that is not the canvas keeps its keys.
   */
  function handlesItsOwnKeys(target: EventTarget | null): boolean {
    if (!(target instanceof Element) || target === canvas) return false;
    return target.closest("a[href], button, input, select, textarea, [tabindex]") !== null;
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key !== " " && e.key !== "ArrowUp" && e.key !== "w" && e.key !== "W") return;
    if (handlesItsOwnKeys(e.target)) return;
    e.preventDefault();
    onInput();
  }

  function onPointerDown(e: Event): void {
    e.preventDefault();
    onInput();
  }

  canvas.addEventListener("click", onPointerDown);
  canvas.addEventListener("touchstart", onPointerDown, { passive: false });
  document.addEventListener("keydown", onKeyDown);

  rafId = requestAnimationFrame(loop);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  return () => {
    cancelAnimationFrame(rafId);
    clearTimeout(loadTimer);
    canvas.removeEventListener("click", onPointerDown);
    canvas.removeEventListener("touchstart", onPointerDown);
    document.removeEventListener("keydown", onKeyDown);
    // A sound mid-playback would otherwise outlive the page.
    sfx.dispose();
  };
}
