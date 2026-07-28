// Arnór-Clicker — assist Arnór, the fundarstjóri, in running a Skátaþing.
// Idle clicker: tap Arnór's face for fundarstig, recruit Fundarsköp workers
// (which orbit him as a place-value odometer), buy upgrades, ride golden Arnórs,
// and "fresta þingfundi" to prestige for Þingstig. Leaderboard = Þingstig held.
// Arcade visual identity per docs/design/arnor-clicker (approved hi-fi).

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Image from "next/image";
import { useUser } from "@auth0/nextjs-auth0";
import type { ScoreEntry } from "@/lib/leikir-games";
import OrbitField from "./OrbitField";
import { WorkerIcon } from "./icons";
import {
  WORKERS,
  UPGRADES,
  CHAIRS,
  DEFAULT_CHAIR,
  chairByKey,
  costOf,
  fmt,
  scoreParts,
  thingstigFor,
  baseRateOf,
  clickPower,
  loadSave,
  SCORE_CAP,
  signSave,
  offlineSeconds,
  OFFLINE_RATE,
  upgradeUnlocked,
  upgradeEffect,
  totalWorkers,
  liveBuff,
  buffFromGolden,
  lumpSeconds,
  pickGolden,
  goldenTuning,
  comboParams,
  comboMult,
  NO_BUFF,
  GOLDEN_EVERY_MIN_S,
  GOLDEN_EVERY_MAX_S,
  GOLDEN_ON_SCREEN_MS,
  prestigeBonusPct,
  prestigeBonusGainPct,
  type Buff,
  type Chair,
  type GoldenVariant,
  type LoadedSave,
  type SaveState,
  type Upgrade,
  type Vars,
} from "./gameData";
import { safeLocalStorage, safeSessionStorage } from "@/lib/safe-storage";
import styles from "./arnorClicker.module.css";

const GAME = "arnor-clicker";
const SCORES_URL = `/api/leikir/${GAME}/scores`;
const PENDING_KEY = `leikir_pending_score_${GAME}`;
const SAVE_KEY = "arnor_clicker_save_v2"; // v2: 20-worker roster (old saves mis-map)
// Golden Arnórar stay gated until the player has real production going — no
// boosts in the opening clicks. First eligible once lifetime fundarstig this
// run crosses this threshold.
const GOLDEN_UNLOCK = 10_000;
// Arnór is both the starting fundarstjóri and the stand-in portrait for any
// chair whose own image is missing — one record, so the path lives in one place.
const ARNOR = chairByKey(DEFAULT_CHAIR);

