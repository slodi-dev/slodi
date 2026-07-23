// The workforce odometer: concentric rings of orbitals (worker-icon tokens)
// circling Arnór. One place-value ring ladder shared by all worker types (inner
// ring = 1 each, outer rings worth exponentially more). Rings rotate; orbitals
// stay upright and bob. A hard total-icon cap keeps the DOM bounded.
//
// Orbitals animate on change: a brand-new orbital springs in (`orbitalEnter`),
// and when lower-ring orbitals carry up into a higher ring — the odometer
// "combine" — the new higher orbital pops with a shockwave (`orbitalMerge`). To
// know which orbitals are new vs. carried-up, we keep the previous per-(worker,
// ring) counts and diff against them each render, and give every orbital a
// stable key so React only mounts (and thus only animates) the genuinely new ones.

import { Fragment, memo, useEffect, useRef, type CSSProperties } from "react";
import { WORKERS, decomposeToRings } from "./gameData";
import { WorkerIcon, type IconKey } from "./icons";
import styles from "./arnorClicker.module.css";

type Vars = CSSProperties & Record<string, string>;

const TOTAL_ICON_CAP = 72;

interface Orbital {
  key: string;
  icon: IconKey;
  color: string;
  fg: string;
}

function gcd(a: number, b: number): number {
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

// Scatter a ring's orbitals so neither same-type nor similar-hue tokens sit next
// to each other, and so adjacent rings don't line up into radial colour spokes.
// The j-th input token (tokens are grouped by worker, so a type's copies are
// consecutive) is placed at slot (phase + j·stride) mod N, with stride ≈ the
// golden ratio of N and coprime to it: consecutive inputs land ~0.618 of the way
// around the ring apart, and a per-ring phase offset keeps rings from aligning.
function scatter(tokens: Orbital[], ringIndex: number): Orbital[] {
  const n = tokens.length;
  if (n <= 2) return tokens;
  let stride = Math.max(1, Math.round(n * 0.618033988749895));
  while (gcd(stride, n) !== 1) stride += 1;
  const phase = (ringIndex * 3) % n;
  const out = new Array<Orbital>(n);
  for (let j = 0; j < n; j += 1) {
    out[(phase + j * stride) % n] = tokens[j];
  }
  return out;
}

function OrbitField({ counts }: { counts: number[] }) {
  // Previous per-(worker, ring) orbital counts, for the new/merge diff.
  const prevRef = useRef<number[][]>(WORKERS.map(() => []));
  const prev = prevRef.current;

  // Current place-value decomposition per worker.
  const dec: number[][] = WORKERS.map((_, wi) => decomposeToRings(counts[wi] ?? 0));

  // Build capped rings, tagging each newly-appearing orbital as enter or merge.
  // Tokens are collected into per-worker groups first, then interleaved within
  // each ring so same-type orbitals don't clump into a single-colour arc.
  const anim: Record<string, "enter" | "merge"> = {};
  const ringGroups: Orbital[][][] = [];
  let total = 0;
  for (let wi = 0; wi < WORKERS.length; wi++) {
    const w = WORKERS[wi];
    for (let r = 0; r < dec[wi].length; r++) {
      const cur = dec[wi][r];
      if (cur === 0) continue;
      const was = prev[wi]?.[r] ?? 0;
      // A carry into ring r happened if the ring just below it (same worker)
      // shrank in this transition — those lower orbitals combined up into here.
      const lowerShrank = r > 0 && (dec[wi][r - 1] ?? 0) < (prev[wi]?.[r - 1] ?? 0);
      const group: Orbital[] = [];
      for (let k = 0; k < cur && total < TOTAL_ICON_CAP; k++) {
        const key = `w${wi}-r${r}-${k}`;
        if (k >= was) anim[key] = lowerShrank ? "merge" : "enter";
        group.push({ key, icon: w.icon, color: w.color, fg: w.fg });
        total++;
      }
      if (group.length > 0) (ringGroups[r] ??= []).push(group);
    }
  }
  const rings: Orbital[][] = [];
  for (let r = 0; r < ringGroups.length; r++) {
    const flat = ringGroups[r] ? ringGroups[r].flat() : [];
    rings[r] = scatter(flat, r);
  }

  // Record this render's decomposition for the next diff (after commit).
  useEffect(() => {
    prevRef.current = dec;
  });

  return (
    <div className={styles.orbit} aria-hidden="true">
      {rings.map((tokens, r) => {
        if (!tokens || tokens.length === 0) return null;
        const R = 150 + r * 62;
        const cw = r % 2 === 0;
        const dur = `${34 + r * 9}s`;
        const n = tokens.length;
        const offset = -Math.PI / 2 + R / 200;
        const ringStyle: Vars = { "--rdur": dur, "--rdir": cw ? "normal" : "reverse" };
        return (
          <Fragment key={r}>
            {/* static orbit track for this active ring */}
            <div
              className={styles.ringLine}
              style={{ width: 2 * R, height: 2 * R, marginLeft: -R, marginTop: -R }}
            />
            <div className={styles.ring} style={ringStyle}>
              {tokens.map((t, i) => {
              const a = offset + ((2 * Math.PI) / n) * i;
              const state = anim[t.key];
              const popClass =
                state === "merge"
                  ? `${styles.orbitalPop} ${styles.orbitalMerge}`
                  : state === "enter"
                    ? `${styles.orbitalPop} ${styles.orbitalEnter}`
                    : styles.orbitalPop;
              const style: Vars = {
                left: `${R * Math.cos(a)}px`,
                top: `${R * Math.sin(a)}px`,
                animationDelay: `${-(i * 0.3)}s`,
                "--tc": t.color,
                "--tfg": t.fg,
                "--dur": `${2.4 + (i % 4) * 0.5}s`,
                "--rdur": dur,
                "--idir": cw ? "reverse" : "normal",
              };
              return (
                <div key={t.key} className={styles.orbital} style={style}>
                  <span className={popClass}>
                    <WorkerIcon name={t.icon} />
                  </span>
                </div>
              );
            })}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

export default memo(OrbitField);
