/**
 * Live bench state for the FundurSheet lab, so every button, key and drag in a
 * look goes through the real BenchProvider and reducer.
 *
 * The shared Vinnubekkur harness (`stories/vinnubekkur/benchHarness.tsx`)
 * supplies the provider and the fixtures; this file adds the two things a
 * PlanBench gives a sheet that the harness's LiveSheet does not: focus that
 * follows a grabbed row across a move, and the alternating live regions.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useBench } from "@/components/plan/bench/BenchProvider";
import { startTimes } from "@/components/plan/bench/benchState";
import { dragId } from "@/components/plan/bench/dnd";
import { BAND_OF, type PlanBenchData } from "@/services/plan.service";
import {
  Bench,
  FUNDUR,
  afterIntents,
  benchData,
  fundurIn,
  splitBenchData,
  undatedBenchData,
} from "@/stories/vinnubekkur/benchHarness";
import FundurSheetLab from "./FundurSheetLab";
import LidurRowLab from "./LidurRowLab";
import type { FundurSheetLook } from "./sheetModel";
import styles from "./FundurSheetLab.module.css";

export type SheetFixture = "normal" | "overTime" | "undecided" | "split" | "undated" | "past";

/** The liður every reorder test moves, and the one it overtakes. */
export const REORDER = { moved: "mock-lidur-2-2", overtaken: "mock-lidur-2-1" } as const;

/**
 * One fixture per state the sheet has to draw. `normal` is this week's fundur
 * with Kortalestur cut to 25 minutes, so it fits its 90 exactly.
 */
const FIXTURES: Record<
  SheetFixture,
  { data: () => PlanBenchData; fundurId: string; isPast?: boolean }
> = {
  normal: {
    data: () =>
      afterIntents(benchData(), [
        { t: "duration", fundurId: FUNDUR.overTime, id: REORDER.moved, minutes: 25 },
      ]),
    fundurId: FUNDUR.overTime,
  },
  overTime: { data: () => benchData(), fundurId: FUNDUR.overTime },
  undecided: { data: () => benchData(), fundurId: FUNDUR.skeleton },
  split: { data: () => splitBenchData(), fundurId: FUNDUR.overTime },
  undated: { data: () => undatedBenchData(), fundurId: FUNDUR.overTime },
  past: { data: () => benchData(), fundurId: FUNDUR.pastRefir, isPast: true },
};

/** The bench's two alternating live regions, as PlanBench renders them. */
function Announcer() {
  const bench = useBench();
  const announcement = bench?.state.announcement ?? { text: "", seq: 0 };
  return (
    <>
      <p aria-live="polite" className={styles.srOnly} data-bench-announcer>
        {announcement.seq % 2 === 0 ? announcement.text : ""}
      </p>
      <p aria-live="polite" className={styles.srOnly} data-bench-announcer>
        {announcement.seq % 2 === 1 ? announcement.text : ""}
      </p>
    </>
  );
}

/** One lab sheet from live bench state, with PlanBench's focus handling. */
function LiveSheetLab({
  look,
  fundurId,
  isPast,
  labelSuffix,
}: {
  look: FundurSheetLook;
  fundurId: string;
  isPast: boolean;
  labelSuffix?: string;
}) {
  const bench = useBench();
  const rows = useRef(new Map<string, HTMLDivElement>());
  const registerRow = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) rows.current.set(id, node);
    else rows.current.delete(id);
  }, []);
  const focusSibling = useCallback((id: string, delta: -1 | 1) => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-lidur-row]"));
    const at = nodes.findIndex((node) => node.dataset.lidurRow === id);
    if (at >= 0) nodes[at + delta]?.focus();
  }, []);

  // Focus follows a grabbed block to its new place (PlanBench does the same).
  const grabbed = bench?.state.grabbed ?? null;
  const data = bench?.state.data;
  useEffect(() => {
    if (grabbed) rows.current.get(grabbed)?.focus();
  }, [grabbed, data]);

  if (!bench) return null;
  const { state, dispatch } = bench;
  return (
    <>
      <Announcer />
      <FundurSheetLab
        look={look}
        labelSuffix={labelSuffix}
        fundur={fundurIn(state.data, fundurId)}
        patrols={state.data.patrols}
        otherFundir={state.data.fundir.filter((f) => f.event_id !== fundurId)}
        isActive={state.active === fundurId}
        isPast={isPast}
        selected={state.selected}
        grabbed={state.grabbed}
        editing={state.editing}
        laneSelected={state.laneSelected}
        dispatch={dispatch}
        registerRow={registerRow}
        focusSibling={focusSibling}
      />
    </>
  );
}

export interface SheetLabDemoProps {
  look: FundurSheetLook;
  fixture: SheetFixture;
  /** Appended to the sheet's name, when several sheets of one fundur share a page. */
  labelSuffix?: string;
}

/** A lab sheet on its own bench, seeded from a fixture. */
export function SheetLabDemo({ look, fixture, labelSuffix }: SheetLabDemoProps) {
  const f = FIXTURES[fixture];
  // Built once: the provider only reads its initial data anyway.
  const [data] = useState(f.data);
  return (
    <Bench data={data}>
      <LiveSheetLab
        look={look}
        fundurId={f.fundurId}
        isPast={f.isPast ?? false}
        labelSuffix={labelSuffix}
      />
    </Bench>
  );
}

/** One lab row, inside a one-item list in a sheet frame, from live bench state. */
export function LiveRowLab({
  look,
  fundurId,
  lidurId,
  selected = false,
}: {
  look: FundurSheetLook;
  fundurId: string;
  lidurId: string;
  selected?: boolean;
}) {
  const bench = useBench();
  if (!bench) return null;
  const { state, dispatch } = bench;
  const fundur = fundurIn(state.data, fundurId);
  const index = fundur.items.findIndex((item) => item.id === lidurId);
  const lidur = fundur.items[index];
  if (!lidur) return <p>Liður fjarlægður.</p>;
  const band = fundur.items.filter((item) => BAND_OF[item.kind] === BAND_OF[lidur.kind]);
  const positionInBand = band.indexOf(lidur);
  return (
    <RowFrame look={look}>
      <SortableContext items={[dragId.row(lidur.id)]} strategy={verticalListSortingStrategy}>
        <LidurRowLab
          look={look}
          fundur={fundur}
          lidur={lidur}
          index={index}
          canMoveUp={positionInBand > 0}
          canMoveDown={positionInBand < band.length - 1}
          isEditing={false}
          startsAt={startTimes(fundur)[index]}
          isSelected={selected || state.selected === lidur.id}
          isGrabbed={state.grabbed === lidur.id}
          dispatch={dispatch}
          registerRow={() => undefined}
          focusSibling={() => undefined}
        />
      </SortableContext>
    </RowFrame>
  );
}

/** A sheet's frame around rows shown on their own, so they get its tokens and width. */
function RowFrame({ look, children }: { look: FundurSheetLook; children: ReactNode }) {
  return (
    <div className={styles.sheet} data-look={look}>
      <div role="list" className={styles.rows}>
        {children}
      </div>
    </div>
  );
}

export { Bench, FUNDUR, benchData };