const QTYS = [1, 5, 10, 25, 100];
const TABS = [
  { id: "fundarskop", label: "Fundarsköp", accent: "var(--sl-color-primary)" },
  { id: "uppfaerslur", label: "Uppfærslur", accent: "var(--sl-color-patrol-rekkar)" },
  { id: "thing", label: "Þing", accent: "var(--sl-color-patrol-drekar)" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/**
 * The server's wall clock in ms, taken from the `Date` header of a request the
 * game already makes. Used to settle away-time so that winding the device
 * clock forward doesn't mint offline earnings.
 *
 * Falls back to the device clock when the server can't be reached. That's an
 * accepted gap: a player with no network can inflate their local bank, but
 * they cannot submit a score without coming back online, and this runs again
 * when they do.
 */
async function serverNow(): Promise<number> {
  try {
    const res = await fetch(SCORES_URL, { method: "HEAD", cache: "no-store" });
    const stamped = Date.parse(res.headers.get("date") ?? "");
    if (Number.isFinite(stamped)) return stamped;
  } catch {
    /* offline — fall through to the device clock */
  }
  return Date.now();
}

/** A golden Arnór on screen: which variant, and where it crosses the stage. */
interface GoldenOnStage {
  id: number;
  top: number;
  v: GoldenVariant;
}

export default function ArnorClickerGame() {
  const { user } = useUser();

  const [counts, setCounts] = useState<number[]>(() => WORKERS.map(() => 0));
  const [ups, setUps] = useState<Set<string>>(() => new Set());
  const [scoreView, setScoreView] = useState(0);
  // Lifetime fundarstig this run, mirrored into state so the upgrade shop can
  // gate on it. The 120ms sync tick keeps it fresh.
  const [runView, setRunView] = useState(0);
  const [rateView, setRateView] = useState(0);
  const [tsCur, setTsCur] = useState(0);
  const [tsTot, setTsTot] = useState(0);
  const [things, setThings] = useState(0);
  const [buyQty, setBuyQty] = useState(1);
  const [tab, setTab] = useState<TabId>("fundarskop");
  const [muted, setMuted] = useState(false);
  const [tapped, setTapped] = useState(false);
  const [golden, setGolden] = useState<GoldenOnStage | null>(null);
  const [buff, setBuff] = useState<Buff>(NO_BUFF);
  const [buffLeft, setBuffLeft] = useState(0);
  const [combo, setCombo] = useState(0);
  // Short-lived toast naming the golden Arnór you just caught — with seven
  // variants, "which one was that?" needs an answer on screen.
  const [lastGolden, setLastGolden] = useState<{ name: string; text: string } | null>(null);
  const [chairs, setChairs] = useState<Set<string>>(() => new Set([DEFAULT_CHAIR]));
  const [chairKey, setChairKey] = useState(DEFAULT_CHAIR);
  // Chairs whose portrait file isn't in /public yet. They fall back to Arnór's
  // sprite, hue-shifted, so each still reads as their own person.
  const [badPortraits, setBadPortraits] = useState<Set<string>>(() => new Set());
  const [offline, setOffline] = useState<number | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loginHref, setLoginHref] = useState<string | null>(null);
  const [submitFailed, setSubmitFailed] = useState(false);

  // Refs mirror state for the animation loop (no stale closures, no re-subscribe).
  const scoreRef = useRef(0);
  const runRef = useRef(0);
  const countsRef = useRef(counts);
  const upsRef = useRef(ups);
  const tsCurRef = useRef(0);
  const tsTotRef = useRef(0);
  const thingsRef = useRef(0);
  const buffRef = useRef<Buff>(NO_BUFF);
  const chairsRef = useRef(chairs);
  const chairKeyRef = useRef(chairKey);
  // Samfella (Aron): current combo and the timestamp of the last click, so the
  // display tick can drop the combo once the window has lapsed.
  const comboRef = useRef(0);
  const lastClickRef = useRef(0);
  const mutedRef = useRef(false);
  // ms to add to the device clock to get the server's. Stays 0 until a request
  // comes back, and is refreshed on every leaderboard poll.
  const clockSkewRef = useRef(0);
  const loadedRef = useRef(false);
  const acRef = useRef<AudioContext | null>(null);
  // True once the audio context has been closed on unmount, so a blip scheduled
  // just before unmount (e.g. claimGolden's delayed buzz) can't resurrect it.
  const audioClosedRef = useRef(false);
  const popLayer = useRef<HTMLDivElement | null>(null);
  // Passive rate, recomputed only when counts/ups/tsCur change (see effect
  // below) so the per-frame loop reads a ref instead of re-reducing every frame.
  const passiveRateRef = useRef(0);
  // Cached play-area rect so a click doesn't force a layout (getBoundingClientRect)
  // on every tap; refreshed on resize/scroll, which is when it can actually move.
  const playRectRef = useRef<DOMRect | null>(null);
  // Last value we tried to submit, so "reyna aftur" can resend it. null until
  // the first attempt — 0 is a legitimate score, not an absence.
  const lastSubmitRef = useRef<number | null>(null);

  countsRef.current = counts;
  upsRef.current = ups;
  tsCurRef.current = tsCur;
  tsTotRef.current = tsTot;
  thingsRef.current = things;
  chairsRef.current = chairs;
  chairKeyRef.current = chairKey;
  mutedRef.current = muted;

  const chair = chairByKey(chairKey);
  /** Portrait props for a chair — its own image, or a tinted Arnór stand-in. */
  const portrait = useCallback(
    (c: Chair) => {
      const missing = badPortraits.has(c.key);
      return {
        src: missing ? ARNOR.img : c.img,
        // Intrinsic size follows whichever image actually loads, so next/image
        // never gets the wrong aspect ratio.
        width: missing ? ARNOR.w : c.w,
        height: missing ? ARNOR.h : c.h,
        style: missing && c.hue ? { filter: `hue-rotate(${c.hue}deg)` } : undefined,
        onError: () => setBadPortraits((s) => new Set(s).add(c.key)),
      };
    },
    [badPortraits]
  );

  // Ability tuning is derived from the owned upgrades, so it changes the moment
  // an Arnór/Aron upgrade is bought.
  const goldenCfg = useMemo(() => goldenTuning(ups), [ups]);
  const comboCfg = useMemo(() => comboParams(ups), [ups]);
  const goldenRef = useRef(goldenCfg);
  const comboCfgRef = useRef(comboCfg);
  goldenRef.current = goldenCfg;
  comboCfgRef.current = comboCfg;

  // ── load + offline earnings ────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    let loaded: LoadedSave | null = null;
    try {
      loaded = loadSave(safeLocalStorage.getItem(SAVE_KEY));
    } catch {
      /* storage unavailable — start fresh */
    }
    if (loaded) {
      const saved = loaded.save;
      const savedUps = new Set(saved.ups);
      const savedChairs = new Set(saved.chairs);
      // Restore into refs synchronously (not just state). save() reads from
      // refs, and in React Strict Mode the persistence effect's cleanup fires a
      // save() on mount BEFORE the queued setState updates commit — restoring
      // the refs here is what stops that save from clobbering the game with
      // the initial zero-state.
      scoreRef.current = saved.score;
      runRef.current = saved.run;
      countsRef.current = saved.counts;
      upsRef.current = savedUps;
      tsCurRef.current = saved.tsCur;
      tsTotRef.current = saved.tsTot;
      thingsRef.current = saved.things;
      chairsRef.current = savedChairs;
      chairKeyRef.current = saved.chair;
      setCounts(saved.counts);
      setUps(savedUps);
      setTsCur(saved.tsCur);
      setTsTot(saved.tsTot);
      setThings(saved.things);
      setChairs(savedChairs);
      setChairKey(saved.chair);

      // Away-time is settled against the server's clock, not the device's —
      // otherwise winding the system calendar forward mints a full offline
      // payout on demand. A save we can't vouch for earns nothing at all.
      if (loaded.trusted) {
        void serverNow().then((now) => {
          if (!alive) return;
          clockSkewRef.current = now - Date.now();
          const gain =
            baseRateOf(saved.counts, savedUps, saved.tsCur) *
            offlineSeconds(saved.at, now) *
            OFFLINE_RATE;
          if (gain >= 1) {
            scoreRef.current += gain;
            runRef.current += gain;
            setOffline(gain);
          }
        });
      }
    }
    // Saving is unlocked only after this point, so nothing can persist before
    // the saved game has been read back in.
    loadedRef.current = true;
    setScoreView(scoreRef.current);
    // Seed the lifetime mirror too, or the shop spends its first tick thinking
    // this run has produced nothing and hides every lifetime-gated upgrade.
    setRunView(runRef.current);
    return () => {
      alive = false;
    };
  }, []);

  // ── leaderboard fetch ──────────────────────────────────────────────────────
  const refreshBoard = useCallback(() => {
    fetch(SCORES_URL)
      .then((r) => {
        // Every poll re-anchors the clock, so a long session can't drift (or be
        // dragged) away from server time.
        const stamped = Date.parse(r.headers.get("date") ?? "");
        if (Number.isFinite(stamped)) clockSkewRef.current = stamped - Date.now();
        return r.ok ? (r.json() as Promise<ScoreEntry[]>) : null;
      })
      .then((d) => Array.isArray(d) && setScores(d.slice(0, 10)))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshBoard();
  }, [refreshBoard]);

  // ── leaderboard submission ─────────────────────────────────────────────────
  // The board ranks on Þingstig currently held, so this is called on prestige
  // (earning them) and on hiring a fundarstjóri (spending them) alike. The
  // backend stores arnor-clicker scores by replacement rather than by max, so
  // a submission that is lower than the last one really does move the player
  // down the table.
  const submitScore = useCallback((heldThingstig: number) => {
    // Held Þingstig, not lifetime — spending on a fundarstjóri has to be able
    // to send the value down as well as up. Zero is a legitimate standing (you
    // spent everything), so it is submitted rather than skipped.
    const value = Math.min(Math.max(Math.floor(heldThingstig), 0), SCORE_CAP);
    lastSubmitRef.current = value;
    fetch(SCORES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: value }),
      keepalive: true,
    })
      .then((res) => {
        if (res.status === 401) {
          try {
            safeSessionStorage.setItem(PENDING_KEY, String(value));
          } catch {
            /* ignore */
          }
          setLoginHref(`/auth/login?returnTo=/leikir/${GAME}`);
          return null;
        }
        if (!res.ok) throw new Error(`Score submit failed: ${res.status}`);
        return res.json() as Promise<ScoreEntry[]>;
      })
      .then((d) => {
        if (Array.isArray(d)) {
          setScores(d.slice(0, 10));
          setSubmitFailed(false);
        }
      })
      .catch(() => {
        // Non-401 failure (network/server): the run was already spent locally,
        // so tell the player their Þingstig didn't reach the board and offer a
        // retry, rather than silently dropping it.
        setSubmitFailed(true);
      });
  }, []);

  // Recompute the passive rate only when its inputs change; the animation loop
  // and sync tick then just read `passiveRateRef` instead of reducing every frame.
  useEffect(() => {
    passiveRateRef.current = baseRateOf(counts, ups, tsCur);
  }, [counts, ups, tsCur]);

  // ── main loop: passive production + display sync ───────────────────────────
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    // A buff's `all` and `work` both scale passive output; `click` and `share`
    // only touch taps, so they play no part here.
    const passiveMult = (now: number) => {
      const b = liveBuff(buffRef.current, now);
      return b.all * b.work;
    };
    const step = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      // `t` is already a performance.now() reading — the same monotonic clock
      // the buff deadlines are set against.
      const gain = passiveRateRef.current * passiveMult(t) * dt;
      scoreRef.current += gain;
      runRef.current += gain;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const sync = setInterval(() => {
      const now = performance.now();
      setScoreView(scoreRef.current);
      setRunView(runRef.current);
      setRateView(passiveRateRef.current * passiveMult(now));
      const live = liveBuff(buffRef.current, now);
      setBuffLeft(live.until ? Math.max(0, Math.ceil((live.until - now) / 1000)) : 0);
      if (!live.until && buffRef.current.until) {
        // Buff just lapsed — clear it so the chip disappears.
        buffRef.current = NO_BUFF;
        setBuff(NO_BUFF);
      }
      // Samfella decays the moment the window since the last click lapses.
      if (comboRef.current > 0 && now - lastClickRef.current > comboCfgRef.current.window) {
        comboRef.current = 0;
        setCombo(0);
      }
    }, 120);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(sync);
    };
  }, []);

  // Cache the play-area rect; refresh only on resize/scroll (when it can move).
  useEffect(() => {
    const measure = () => {
      playRectRef.current = popLayer.current?.getBoundingClientRect() ?? null;
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, []);

  // Release the Web Audio context when the game unmounts (route change). Reset
  // the closed flag on (re)mount so React Strict Mode's dev remount re-enables
  // audio after its throwaway first cleanup.
  useEffect(() => {
    audioClosedRef.current = false;
    return () => {
      audioClosedRef.current = true;
      acRef.current?.close().catch(() => {});
      acRef.current = null;
    };
  }, []);

  // ── persistence ────────────────────────────────────────────────────────────
  const save = useCallback(() => {
    // Don't persist until the saved game has loaded — otherwise the initial
    // zero-state (or a Strict Mode mount) would overwrite real progress. All
    // fields read from refs so the value is correct regardless of render timing.
    if (!loadedRef.current) return;
    const data: SaveState = {
      v: 1,
      score: scoreRef.current,
      run: runRef.current,
      counts: countsRef.current,
      ups: [...upsRef.current],
      tsCur: tsCurRef.current,
      tsTot: tsTotRef.current,
      things: thingsRef.current,
      // Stamped on the server's clock, so away-time is measured against the
      // same reference it will later be settled against.
      at: Date.now() + clockSkewRef.current,
      chairs: [...chairsRef.current],
      chair: chairKeyRef.current,
    };
    try {
      safeLocalStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, sig: signSave(data) }));
    } catch {
      /* storage full/unavailable */
    }
  }, []);
  useEffect(() => {
    const iv = setInterval(save, 5000);
    const onHide = () => document.hidden && save();
    // pagehide fires on refresh/close/bfcache, where React's unmount cleanup
    // is not guaranteed to run — this is what makes a quick refresh persist.
    const onPageHide = () => save();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      save();
    };
  }, [save]);

  // Persist immediately whenever owned state changes (workers bought, upgrades
  // purchased, prestige) so a quick refresh never loses purchases — the 5s
  // interval alone only reliably captures passive score growth. Skip the first
  // run (mount, before the saved game has loaded) so we never overwrite a good
  // save with the initial zeros.
  const firstSaveSkip = useRef(true);
  useEffect(() => {
    if (firstSaveSkip.current) {
      firstSaveSkip.current = false;
      return;
    }
    save();
  }, [counts, ups, tsCur, tsTot, things, chairs, chairKey, save]);

  // ── audio blipp ────────────────────────────────────────────────────────────
  const blip = useCallback((freq: number, gain: number) => {
    if (mutedRef.current || audioClosedRef.current) return;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = (acRef.current ??= new AC());
      if (ac.state === "suspended") void ac.resume();
      const o = ac.createOscillator();
      const g = ac.createGain();
      const now = ac.currentTime;
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      o.connect(g).connect(ac.destination);
      o.start(now);
      o.stop(now + 0.13);
    } catch {
      /* no audio */
    }
  }, []);

  // ── click the fundarstjóri ─────────────────────────────────────────────────
  const isCombo = chair.ability === "combo";
  const isComboRef = useRef(isCombo);
  isComboRef.current = isCombo;

  const onArnor = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const now = performance.now();
      const cfg = comboCfgRef.current;
      // Samfella only exists under a combo chair; other chairs always tap at 0.
      if (isComboRef.current) {
        const kept = now - lastClickRef.current <= cfg.window;
        comboRef.current = kept ? Math.min(cfg.cap, comboRef.current + 1) : 1;
        setCombo(comboRef.current);
      }
      lastClickRef.current = now;
      const live = liveBuff(buffRef.current, now);
      const gain = clickPower(
        upsRef.current,
        tsCurRef.current,
        passiveRateRef.current * live.all * live.work,
        live,
        isComboRef.current ? comboRef.current : 0,
        cfg.step
      );
      scoreRef.current += gain;
      runRef.current += gain;
      setScoreView(scoreRef.current);
      setTapped(true);
      blip(460 + Math.random() * 100, 0.07);
      const layer = popLayer.current;
      const rect = playRectRef.current ?? layer?.getBoundingClientRect();
      if (layer && rect) {
        const pop = document.createElement("div");
        pop.className = styles.pop;
        pop.textContent = `+${fmt(gain)}`;
        pop.style.left = `${e.clientX - rect.left}px`;
        pop.style.top = `${e.clientY - rect.top}px`;
        layer.appendChild(pop);
        window.setTimeout(() => pop.remove(), 900);
      }
    },
    [blip]
  );

  // ── buying ─────────────────────────────────────────────────────────────────
  const buyWorker = useCallback(
    (i: number) => {
      const cost = costOf(WORKERS[i], countsRef.current[i] ?? 0, buyQty);
      if (scoreRef.current < cost) return;
      scoreRef.current -= cost;
      setScoreView(scoreRef.current);
      setCounts((c) => c.map((n, idx) => (idx === i ? n + buyQty : n)));
      blip(230, 0.08);
    },
    [buyQty, blip]
  );

  const buyUpgrade = useCallback(
    (u: Upgrade) => {
      const { key, cost } = u;
      if (upsRef.current.has(key) || scoreRef.current < cost) return;
      // The shop only renders unlocked cards, so this can't be hit through the
      // UI — it's here so the unlock rules stay the single gate on all 55.
      const ctx = {
        counts: countsRef.current,
        lifetime: runRef.current,
        things: thingsRef.current,
        chair: chairKeyRef.current,
      };
      if (!upgradeUnlocked(u, ctx)) return;
      scoreRef.current -= cost;
      setScoreView(scoreRef.current);
      setUps((s) => new Set(s).add(key));
      blip(320, 0.08);
    },
    [blip]
  );

  // ── gullnir Arnórar ────────────────────────────────────────────────────────
  // Only Arnór's ability spawns them, and only once real production is running
  // — the opening clicks always land unboosted. The interval is re-read from a
  // ref on every reschedule, so buying "Gljáfægður fundarhamar" speeds up the
  // very next spawn instead of waiting for a remount.
  const isGolden = chair.ability === "golden";
  const isGoldenRef = useRef(isGolden);
  isGoldenRef.current = isGolden;

  useEffect(() => {
    let alive = true;
    let timer = 0;
    const nextDelay = () => {
      const span = GOLDEN_EVERY_MAX_S - GOLDEN_EVERY_MIN_S;
      return (GOLDEN_EVERY_MIN_S + Math.random() * span) * 1000 * goldenRef.current.rate;
    };
    const spawn = () => {
      if (!alive) return;
      if (isGoldenRef.current && runRef.current >= GOLDEN_UNLOCK) {
        const id = Date.now();
        const v = pickGolden(Math.random(), goldenRef.current.luck);
        setGolden({ id, top: 12 + Math.random() * 42, v });
        window.setTimeout(
          () => setGolden((g) => (g && g.id === id ? null : g)),
          GOLDEN_ON_SCREEN_MS
        );
      }
      timer = window.setTimeout(spawn, nextDelay());
    };
    // First eligible spawn is a shortened wait so a new player meets one early.
    timer = window.setTimeout(spawn, 90_000 * goldenRef.current.rate);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  const claimGolden = useCallback(() => {
    const g = golden;
    if (!g) return;
    // Buff deadlines live on the monotonic clock: a buff must not be extendable
    // by winding the system clock backwards mid-Skátaandinn.
    const now = performance.now();
    const { power, dur } = goldenRef.current;
    const secs = lumpSeconds(g.v, power);
    if (secs > 0) {
      // Instant payout: seconds of current production, with a floor so an early
      // Dagskrárliður is still worth claiming when the rate is near zero.
      const gain = Math.max(passiveRateRef.current * secs, 25);
      scoreRef.current += gain;
      runRef.current += gain;
      setScoreView(scoreRef.current);
      setLastGolden({ name: g.v.name, text: `+${fmt(gain)} fundarstig` });
    } else {
      const b = buffFromGolden(g.v, now, power, dur);
      buffRef.current = b;
      setBuff(b);
      setLastGolden({ name: g.v.name, text: "" });
    }
    setGolden(null);
    blip(720, 0.09);
    window.setTimeout(() => blip(900, 0.08), 90);
  }, [golden, blip]);

  // Clear the golden toast a few seconds after it lands.
  useEffect(() => {
    if (!lastGolden) return;
    const t = window.setTimeout(() => setLastGolden(null), 3200);
    return () => clearTimeout(t);
  }, [lastGolden]);

  // ── fundarstjórar ──────────────────────────────────────────────────────────
  // Bought once with Þingstig and kept across þing; switching between the ones
  // you own is free. Spending Þingstig lowers the permanent boost, which is the
  // whole trade — an ability instead of a percentage.
  const buyChair = useCallback(
    (key: string) => {
      const c = chairByKey(key);
      if (chairsRef.current.has(key) || tsCurRef.current < c.cost) return;
      const left = tsCurRef.current - c.cost;
      tsCurRef.current = left;
      setTsCur(left);
      setChairs((s) => new Set(s).add(key));
      setChairKey(key);
      // The board ranks on what you hold, so hiring shows up there immediately.
      submitScore(left);
      blip(560, 0.09);
    },
    [blip, submitScore]
  );

  const pickChair = useCallback(
    (key: string) => {
      if (!chairsRef.current.has(key) || chairKeyRef.current === key) return;
      setChairKey(key);
      // Abilities don't carry over between chairs.
      comboRef.current = 0;
      setCombo(0);
      setGolden(null);
      blip(400, 0.07);
    },
    [blip]
  );

  // ── prestige (fresta þingfundi) ─────────────────────────────────────────────
  const prestigeGain = thingstigFor(runRef.current);

  const retrySubmit = useCallback(() => {
    setSubmitFailed(false);
    // null means nothing has been submitted yet. Zero is a real standing — the
    // player spent every Þingstig — so it must stay retryable.
    if (lastSubmitRef.current !== null) submitScore(lastSubmitRef.current);
  }, [submitScore]);

  const doPrestige = useCallback(() => {
    const gain = thingstigFor(runRef.current);
    if (gain < 1) return;
    setTsTot(tsTot + gain);
    const held = tsCurRef.current + gain;
    tsCurRef.current = held;
    setTsCur(held);
    setThings((n) => n + 1);
    scoreRef.current = 0;
    runRef.current = 0;
    setScoreView(0);
    setCounts(WORKERS.map(() => 0));
    setUps(new Set());
    // Fundarstjórar are permanent; their abilities' live state is not.
    buffRef.current = NO_BUFF;
    setBuff(NO_BUFF);
    comboRef.current = 0;
    setCombo(0);
    setGolden(null);
    submitScore(held);
  }, [tsTot, submitScore]);

  // Submit any score stashed before a login redirect.
  const pendingDone = useRef(false);
  useEffect(() => {
    if (!user || pendingDone.current) return;
    let pending: string | null = null;
    try {
      pending = safeSessionStorage.getItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
    if (!pending) return;
    pendingDone.current = true;
    try {
      safeSessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
    submitScore(Number(pending));
    setLoginHref(null);
  }, [user, submitScore]);

  const parts = scoreParts(scoreView);
  const accent = TABS.find((t) => t.id === tab)!.accent;
  const panelVars: Vars = { "--panel-accent": accent };
  const canPrestige = prestigeGain >= 1;

  // The upgrade shop: everything unlocked but not yet bought, cheapest first.
  // Anything gated behind a worker count, a lifetime total, a completed þing or
  // another fundarstjóri simply isn't listed yet.
  const shopUpgrades = useMemo(() => {
    // Sum the roster once for the whole pass, not once per upgrade.
    const ctx = {
      counts,
      totalWorkers: totalWorkers(counts),
      lifetime: runView,
      things,
      chair: chairKey,
    };
    return UPGRADES.filter((u) => !ups.has(u.key) && upgradeUnlocked(u, ctx)).sort(
      (a, b) => a.cost - b.cost
    );
  }, [counts, runView, things, chairKey, ups]);

  // Which Fundarsköp cards to show: all affordable-so-far + the first locked "next".
  const visibleWorkers = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < WORKERS.length; i++) {
      const unlocked = i === 0 || counts[i - 1] > 0 || counts[i] > 0;
      out.push(i);
      // Show the first locked "next" card as a teaser, then stop.
      if (!unlocked) break;
    }
    return out;
  }, [counts]);

  return (
    <div className={styles.root}>
      <div className={styles.game}>
        {/* PLAY AREA */}
        <div className={styles.play} ref={popLayer}>
          <div className={styles.readout}>
            <div className={styles.plate} tabIndex={0}>
              <div className={styles.k}>fundarstig</div>
              <div className={styles.n}>
                {parts.num}
                {parts.suf && <span className={styles.suf}>{parts.suf}</span>}
              </div>
              <div className={styles.r}>+{fmt(rateView)}/sek</div>
              <div className={styles.tip}>
                {parts.name && parts.name !== "fundarstig" ? (
                  <>
                    Þú ert komin í <b>{parts.name}</b>
                    <small>
                      {parts.num}
                      {parts.pow ? ` × ${parts.pow}` : ""} fundarstig
                    </small>
                  </>
                ) : (
                  <>
                    <b>{parts.num}</b> fundarstig
                  </>
                )}
              </div>
            </div>
            {tsCur > 0 && (
              <div className={styles.poke} aria-label="Þingstig">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="m12 2 3 6.9 7.6.6-5.8 5 1.8 7.4L12 18l-6.4 3.9 1.8-7.4-5.8-5 7.6-.6z" />
                </svg>
                <span className={styles.pkN}>{tsCur.toLocaleString("is-IS")}</span>
                <small>Þingstig</small>
              </div>
            )}
          </div>

          <button
            className={styles.mute}
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Kveikja á hljóði" : "Slökkva á hljóði"}
            title="Hljóð"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M11 5 6 9H2v6h4l5 4z" />
              {muted ? (
                <>
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </>
              ) : (
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              )}
            </svg>
          </button>

          <div className={styles.buffs}>
            {buffLeft > 0 && (
              <span className={styles.buff}>
                {buff.name} · {buffLeft}s
              </span>
            )}
            {combo > 0 && (
              <span className={styles.comboChip} style={{ "--chair-c": chair.color } as Vars}>
                Samfella ×
                {comboMult(combo, comboCfg.step).toLocaleString("is-IS", {
                  maximumFractionDigits: 1,
                })}
                <small>
                  {combo}/{comboCfg.cap}
                </small>
              </span>
            )}
          </div>

          {lastGolden && (
            <div className={styles.toast} role="status">
              <b>{lastGolden.name}</b>
              {lastGolden.text && <span>{lastGolden.text}</span>}
            </div>
          )}

          <OrbitField counts={counts} />

          <div className={`${styles.stage} ${tapped ? styles.tapped : ""}`}>
            <button
              className={styles.arnor}
              onPointerDown={onArnor}
              aria-label={`Smella á ${chair.name}`}
            >
              <Image
                {...portrait(chair)}
                alt={`${chair.name} fundarstjóri`}
                priority
                draggable={false}
              />
            </button>
            <div className={styles.hint}>Smelltu á {chair.name} til að setja skátaþing</div>
          </div>

          {golden && (
            <button
              className={styles.golden}
              style={
                {
                  top: `${golden.top}%`,
                  "--g-hue": `${golden.v.hue}deg`,
                  "--golden-ms": `${GOLDEN_ON_SCREEN_MS}ms`,
                } as Vars
              }
              onClick={claimGolden}
              aria-label={`Gullinn Arnór — ${golden.v.name}`}
            >
              <Image src={ARNOR.img} alt="" width={ARNOR.w} height={ARNOR.h} />
              <span className={styles.tag}>{golden.v.name}</span>
            </button>
          )}

          <div className={styles.lboard} aria-label="Þingstig-tafla">
            <div className={styles.lboardH}>
              Þingstig-tafla
              {/* The board ranks on Þingstig held, not earned, so hiring a
                  fundarstjóri moves you down it. Without saying so, the gap
                  between this and "Þingstig samtals" reads as a bug. */}
              <small>óeydd Þingstig</small>
            </div>
            {scores.length === 0 ? (
              <p className={styles.lboardEmpty}>Engar færslur enn</p>
            ) : (
              <ol>
                {scores.slice(0, 5).map((s, i) => {
                  const isMe = !!user?.name && s.user_name === user.name;
                  const rankClass =
                    i === 0 ? styles.r1 : i === 1 ? styles.r2 : i === 2 ? styles.r3 : "";
                  return (
                    <li
                      key={`${s.user_name}-${s.score}-${i}`}
                      className={`${rankClass} ${isMe ? styles.me : ""}`.trim()}
                    >
                      <span className={styles.rk}>{i + 1}</span>
                      <span className={styles.who}>{s.user_name}</span>
                      <span className={styles.sc}>{s.score.toLocaleString("is-IS")}</span>
                    </li>
                  );
                })}
              </ol>
            )}
            {loginHref && (
              <p className={styles.lboardLogin}>
                <a href={loginHref}>Skráðu þig inn</a> til að vista Þingstig
              </p>
            )}
            {submitFailed && !loginHref && (
              <p className={styles.lboardError} role="status">
                Tókst ekki að vista Þingstig.{" "}
                <button type="button" onClick={retrySubmit}>
                  Reyna aftur
                </button>
              </p>
            )}
          </div>
        </div>

        {/* PANEL */}
        <aside className={styles.panel} style={panelVars}>
          <div className={styles.ptabs}>
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`${styles.ptab} ${tab === t.id ? styles.ptabActive : ""}`}
                style={{ "--tab-c": t.accent } as Vars}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "thing" ? (
            <div className={styles.thing} style={panelVars}>
              <div className={styles.board}>
                <h3>Þín þing</h3>
                <ol>
                  {/* Held first: it is what the table ranks on. Lifetime sits
                      below as the historical figure it is. */}
                  <li>
                    <span>Óeydd Þingstig — á töflunni</span>
                    <span>{tsCur}</span>
                  </li>
                  <li>
                    <span>Þingstig unnin samtals</span>
                    <span>{tsTot}</span>
                  </li>
                  <li>
                    <span>Fjöldi þinga</span>
                    <span>{things}</span>
                  </li>
                  <li>
                    <span>Varanleg uppörvun</span>
                    <span>+{Math.round(prestigeBonusPct(tsCur)).toLocaleString("is-IS")}%</span>
                  </li>
                </ol>
              </div>

              <div className={styles.board}>
                <h3>Fundarstjórar</h3>
                <p className={styles.boardNote}>
                  Keyptir fyrir Þingstig og fylgja þér milli þinga. Hvert Þingstig sem þú eyðir er
                  0,5% varanleg uppörvun sem þú gefur eftir.
                </p>
                <div className={styles.chairs}>
                  {CHAIRS.map((c) => {
                    const owned = chairs.has(c.key);
                    const active = c.key === chairKey;
                    const affordable = tsCur >= c.cost;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        className={`${styles.chairCard} ${active ? styles.chairOn : ""}`.trim()}
                        style={{ "--chair-c": c.color } as Vars}
                        disabled={!owned && !affordable}
                        aria-pressed={active}
                        onClick={() => (owned ? pickChair(c.key) : buyChair(c.key))}
                      >
                        <span className={styles.chairPic}>
                          <Image {...portrait(c)} alt="" />
                        </span>
                        <span className={styles.chairBody}>
                          <span className={styles.chairName}>
                            {c.name}
                            <small>{c.title}</small>
                          </span>
                          <span className={styles.chairFlavour}>{c.flavour}</span>
                          <span className={styles.chairDesc}>{c.desc}</span>
                        </span>
                        <span className={styles.chairState}>
                          {active ? "Virkur" : owned ? "Velja" : `${c.cost} Þingstig`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Bulk-buy only applies to fundarsköp; upgrades are one-offs, so
                  that strip carries the "how far along am I" count instead. */}
              <div className={styles.qline} style={panelVars}>
                {tab === "fundarskop" ? (
                  <>
                    <span className={styles.qlbl}>Kaupa í einu</span>
                    <div className={styles.seg}>
                      {QTYS.map((q) => (
                        <button
                          key={q}
                          className={buyQty === q ? styles.segOn : ""}
                          onClick={() => setBuyQty(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <span className={styles.qlbl}>Áunnar uppfærslur</span>
                    <span className={styles.qcount}>
                      {ups.size} <small>af {UPGRADES.length}</small>
                    </span>
                  </>
                )}
              </div>

              <div className={styles.cards} style={panelVars}>
                {tab === "fundarskop"
                  ? visibleWorkers.map((i) => {
                      const w = WORKERS[i];
                      const cost = costOf(w, counts[i] ?? 0, buyQty);
                      const affordable = scoreView >= cost;
                      const cardVars: Vars = { "--tc": w.color, "--tfg": w.fg };
                      return (
                        <button
                          key={w.key}
                          className={styles.wcard}
                          style={cardVars}
                          disabled={!affordable}
                          onClick={() => buyWorker(i)}
                        >
                          <span className={styles.own}>{counts[i] ?? 0}</span>
                          <span className={styles.tok}>
                            <WorkerIcon name={w.icon} />
                          </span>
                          <span className={styles.wbody}>
                            <span className={styles.wname}>{w.name}</span>
                            <br />
                            <span className={styles.wmeta}>{fmt(w.out)}/sek · hver</span>
                          </span>
                          <span className={styles.cost}>
                            <span className={styles.c}>{fmt(cost)}</span>
                          </span>
                        </button>
                      );
                    })
                  : shopUpgrades.map((u) => {
                      const affordable = scoreView >= u.cost;
                      const cardVars: Vars = {
                        "--tc": "hsl(var(--sl-color-patrol-rekkar))",
                        "--tfg": "hsl(var(--sl-color-text-inverse))",
                      };
                      return (
                        <button
                          key={u.key}
                          className={styles.wcard}
                          style={cardVars}
                          disabled={!affordable}
                          onClick={() => buyUpgrade(u)}
                        >
                          <span className={styles.tok}>
                            <WorkerIcon name={u.icon} />
                          </span>
                          <span className={styles.wbody}>
                            <span className={styles.wname}>{u.name}</span>
                            <br />
                            <span className={styles.weff}>{upgradeEffect(u)}</span>
                            <br />
                            <span className={styles.wmeta}>{u.desc}</span>
                          </span>
                          <span className={styles.cost}>
                            <span className={styles.c}>{fmt(u.cost)}</span>
                            <span className={styles.u}>stig</span>
                          </span>
                        </button>
                      );
                    })}
                {tab === "uppfaerslur" && shopUpgrades.length === 0 && (
                  <p className={styles.shopEmpty}>
                    Engar uppfærslur í boði í augnablikinu — ráddu fleiri fundarsköp til að opna
                    næstu.
                  </p>
                )}
              </div>
            </>
          )}

          <div className={styles.prestige}>
            <button onClick={doPrestige} disabled={!canPrestige}>
              Fresta þingfundi til morguns
            </button>
            <div className={styles.sub}>
              {canPrestige
                ? `Þú færð ${prestigeGain} Þingstig · +${Math.round(prestigeBonusGainPct(tsCur, prestigeGain)).toLocaleString("is-IS")}% varanlega`
                : "Safnaðu fleiri fundarstig til að fresta þinginu"}
            </div>
          </div>
        </aside>
      </div>

      {offline !== null && (
        <div className={styles.backdrop} onClick={() => setOffline(null)}>
          <div className={styles.modal}>
            <h2>Á meðan þú varst í burtu</h2>
            <p>Þingið afgreiddi {fmt(offline)} fundarstig.</p>
            <button onClick={() => setOffline(null)}>Halda áfram</button>
          </div>
        </div>
      )}
    </div>
  );
}
