/**
 * The head of a flokkur's column: H6, the flokkur's ringed crest hanging from a cord in its colour
 * that runs down the column's edge, over a faint wash of the colour (see the MDX), or the old pill
 * for reference. Both looks carry the same
 * things: the name as a real heading (`h4`, under the band's `h3`), the column's total and whether
 * it sets the band's length or waits. Only the look changes; the rule itself is drawn by the
 * column (`.lane`, `data-header` on the root), so it lines up with the crest from below.
 *
 * Long names wrap to two lines at most, hyphenated by the browser's Icelandic dictionary where
 * it has one (`lang="is"` on the band) and broken anywhere as a last resort for a compound with
 * nowhere to break; past two lines they end in "…". The full name stays the heading's text, so
 * a screen reader hears all of it, and it is the tooltip.
 */
import type { CSSProperties } from "react";
import { crestFor, initialsOf } from "./crestMarks";
import type { LaneModel, SplitModel } from "./labBench";
import styles from "./SplitGridLab.module.css";

import type { HeaderLook } from "./headerLooks";

export type { HeaderLook };

/** The flokkur's ringed crest. `size` is the badge's diameter (the head's own is 2.75rem). */
export function Crest({ name, size }: { name: string; size?: string }) {
  const Icon = crestFor(name);
  return (
    <span
      className={styles.crest}
      aria-hidden="true"
      data-small={size ? true : undefined}
      style={size ? ({ ["--crest" as string]: size } as CSSProperties) : undefined}
    >
      {Icon ? <Icon /> : <span className={styles.crestInitials}>{initialsOf(name)}</span>}
    </span>
  );
}

/* ── The head ── */

export function LaneHeader({
  look,
  lane,
  model,
  laneStyle,
}: {
  look: HeaderLook;
  lane: LaneModel;
  model: SplitModel;
  laneStyle: CSSProperties;
}) {
  const name = (
    <h4 className={styles.laneName} title={lane.name}>
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
  if (look === "pill") {
    return (
      <div className={styles.laneHead} data-look={look} style={laneStyle}>
        {name}
        {nums}
      </div>
    );
  }
  return (
    <div className={styles.laneHead} data-look={look} style={laneStyle}>
      <span className={styles.cord} aria-hidden="true" />
      <Crest name={lane.name} />
      <div className={styles.crestText}>
        {name}
        {nums}
      </div>
    </div>
  );
}

/** "ræður lengd" for the lane that sets the band, "15 mín bið" for one that waits. */
function LaneState({ lane, model }: { lane: LaneModel; model: SplitModel }) {
  if (model.balanced || model.duration === 0) return null;
  if (lane.longest) return <span className={styles.leads}>ræður lengd</span>;
  return <span className={styles.waits}>{lane.idle} mín bið</span>;
}
