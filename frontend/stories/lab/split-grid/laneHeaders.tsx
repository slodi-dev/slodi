/**
 * The head of a flokkur's column, in five looks: the current pill and four with more of the
 * flokkur's own character (H1–H4, see the MDX). Every look carries the same things: the name as
 * a real heading (`h4`, under the band's `h3`), the column's total and whether it sets the
 * band's length or waits. Only the look changes.
 *
 * Long names wrap to two lines at most, hyphenated by the browser's Icelandic dictionary where
 * it has one (`lang="is"` on the band) and broken anywhere as a last resort for a compound with
 * nowhere to break; past two lines they end in "…". The full name stays the heading's text, so
 * a screen reader hears all of it, and it is the tooltip.
 */
import type { CSSProperties } from "react";
import {
  Bird,
  CloudLightning,
  Feather,
  Fish,
  Moon,
  Panda,
  PawPrint,
  Rocket,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { INK_GAPS, INK_ROUGHNESS } from "@/components/plan/calendar/Stamp";
import type { LaneModel, SplitModel } from "./labBench";
import styles from "./SplitGridLab.module.css";

import type { HeaderLook } from "./headerLooks";

export type { HeaderLook };

/* ── H2: the flokkur's animal ── */

/**
 * The crest picture, by a word in the flokkur's name. One place, first match wins; anything
 * else falls back to the initials. lucide has no fox, owl or bear, so Refir get a paw print,
 * Uglur the moon they fly under and Birnir the one bear it has.
 */
const CRESTS: { stem: RegExp; icon: LucideIcon }[] = [
  { stem: /^ref/i, icon: PawPrint },
  { stem: /^(ern|örn)/i, icon: Bird },
  { stem: /^ugl/i, icon: Moon },
  { stem: /^(birn|björn|bjarn)/i, icon: Panda },
  { stem: /^sel/i, icon: Fish },
  { stem: /^hrafn/i, icon: Feather },
  { stem: /^(þrum|elding)/i, icon: CloudLightning },
  { stem: /^geimver/i, icon: Rocket },
  { stem: /hetj/i, icon: Zap },
];

export function crestFor(name: string): LucideIcon | null {
  const words = name.split(/\s+/);
  return CRESTS.find(({ stem }) => words.some((word) => stem.test(word)))?.icon ?? null;
}

/** "Fjólublá fljúgandi avókadó svínin" → "FF"; "Hraðbrautarbrúarsmiðirnir" → "H". */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function Crest({ name }: { name: string }) {
  const Icon = crestFor(name);
  return (
    <span className={styles.crest} aria-hidden="true">
      {Icon ? (
        <Icon strokeWidth={2.2} />
      ) : (
        <span className={styles.crestInitials}>{initialsOf(name)}</span>
      )}
    </span>
  );
}

/* ── H3: the ink ── */

/** The calendar stamps' ink, for HTML: the same turbulence, roughness and gaps (Stamp.tsx). */
export function InkFilter({ id }: { id: string }) {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className={styles.inkDefs}>
      <filter id={id} x="-5%" y="-10%" width="110%" height="120%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves={2}
          seed={4}
          result="edge"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="edge"
          scale={INK_ROUGHNESS}
          xChannelSelector="R"
          yChannelSelector="G"
          result="rough"
        />
        <feTurbulence
          type="fractalNoise"
          baseFrequency="2.4"
          numOctaves={1}
          seed={9}
          result="grain"
        />
        <feColorMatrix
          in="grain"
          type="matrix"
          values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4 0 0 0 ${INK_GAPS}`}
          result="speckle"
        />
        <feComposite in="rough" in2="speckle" operator="in" />
      </filter>
    </svg>
  );
}

/** A small tilt from the flokkur's id, so each stamp sits a little differently and stays so. */
function tiltOf(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return ((Math.abs(hash) % 5) - 2) * 0.75;
}

/* ── The head ── */

export function LaneHeader({
  look,
  lane,
  model,
  inkId,
  laneStyle,
}: {
  look: HeaderLook;
  lane: LaneModel;
  model: SplitModel;
  inkId: string;
  laneStyle: CSSProperties;
}) {
  const stamped = look === "stamped";
  const name = (
    <h4
      className={styles.laneName}
      title={lane.name}
      style={
        stamped
          ? ({
              filter: `url(#${inkId})`,
              ["--tilt" as string]: `${tiltOf(lane.patrolId)}deg`,
            } as CSSProperties)
          : undefined
      }
    >
      <span className={styles.laneNameText}>{lane.name}</span>
    </h4>
  );
  const nums = (
    <span className={styles.laneNums}>
      <span className={styles.num} data-lane-total={lane.patrolId}>
        {lane.used} mín
      </span>
      <LaneState lane={lane} model={model} />
    </span>
  );
  return (
    <div className={styles.laneHead} data-look={look} style={laneStyle}>
      {look === "crest" && <Crest name={lane.name} />}
      {look === "crest" ? (
        <div className={styles.crestText}>
          {name}
          {nums}
        </div>
      ) : (
        <>
          {name}
          {nums}
        </>
      )}
    </div>
  );
}

/** "ræður lengd" for the lane that sets the band, "15 mín bið" for one that waits. */
function LaneState({ lane, model }: { lane: LaneModel; model: SplitModel }) {
  if (model.balanced || model.duration === 0) return null;
  if (lane.longest) return <span className={styles.leads}>ræður lengd</span>;
  return <span className={styles.waits}>{lane.idle} mín bið</span>;
}
