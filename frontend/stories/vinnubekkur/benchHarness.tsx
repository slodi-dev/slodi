/**
 * Shared set-up for the Vinnubekkur stories (`Components/Vinnubekkur/…`).
 *
 * Every piece of the bench reads one reducer through `BenchProvider`, so a
 * sheet, a row, an editor or a split grid rendered on its own still needs the
 * provider (for the drag context) and the state (so a click actually changes
 * something). The harnesses below render one piece from live bench state; the
 * data is the mock-mode fixtures in `lib/mock/*.mock.ts`, transformed where a
 * story needs a particular state.
 */
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { mocked } from "storybook/test";
import { BenchProvider, useBench } from "@/components/plan/bench/BenchProvider";
import FundurSheet from "@/components/plan/bench/FundurSheet";
import LidurEditor from "@/components/plan/bench/LidurEditor";
import LidurRow from "@/components/plan/bench/LidurRow";
import SplitGrid from "@/components/plan/bench/SplitGrid";
import {
  benchReducer,
  initialBenchState,
  startTimes,
  type BenchIntent,
} from "@/components/plan/bench/benchState";
import { dragId } from "@/components/plan/bench/dnd";
import { mockBench } from "@/lib/mock/bench.mock";
import { useMockMode, type MockMode } from "@/lib/mock/mock-mode";
import { MOCK_SCRATCHPAD_ID, MOCK_SEASON_ID } from "@/lib/mock/plan.mock";
import { BAND_OF, type BandId, type Fundur, type PlanBenchData } from "@/services/plan.service";
import styles from "@/components/plan/bench/bench.module.css";

/** Fixture fundir, by what each one shows (see lib/mock/bench.mock.ts). */
export const FUNDUR = {
  /** Two weeks ago, everything confirmed. */
  pastRefir: "mock-fundur-0",
  /** Last week, troop-wide, 120 / 105 mín. */
  pastSveit: "mock-fundur-1",
  /** This week: 100 / 90 mín · 10 yfir. */
  overTime: "mock-fundur-2",
  /** Next week, one liður still undecided. */
  nextUglur: "mock-fundur-3",
  /** The útilega, 245 / 240 mín. */
  utilega: "mock-fundur-4",
  /** A bare skeleton: two undecided liðir. */
  skeleton: "mock-fundur-5",
} as const;

/**
 * Set the plan's mock mode for a story. `.storybook/preview.tsx` spies on the
 * module, so this holds in `npm run storybook`, in the story tests and in the
 * production build the visual baselines come from.
 */
export function mockModeIs(mode: MockMode) {
  mocked(useMockMode).mockReturnValue({ mode, settled: true });
}

/** The dated fixture season's bench. */
export function benchData(seasonId: string = MOCK_SEASON_ID): PlanBenchData {
  return mockBench(seasonId);
}

/** The undated scratchpad: every fundur reads "Ódagsett". */
export function undatedBenchData(): PlanBenchData {
  return mockBench(MOCK_SCRATCHPAD_ID);
}

/** The fixture after a run of intents, through the real reducer. */
export function afterIntents(data: PlanBenchData, intents: BenchIntent[]): PlanBenchData {
  return intents.reduce(benchReducer, initialBenchState(data)).data;
}

/** The fixture with the kjarni of one fundur split across the flokkar. */
export function splitBenchData(fundurId: string = FUNDUR.overTime): PlanBenchData {
  return afterIntents(benchData(), [{ t: "splitBand", fundurId, band: "kjarni" }]);
}

/** One fundur and its liðir with long Icelandic names, to test wrapping. */
export function longTextBenchData(): PlanBenchData {
  const data = benchData();
  return {
    ...data,
    fundir: data.fundir.map((fundur) =>
      fundur.event_id === FUNDUR.overTime
        ? {
            ...fundur,
            title: "Undirbúningsfundur flokksforingjaráðs vegna landsmótsþátttöku",
            theme: "Skyndihjálparþjálfun og sjúkrakassaundirbúningur",
            venue: "Skátamiðstöðin í Hraunbæjarhverfinu",
            items: fundur.items.map((item, i) =>
              i === 1
                ? {
                    ...item,
                    name: "Endurlífgunaræfingar með æfingabrúðum og sáraumbúðaþjálfun í litlum hópum",
                    endurmat:
                      "Krakkarnir vildu meiri tíma með brúðunum — skiptum hópnum í tvennt næst.",
                  }
                : item
            ),
          }
        : fundur
    ),
  };
}

/** A fundur from data, or throw: a story whose fixture moved should fail loudly. */
export function fundurIn(data: PlanBenchData, fundurId: string): Fundur {
  const fundur = data.fundir.find((f) => f.event_id === fundurId);
  if (!fundur) throw new Error(`No fundur ${fundurId} in the fixture`);
  return fundur;
}

