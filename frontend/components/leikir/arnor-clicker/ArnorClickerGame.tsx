// Arnór-Clicker — assist Arnór, the fundarstjóri, in running a Skátaþing.
// Idle clicker: tap Arnór's face for fundarstig, recruit Fundarsköp workers
// (which orbit him as a place-value odometer), buy upgrades, ride golden Arnórs,
// and "fresta þingfundi" to prestige for Þingstig. Leaderboard = total Þingstig.
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
  costOf,
  fmt,
  scoreParts,
  thingstigFor,
  baseRateOf,
  clickMult,
  prestigeMult,
  goldenMultiplier,
  GOLDEN_MULT,
  PRESTIGE_MULT_PER_POINT,
  type Vars,
} from "./gameData";
import styles from "./arnorClicker.module.css";

const GAME = "arnor-clicker";
const SCORES_URL = `/api/leikir/${GAME}/scores`;
const PENDING_KEY = `leikir_pending_score_${GAME}`;
const SAVE_KEY = "arnor_clicker_save_v2"; // v2: 20-worker roster (old saves mis-map)
const CAP = 999_999;
const OFFLINE_CAP_S = 8 * 3600;
const OFFLINE_RATE = 0.5;
// Golden Arnór (and its ×7 boost) stays gated until the player has real
// production going — no boosts in the opening clicks. First eligible once
// lifetime fundarstig this run crosses this threshold.
const GOLDEN_UNLOCK = 10_000;

const QTYS = [1, 5, 10, 25, 100];
const TABS = [
  { id: "fundarskop", label: "Fundarsköp", accent: "var(--sl-color-primary)" },
  { id: "uppfaerslur", label: "Uppfærslur", accent: "var(--sl-color-patrol-rekkar)" },
  { id: "thing", label: "Þing", accent: "var(--sl-color-patrol-drekar)" },
] as const;
type TabId = (typeof TABS)[number]["id"];

interface SaveState {
  v: 1;
  score: number;
  run: number;
  counts: number[];
  ups: string[];
  tsCur: number;
  tsTot: number;
  things: number;
  at: number;
}

