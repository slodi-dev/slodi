"use client";

/**
 * Stamp kit: the rubber-stamp language of the Stimplar calendar, for any lab that should look
 * the same (the PlanGrid lab reuses it).
 *
 * Exports:
 * - `Stamp`: one stamp in SVG, `size` sm (phone mark) | md (a cell) | lg (a list row) | xl.
 *   Decorative (`aria-hidden`): the element it sits in must say the state in words.
 * - `stampStateOf`, `StampState`, `STAMP_STATES`: the six states (staðfest, drög, óvíst,
 *   óákveðið, lokið, fellur niður). Past and cancelled override the planning status.
 * - `STAMP_MEANING`: each state's name and what it looks like, in Icelandic, for keys.
 * - `STAMP_PICTURES`, `stampIcon`: the theme/type pictures a pressed stamp carries.
 * - `rotationFor(id)`: a stamp's fixed tilt, −9° … +6°, the same on every render.
 * - `RhythmLegend`: the "Fundir vikunnar" line (each flokkur's usual weekday and time).
 *
 * The thunk (a press, a settle and a ring of ink) is CSS on the staðfest state, so it plays
 * when a stamp mounts or turns staðfest and never on a re-render; off under reduced motion.
 * Colours are tokens only; the stamp's ink is `color`, so a parent can recolour it.
 *
 *   <Stamp entry={{ id, status, type, theme, past, cancelled }} size="md" />
 */
import { useId, type CSSProperties } from "react";
import {
  Anchor,
  ClipboardList,
  Compass,
  Flag,
  Flame,
  Footprints,
  HeartHandshake,
  Mountain,
  PartyPopper,
  Tent,
  TentTree,
  TreePine,
  type LucideIcon,
} from "lucide-react";
import {
  STATUS_LABEL,
  type EventType,
  type Patrol,
  type PlanStatus,
} from "@/services/plan.service";
import { cn } from "@/lib/util";
import kit from "./stampKit.module.css";

/** What a stamp needs to know about its fundur. */
export type StampSubject = {
  id: string;
  status: PlanStatus;
  type: EventType;
  theme?: string | null;
  past?: boolean;
  cancelled?: boolean;
};

/* ── What a stamp shows ── */

/**
 * The stamp's state. Status for what is still to come; past and cancelled override it, because
 * once a fundur is over (or off) how decided it was no longer matters.
 */
export type StampState = PlanStatus | "past" | "cancelled";

export const STAMP_STATES: StampState[] = [
  "confirmed",
  "draft",
  "tentative",
  "unknown",
  "past",
  "cancelled",
];

export function stampStateOf(
  entry: Pick<StampSubject, "status" | "cancelled" | "past">
): StampState {
  if (entry.cancelled) return "cancelled";
  if (entry.past) return "past";
  return entry.status;
}

/** The word on the stamp's band, at sizes where a band fits. */
const BAND: Record<StampState, string | null> = {
  confirmed: "KLÁRT",
  draft: "DRÖG",
  tentative: "ÓVÍST",
  unknown: null,
  past: "LOKIÐ",
  cancelled: "FELLUR NIÐUR",
};

/** What each state means, in words: the Key and the Stamp states story. */
export const STAMP_MEANING: Record<StampState, { name: string; looks: string }> = {
  confirmed: {
    name: STATUS_LABEL.confirmed,
    looks: "Stimplað: blek, tvöfaldur rammi, hallar aðeins. Tilbúinn fundur.",
  },
  draft: {
    name: STATUS_LABEL.draft,
    looks: "Strikaður rammi, táknið dregið með blýanti. Dagskráin er til, ekki staðfest.",
  },
  tentative: {
    name: STATUS_LABEL.tentative,
    looks: "Punktalína, daufur blýantur og „?“. Hugmynd, ekki ákveðin.",
  },
  unknown: {
    name: STATUS_LABEL.unknown,
    looks: "Tómur punktakassi með „?“. Hér á eftir að koma fundur.",
  },
  past: { name: "Lokið", looks: "Lítill, fölur stimpill. Fundurinn er búinn." },
  cancelled: { name: "Fellur niður", looks: "Yfirstrikaður stimpill. Fundurinn fellur niður." },
};

const THEME_ICON: Record<string, LucideIcon> = {
  Útilíf: TreePine,
  Ratleikni: Compass,
  Hreyfing: Footprints,
  Sjómennska: Anchor,
  Hefðir: Flame,
  Umhyggja: HeartHandshake,
};

const TYPE_ICON: Record<EventType, LucideIcon> = {
  flokks: Flag,
  sveitar: Flag,
  skipulags: ClipboardList,
  utilega: Tent,
  dagsferd: Mountain,
  mot: TentTree,
  uppskeru: PartyPopper,
};

/** The theme and type pictures, for the Key. */
export const STAMP_PICTURES: { label: string; icon: LucideIcon; by: "þema" | "gerð" }[] = [
  ...Object.entries(THEME_ICON).map(([label, icon]) => ({ label, icon, by: "þema" as const })),
  { label: "Útilega", icon: Tent, by: "gerð" },
  { label: "Dagsferð", icon: Mountain, by: "gerð" },
  { label: "Mót", icon: TentTree, by: "gerð" },
  { label: "Sveitarfundur", icon: Flag, by: "gerð" },
  { label: "Skipulagsfundur", icon: ClipboardList, by: "gerð" },
  { label: "Uppskeruhátíð", icon: PartyPopper, by: "gerð" },
];

