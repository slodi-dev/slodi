"use client";

import { useEffect, useState } from "react";
import { useDefaultWorkspaceId } from "@/hooks/useDefaultWorkspaceId";
import { useSeasons, usePlanGrid, usePlanBench, useBlockLibrary } from "@/hooks/usePlan";
import { MOCK_AVAILABLE, useMockMode } from "@/lib/mock/mock-mode";
import MockDataBanner, { type MockReason } from "./MockDataBanner";
import PlanCalendar from "./PlanCalendar";
import PlanGrid from "./PlanGrid";
import SeasonSwitcher from "./SeasonSwitcher";
import BlockPalette from "./bench/BlockPalette";
import PlanBench from "./bench/PlanBench";
import { BenchProvider } from "./bench/BenchProvider";
import styles from "./PlanShell.module.css";

/**
 * Vinnubekkurinn — the plan route (A1, sc-34), laid out as the v5 hi-fi.
 *
 * ## Why the shell is a three-track frame, not a page
 *
 * The design is an application window, not a document: a masthead across the
 * top, the dagskrárbankinn pinned on the left, and one scrolling canvas in the
 * middle that swaps between the three views. That shape is load-bearing rather
 * than cosmetic — assembling a fundur means moving blocks *from* the bank *to*
 * the bench, and a rail that scrolls away with the page cannot be a source you
 * drag from. So the frame owns the viewport height and only `.cv` scrolls.
 *
 * ## One dataset, three views
 *
 * ADR-002 §2 requires the grid (A2) and the month calendar (A4) to be renderings
 * of one dataset rather than separate tools, so they mount inside this shell and
 * read the same `usePlan` query. The bench reads its own fundir — a different
 * shape for a different question, see `plan.service.ts` — but the same season.
 */