const noop = () => undefined;

/** Dispatch UI intents once on mount — an open editor, a selected block. */
function Replay({ intents }: { intents: BenchIntent[] }) {
  const bench = useBench();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !bench) return;
    done.current = true;
    intents.forEach(bench.dispatch);
  }, [bench, intents]);
  return null;
}

/**
 * BenchProvider seeded with `data`, around one piece of the bench. `intents`
 * set UI state the data cannot carry (which editor is open, what is selected).
 */
export function Bench({
  data,
  intents = [],
  children,
}: {
  data: PlanBenchData;
  intents?: BenchIntent[];
  children: ReactNode;
}) {
  return (
    <BenchProvider data={data}>
      <Replay intents={intents} />
      {children}
    </BenchProvider>
  );
}

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

/** One FundurSheet, from live bench state. */
export function LiveSheet({ fundurId, isPast = false }: { fundurId: string; isPast?: boolean }) {
  const bench = useBench();
  const focusSibling = useCallback((id: string, delta: -1 | 1) => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-lidur-row]"));
    const at = nodes.findIndex((node) => node.dataset.lidurRow === id);
    if (at >= 0) nodes[at + delta]?.focus();
  }, []);
  if (!bench) return null;
  const { state, dispatch } = bench;
  const fundur = fundurIn(state.data, fundurId);
  return (
    <>
      <Announcer />
      <FundurSheet
        fundur={fundur}
        patrols={state.data.patrols}
        otherFundir={state.data.fundir.filter((f) => f.event_id !== fundurId)}
        isActive={state.active === fundurId}
        isPast={isPast}
        selected={state.selected}
        grabbed={state.grabbed}
        editing={state.editing}
        laneSelected={state.laneSelected}
        dispatch={dispatch}
        registerRow={noop}
        focusSibling={focusSibling}
      />
    </>
  );
}

/** One LidurRow inside its band's list, from live bench state. */
export function LiveRow({
  fundurId,
  lidurId,
  selected = false,
}: {
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
  if (!lidur) throw new Error(`No liður ${lidurId} on ${fundurId}`);
  const band = fundur.items.filter((item) => BAND_OF[item.kind] === BAND_OF[lidur.kind]);
  const positionInBand = band.indexOf(lidur);
  return (
    <>
      <Announcer />
      <SortableContext items={[dragId.row(lidur.id)]} strategy={verticalListSortingStrategy}>
        <div role="list">
          <LidurRow
            fundur={fundur}
            lidur={lidur}
            index={index}
            canMoveUp={positionInBand > 0}
            canMoveDown={positionInBand < band.length - 1}
            isEditing={state.editing === lidur.id}
            startsAt={startTimes(fundur)[index]}
            isSelected={selected || state.selected === lidur.id}
            isGrabbed={state.grabbed === lidur.id}
            dispatch={dispatch}
            registerRow={noop}
            focusSibling={noop}
          />
        </div>
      </SortableContext>
    </>
  );
}

/** One LidurEditor, open, from live bench state. Closing it leaves a note. */
export function LiveEditor({
  fundurId,
  lidurId,
  alone = false,
}: {
  fundurId: string;
  lidurId: string;
  /** No other fundir to move it to — "Færa í fund…" is disabled. */
  alone?: boolean;
}) {
  const bench = useBench();
  if (!bench) return null;
  const { state, dispatch } = bench;
  const fundur = fundurIn(state.data, fundurId);
  const index = fundur.items.findIndex((item) => item.id === lidurId);
  const lidur = fundur.items[index];
  if (state.editing !== lidurId || !lidur) return <p>Ritill lokaður.</p>;
  return (
    // The editor is a listitem of its band's list.
    <div role="list">
      <LidurEditor
        fundur={fundur}
        otherFundir={alone ? [] : state.data.fundir.filter((f) => f.event_id !== fundurId)}
        lidur={lidur}
        position={index + 1}
        total={fundur.items.length}
        startsAt={startTimes(fundur)[index]}
        dispatch={dispatch}
        onClose={() => dispatch({ t: "edit", id: null })}
      />
    </div>
  );
}

/** One split band's SplitGrid, from live bench state. */
export function LiveSplit({ fundurId, band }: { fundurId: string; band: BandId }) {
  const bench = useBench();
  if (!bench) return null;
  const { state, dispatch } = bench;
  return (
    <>
      <Announcer />
      <SplitGrid
        fundur={fundurIn(state.data, fundurId)}
        band={band}
        patrols={state.data.patrols}
        selected={state.laneSelected}
        dispatch={dispatch}
      />
    </>
  );
}