export default function ArnorClickerGame() {
  const { user } = useUser();

  const [counts, setCounts] = useState<number[]>(() => WORKERS.map(() => 0));
  const [ups, setUps] = useState<Set<string>>(() => new Set());
  const [scoreView, setScoreView] = useState(0);
  const [rateView, setRateView] = useState(0);
  const [tsCur, setTsCur] = useState(0);
  const [tsTot, setTsTot] = useState(0);
  const [things, setThings] = useState(0);
  const [buyQty, setBuyQty] = useState(1);
  const [tab, setTab] = useState<TabId>("fundarskop");
  const [muted, setMuted] = useState(false);
  const [tapped, setTapped] = useState(false);
  const [golden, setGolden] = useState<{ id: number; top: number } | null>(null);
  const [buffLeft, setBuffLeft] = useState(0);
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
  const goldenUntilRef = useRef(0);
  const mutedRef = useRef(false);
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
  // Last score we tried to submit, so the "retry" affordance can resend it.
  const lastSubmitRef = useRef(0);

  countsRef.current = counts;
  upsRef.current = ups;
  tsCurRef.current = tsCur;
  tsTotRef.current = tsTot;
  thingsRef.current = things;
  mutedRef.current = muted;

  // ── load + offline earnings ────────────────────────────────────────────────
  useEffect(() => {
    let saved: SaveState | null = null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) saved = JSON.parse(raw) as SaveState;
    } catch {
      /* corrupt save — start fresh */
    }
    if (saved && saved.v === 1) {
      const savedUps = new Set(saved.ups);
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
      setCounts(saved.counts);
      setUps(savedUps);
      setTsCur(saved.tsCur);
      setTsTot(saved.tsTot);
      setThings(saved.things);
      const away = Math.max(0, (Date.now() - saved.at) / 1000);
      const gain =
        baseRateOf(saved.counts, savedUps, saved.tsCur) *
        Math.min(away, OFFLINE_CAP_S) *
        OFFLINE_RATE;
      if (gain >= 1) {
        scoreRef.current += gain;
        runRef.current += gain;
        setOffline(gain);
      }
    }
    // Saving is unlocked only after this point, so nothing can persist before
    // the saved game has been read back in.
    loadedRef.current = true;
    setScoreView(scoreRef.current);
  }, []);

  // ── leaderboard fetch ──────────────────────────────────────────────────────
  const refreshBoard = useCallback(() => {
    fetch(SCORES_URL)
      .then((r) => (r.ok ? (r.json() as Promise<ScoreEntry[]>) : null))
      .then((d) => Array.isArray(d) && setScores(d.slice(0, 10)))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshBoard();
  }, [refreshBoard]);

  // Recompute the passive rate only when its inputs change; the animation loop
  // and sync tick then just read `passiveRateRef` instead of reducing every frame.
  useEffect(() => {
    passiveRateRef.current = baseRateOf(counts, ups, tsCur);
  }, [counts, ups, tsCur]);

  // ── main loop: passive production + display sync ───────────────────────────
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      const gmult = goldenMultiplier(goldenUntilRef.current, Date.now());
      const gain = passiveRateRef.current * gmult * dt;
      scoreRef.current += gain;
      runRef.current += gain;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const sync = setInterval(() => {
      setScoreView(scoreRef.current);
      const gmult = goldenMultiplier(goldenUntilRef.current, Date.now());
      setRateView(passiveRateRef.current * gmult);
      setBuffLeft(Math.max(0, Math.ceil((goldenUntilRef.current - Date.now()) / 1000)));
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
      at: Date.now(),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
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
  }, [counts, ups, tsCur, tsTot, things, save]);

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

  // ── click Arnór ────────────────────────────────────────────────────────────
  const clickGain = useMemo(() => 1 * clickMult(ups) * prestigeMult(tsCur), [ups, tsCur]);
  const clickGainRef = useRef(clickGain);
  clickGainRef.current = clickGain;

  const onArnor = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const gmult = goldenMultiplier(goldenUntilRef.current, Date.now());
      const gain = clickGainRef.current * gmult;
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
    (key: string, cost: number) => {
      if (upsRef.current.has(key) || scoreRef.current < cost) return;
      scoreRef.current -= cost;
      setScoreView(scoreRef.current);
      setUps((s) => new Set(s).add(key));
      blip(320, 0.08);
    },
    [blip]
  );

  // ── golden Arnór ───────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const spawn = () => {
      if (!alive) return;
      // Gate boosts to later game — no golden Arnór until real production is
      // running, so the opening clicks always land at click power 1.
      if (runRef.current < GOLDEN_UNLOCK) return;
      const id = Date.now();
      setGolden({ id, top: 12 + Math.random() * 42 });
      window.setTimeout(() => setGolden((g) => (g && g.id === id ? null : g)), 9000);
    };
    // First eligible spawn ~90s in, then a golden every 3–5 minutes (only when
    // the GOLDEN_UNLOCK gate above is met) — a rare treat, not a constant one.
    const first = window.setTimeout(spawn, 90000);
    const iv = setInterval(spawn, 180000 + Math.random() * 120000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(iv);
    };
  }, []);
  const claimGolden = useCallback(() => {
    goldenUntilRef.current = Date.now() + 9000;
    setGolden(null);
    blip(720, 0.09);
    window.setTimeout(() => blip(900, 0.08), 90);
  }, [blip]);

  // ── prestige (fresta þingfundi) ─────────────────────────────────────────────
  const prestigeGain = thingstigFor(runRef.current);
  const submitScore = useCallback((totalThingstig: number) => {
    const value = Math.min(Math.floor(totalThingstig), CAP);
    if (value < 1) return;
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
            sessionStorage.setItem(PENDING_KEY, String(value));
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

  const retrySubmit = useCallback(() => {
    setSubmitFailed(false);
    if (lastSubmitRef.current > 0) submitScore(lastSubmitRef.current);
  }, [submitScore]);

  const doPrestige = useCallback(() => {
    const gain = thingstigFor(runRef.current);
    if (gain < 1) return;
    const newTot = tsTot + gain;
    setTsTot(newTot);
    setTsCur((c) => c + gain);
    setThings((n) => n + 1);
    scoreRef.current = 0;
    runRef.current = 0;
    setScoreView(0);
    setCounts(WORKERS.map(() => 0));
    setUps(new Set());
    submitScore(newTot);
  }, [tsTot, submitScore]);

  // Submit any score stashed before a login redirect.
  const pendingDone = useRef(false);
  useEffect(() => {
    if (!user || pendingDone.current) return;
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
    if (!pending) return;
    pendingDone.current = true;
    try {
      sessionStorage.removeItem(PENDING_KEY);
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

          {buffLeft > 0 && (
            <div className={styles.buffs}>
              <span className={styles.buff}>
                Fundarhiti ×{GOLDEN_MULT} · {buffLeft}s
              </span>
            </div>
          )}

          <OrbitField counts={counts} />

          <div className={`${styles.stage} ${tapped ? styles.tapped : ""}`}>
            <button className={styles.arnor} onPointerDown={onArnor} aria-label="Smella á Arnór">
              <Image
                src="/leikir/arnor-clicker/arnor.png"
                alt="Arnór fundarstjóri"
                width={220}
                height={278}
                priority
                draggable={false}
              />
            </button>
            <div className={styles.hint}>Smelltu á Arnór til að setja skátaþing</div>
          </div>

          {golden && (
            <button
              className={styles.golden}
              style={{ top: `${golden.top}%` }}
              onClick={claimGolden}
              aria-label="Gullinn Arnór — Fundarhiti"
            >
              <Image
                src="/leikir/arnor-clicker/arnor.png"
                alt="Gullinn Arnór"
                width={96}
                height={121}
              />
              <span className={styles.tag}>Fundarhiti ×{GOLDEN_MULT}</span>
            </button>
          )}

          <div className={styles.lboard} aria-label="Þingstig-tafla">
            <div className={styles.lboardH}>Þingstig-tafla</div>
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
                  <li>
                    <span>Þingstig samtals</span>
                    <span>{tsTot}</span>
                  </li>
                  <li>
                    <span>Fjöldi þinga</span>
                    <span>{things}</span>
                  </li>
                  <li>
                    <span>Varanleg uppörvun</span>
                    <span>+{Math.round(PRESTIGE_MULT_PER_POINT * tsCur * 100)}%</span>
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.qline} style={panelVars}>
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
                  : UPGRADES.map((u) => {
                      const owned = ups.has(u.key);
                      const affordable = !owned && scoreView >= u.cost;
                      const cardVars: Vars = {
                        "--tc": "hsl(var(--sl-color-patrol-rekkar))",
                        "--tfg": "currentColor",
                      };
                      return (
                        <button
                          key={u.key}
                          className={styles.wcard}
                          style={cardVars}
                          disabled={owned || !affordable}
                          onClick={() => buyUpgrade(u.key, u.cost)}
                        >
                          <span className={styles.tok}>
                            <WorkerIcon name="coffee" />
                          </span>
                          <span className={styles.wbody}>
                            <span className={styles.wname}>{u.name}</span>
                            <br />
                            <span className={styles.wmeta}>{u.desc}</span>
                          </span>
                          <span className={styles.cost}>
                            <span className={styles.c}>{owned ? "átt" : fmt(u.cost)}</span>
                            <span className={styles.u}>{owned ? "" : "stig"}</span>
                          </span>
                        </button>
                      );
                    })}
              </div>
            </>
          )}

          <div className={styles.prestige}>
            <button onClick={doPrestige} disabled={!canPrestige}>
              Fresta þingfundi til morguns
            </button>
            <div className={styles.sub}>
              {canPrestige
                ? `Þú færð ${prestigeGain} Þingstig · +${Math.round(PRESTIGE_MULT_PER_POINT * prestigeGain * 100)}% varanlega`
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