/** The hi-fi's three tabs, in its order. Bekkurinn is where the work happens. */
const VIEWS = [
  { id: "bekkur", label: "Bekkurinn", ticket: "B1 (sc-44)" },
  { id: "rist", label: "Rist", ticket: "A2 (sc-37)" },
  { id: "dagatal", label: "Dagatal", ticket: "A4 (sc-39)" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

export default function PlanShell() {
  const workspaceId = useDefaultWorkspaceId();
  // Development only, and loudly labelled — see lib/mock/mock-mode.ts.
  const { mode } = useMockMode();

  // The workspace id resolves in an effect, so counting "not resolved yet" as
  // loading stops the page telling every visitor they have no starfsár before
  // it has asked. It is bounded, though: useDefaultWorkspaceId swallows its
  // failures and returns null for ever, and an unbounded spinner is its own
  // kind of lie.
  const [workspaceTimedOut, setWorkspaceTimedOut] = useState(false);
  useEffect(() => {
    if (workspaceId) return;
    const timer = setTimeout(() => setWorkspaceTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [workspaceId]);

  const {
    seasons,
    isMock: seasonsAreMock,
    isLoading: seasonsLoading,
    error,
  } = useSeasons(workspaceId, {
    // Without a workspace the seasons query never runs, so it can never fail,
    // so auto mode would sit on a spinner instead of standing in for it.
    workspaceUnavailable: workspaceId === null && workspaceTimedOut,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewId>("bekkur");
  /**
   * The bench needs an endpoint that does not exist, so in production it is
   * always empty. Landing there would greet every real leader with an
   * instruction they cannot follow ("kveiktu á gervigögnum") on a build where
   * mock mode cannot be turned on. Fall through to the Rist, which reads from
   * the grid endpoint like the calendar does.
   */
  const [benchWasOffered, setBenchWasOffered] = useState(false);

  const {
    grid,
    isMock: gridIsMock,
    isLoading: gridLoading,
    error: gridError,
  } = usePlanGrid(selectedId);
  const { data: bench, isMock: benchIsMock } = usePlanBench(selectedId);
  const { isMock: libraryIsMock } = useBlockLibrary();

  // Any part can be standing in — the seasons endpoint may exist before the
  // grid one does — and any of them is enough to owe the reader a banner.
  const showingMock = seasonsAreMock || gridIsMock || benchIsMock || libraryIsMock;

  /**
   * Why fixtures are on screen, said accurately.
   *
   * "Bakendinn svarar ekki" is only true when something actually failed. The
   * bench and the bank have no endpoint to fail, so in a normal dev session —
   * where seasons and the grid are answering perfectly well — claiming the
   * backend is down would send someone debugging a service that is fine.
   */
  const mockReason: MockReason =
    mode === "on" ? "forced" : seasonsAreMock || gridIsMock ? "fallback" : "unbuilt";

  // Once fixtures have stood in there is something on screen, so reporting the
  // workspace as missing would be complaining about a problem already worked
  // around.
  const workspaceMissing = !seasonsAreMock && workspaceId === null && workspaceTimedOut;
  const isLoading =
    !seasonsAreMock &&
    ((seasonsLoading && workspaceId !== null) || (!workspaceId && !workspaceMissing));

  // Land on the newest starfsár once seasons arrive, so the route is never a
  // blank chooser when there is an obvious thing to be looking at.
  useEffect(() => {
    if (seasons.length === 0) return;
    // Re-select whenever the current choice is gone, not only when it was never
    // made: refetchOnWindowFocus is on precisely because co-leaders edit in
    // other tabs, so the selected season can vanish under us. It is also what
    // moves the shell off a fixture season the moment the real ones arrive.
    const stillThere = seasons.some((season) => season.id === selectedId);
    if (!stillThere) setSelectedId(seasons[0].id);
  }, [seasons, selectedId]);

  useEffect(() => {
    if (bench) setBenchWasOffered(true);
  }, [bench]);

  // Only redirect once the mode has settled and the bench is definitively
  // absent, so a dev session does not flash the Rist before fixtures arrive.
  const effectiveView: ViewId = view === "bekkur" && !bench && !benchWasOffered ? "rist" : view;

  const selected = seasons.find((s) => s.id === selectedId) ?? null;

  const canvas = (
    <div className={styles.cv} data-view={effectiveView}>
      {isLoading && <p className={styles.muted}>Sæki starfsár…</p>}

      {workspaceMissing && (
        <div className={styles.error} role="alert">
          <strong>Náði ekki í vinnusvæðið.</strong> Dagskráin getur ekki hlaðist án þess — prófaðu
          að endurhlaða síðuna.
        </div>
      )}

      {error && (
        <div className={styles.error} role="alert">
          Náði ekki í starfsárin. Bakendinn gæti verið í smíðum.
          {MOCK_AVAILABLE && (
            <>
              {" "}
              <a href="?mock=1">Skoða viðmótið með gervigögnum</a>.
            </>
          )}
        </div>
      )}

      {!isLoading && !workspaceMissing && !error && seasons.length === 0 && (
        <div className={styles.notice}>
          <h2 className={styles.noticeTitle}>Ekkert starfsár enn</h2>
          {/* Active voice: the reader is the one who will do this. */}
          <p>Þegar þú stofnar starfsár birtist dagskráin hér — vikur, flokkar og fundir.</p>
        </div>
      )}

      {/*
        No aria-live on the section below. It used to wrap the whole canvas,
        which made a screen reader re-read the changed subtree on every reorder
        and every duration nudge — on top of the bench's own purpose-built
        announcement region, which says the one sentence that matters.
      */}
      {selected && (
        <section className={`${styles.viewHost} ${showingMock ? styles.hatched : ""}`}>
          {effectiveView === "bekkur" &&
            (bench ? (
              <PlanBench />
            ) : (
              <p className={styles.muted}>Bekkurinn hefur engan bakenda enn.</p>
            ))}

          {effectiveView !== "bekkur" && (
            <>
              {gridLoading && <p className={styles.muted}>Sæki dagskrána…</p>}

              {gridError && !gridLoading && (
                <div className={styles.error} role="alert">
                  Náði ekki í dagskrána fyrir {selected.name}. Bakendinn gæti verið í smíðum.
                </div>
              )}

              {grid && effectiveView === "rist" && <PlanGrid data={grid} />}
              {grid && effectiveView === "dagatal" && (
                <PlanCalendar key={grid.season_id} data={grid} />
              )}

              {!gridLoading && !grid && !gridError && (
                <p className={styles.muted}>Ekkert skráð á {selected.name} enn.</p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );

  return (
    <div className={styles.wb}>
      <header className={styles.hd}>
        <div className={styles.hdT}>
          <h1 className={styles.title}>Vinnubekkurinn</h1>
          <span className={styles.eyebrow}>
            {selected ? selected.name : "Sameiginlegt heimili dagskrárinnar"}
          </span>
        </div>

        <div className={styles.views} role="group" aria-label="Sýn">
          {VIEWS.map((v) => {
            // Bekkurinn has no endpoint, so on a build where fixtures cannot be
            // turned on it can never render. A feature that is not built yet is
            // absent (docs/ux-conventions.md §9), not a disabled tab whose
            // reason lives only in a tooltip.
            const unavailable = v.id === "bekkur" && !bench && !benchWasOffered;
            if (unavailable) return null;
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={effectiveView === v.id}
                className={`${styles.vbtn} ${effectiveView === v.id ? styles.vbtnOn : ""}`}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            );
          })}
        </div>

        <div className={styles.hdActs}>
          <SeasonSwitcher seasons={seasons} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </header>

      {/*
       * Keyed on whether the bench has data as well as on the season: the
       * provider reads `data` only as a mount-time seed, so a bench that
       * arrives after the key settled — which is what happens the moment
       * usePlanBench grows a real query — would render permanently empty.
       */}
      <BenchProvider
        key={`${selectedId ?? "none"}:${bench ? "loaded" : "empty"}`}
        data={bench ?? { season_id: "", patrols: [], fundir: [] }}
      >
        <BlockPalette />
        {/* A div, not <main>: the shell renders inside the app's own <main>,
            and a second one breaks the landmark rules (axe
            landmark-no-duplicate-main, landmark-main-is-top-level). */}
        <div className={styles.bench}>
          {showingMock && <MockDataBanner reason={mockReason} />}
          {canvas}
        </div>
      </BenchProvider>
    </div>
  );
}