/** A flokksfundur stamps its theme; anything else stamps its type. */
export function stampIcon(entry: Pick<StampSubject, "type" | "theme">): LucideIcon {
  if (entry.type === "flokks" && entry.theme && THEME_ICON[entry.theme]) {
    return THEME_ICON[entry.theme];
  }
  return TYPE_ICON[entry.type];
}

/**
 * Each fundur's own tilt, from its id: the same on every render and in every view, different
 * from its neighbours, so a stamped month looks hand-stamped rather than tiled. −9° … +6°.
 */
export function rotationFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return (hash % 16) - 9;
}

/* ── The stamp ── */

export type StampSize = "sm" | "md" | "lg" | "xl";

/** Bands only fit from `lg`; below that the frame, icon and "?" carry the state. */
const HAS_BAND: Record<StampSize, boolean> = { sm: false, md: false, lg: true, xl: true };

/** How far the ink edge wanders, in the stamp's 48-unit space. */
const INK_ROUGHNESS = 0.9;
/** The speckle threshold: closer to 0 leaves fewer gaps in the ink. */
const INK_GAPS = -0.55;

export interface StampProps {
  entry: StampSubject;
  size?: StampSize;
}

/**
 * One rubber stamp, drawn in SVG. Decorative: every entry's accessible name says its state.
 *
 * - Every stamp, in every state and size, is inked the same way: one SVG filter over the whole
 *   stamp (turbulence → displacement, and a finer noise as a speckle mask). It works in the
 *   stamp's own 48-unit space, so a small stamp is exactly as rough as a big one. Kept mild
 *   (INK_ROUGHNESS, INK_GAPS) so the band's word and the "?" stay readable. No images, and the
 *   colour is a token.
 * - The thunk is a CSS animation on the pressed state: it runs when the stamp first mounts or
 *   when its state turns to staðfest, never on a re-render.
 */
export function Stamp({ entry, size = "md" }: StampProps) {
  const filterId = useId();
  const state = stampStateOf(entry);
  const Icon = stampIcon(entry);
  const band = HAS_BAND[size] ? BAND[state] : null;
  const pressed = state === "confirmed" || state === "past" || state === "cancelled";
  const iconY = band ? 8 : 13;
  return (
    <span
      className={cn(kit.stamp, kit[`stamp_${size}`])}
      data-state={state}
      style={{ "--rot": `${pressed ? rotationFor(entry.id) : 0}deg` } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" width="100%" height="100%" overflow="visible">
        <defs>
          <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
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
        </defs>
        <g filter={`url(#${filterId})`}>
          <g className={kit.frame}>
            <rect className={kit.outer} x="2" y="2" width="44" height="44" rx="5" />
            {pressed && <rect className={kit.inner} x="6" y="6" width="36" height="36" rx="3" />}
            {band && pressed && (
              <rect className={kit.bandFill} x="6" y="32" width="36" height="10" />
            )}
          </g>
          {state !== "unknown" && (
            <Icon
              className={kit.icon}
              x={14}
              y={iconY}
              width={20}
              height={20}
              strokeWidth={state === "draft" || state === "tentative" ? 1.75 : 2.4}
            />
          )}
          {(state === "unknown" || state === "tentative") && (
            <text
              className={kit.question}
              x={state === "unknown" ? 24 : 38}
              y={state === "unknown" ? (band ? 26 : 32) : 15}
              textAnchor="middle"
            >
              ?
            </text>
          )}
          {state === "cancelled" && <path className={kit.strike} d="M7 41 41 7M7 7l34 34" />}
          {band && (
            <text
              className={cn(kit.bandText, pressed && kit.bandKnockout)}
              x="24"
              y="39.6"
              textAnchor="middle"
              textLength={band.length > 6 ? 34 : undefined}
              lengthAdjust="spacingAndGlyphs"
            >
              {band}
            </text>
          )}
        </g>
      </svg>
    </span>
  );
}

/* ── Fundir vikunnar ── */

export type RhythmRule = { patrol: Patrol; weekday: number; clock: string };

const WEEKDAY_SHORT = ["mán", "þri", "mið", "fim", "fös", "lau", "sun"];

/**
 * The weekly rhythm in one line, "Fundir vikunnar: R Refir mán 17:30 · …", so the cells do not
 * repeat each flokkur's time. `weekday` is 0 = mánudagur.
 */
export function RhythmLegend({ rules }: { rules: RhythmRule[] }) {
  if (rules.length === 0) return null;
  return (
    <div className={kit.rhythm}>
      <span className={kit.rhythmLabel}>Fundir vikunnar</span>
      <ul className={kit.rhythmList}>
        {rules.map((r) => {
          const accent = r.patrol.accent ?? "adrir";
          return (
            <li key={r.patrol.id} className={kit.rhythmItem}>
              <span
                className={kit.rhythmChip}
                style={
                  {
                    "--pc": `var(--sl-color-patrol-${accent})`,
                    "--pc-fg": `var(--sl-color-patrol-${accent}-foreground)`,
                  } as CSSProperties
                }
                aria-hidden="true"
              >
                {r.patrol.name.charAt(0)}
              </span>
              {r.patrol.name} {WEEKDAY_SHORT[r.weekday]} {r.clock}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
