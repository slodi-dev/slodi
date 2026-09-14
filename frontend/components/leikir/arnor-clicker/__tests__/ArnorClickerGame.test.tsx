import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, act } from "@testing-library/react";

// The game is client-only and leans on Auth0, next/image and the scores API.
// None of those are what these tests are about, so they get the smallest stubs
// that keep the component mounting.
vi.mock("@auth0/nextjs-auth0", () => ({ useUser: () => ({ user: null }) }));
vi.mock("next/image", () => ({
  default: ({ src, alt, ...rest }: { src: string; alt: string; [k: string]: unknown }) => {
    // next/image props that mean nothing to a bare <img>.
    delete rest.priority;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...rest} />;
  },
}));

import ArnorClickerGame from "../ArnorClickerGame";
import { WORKERS, CHAIRS, COMBO_BASE, signSave, prestigeBonusPct } from "../gameData";

const SAVE_KEY = "arnor_clicker_save_v2";

/** Seed a saved game so a test can start from a state deep in the run. */
function seed(over: Partial<Record<string, unknown>> = {}) {
  const counts = WORKERS.map(() => 0);
  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify({
      v: 1,
      score: 0,
      run: 0,
      counts,
      ups: [],
      tsCur: 0,
      tsTot: 0,
      things: 0,
      at: Date.now(), // "just now", so no offline-earnings modal appears
      chairs: ["arnor"],
      chair: "arnor",
      ...over,
    })
  );
}

const thingTab = () => screen.getByRole("button", { name: "Þing" });
const upgradeTab = () => screen.getByRole("button", { name: "Uppfærslur" });
/** The chair card for a fundarstjóri, found via its name heading. */
const chairCard = (name: string) =>
  screen.getByText(name, { selector: "span" }).closest("button") as HTMLButtonElement;
/** The value of a labelled row in the "Þín þing" board — the numbers repeat
 *  across the panel, so they only mean anything next to their own label. */
const stat = (label: string) =>
  screen.getByText(label).closest("li")!.querySelectorAll("span")[1]!.textContent;

describe("ArnorClickerGame", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) }))
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  // ── fundarstjórar ──────────────────────────────────────────────────────────
  describe("fundarstjórar", () => {
    it("lists every chair with its flavour text and Arnór active by default", () => {
      seed();
      render(<ArnorClickerGame />);
      fireEvent.click(thingTab());

      for (const c of CHAIRS) {
        expect(screen.getByText(c.flavour)).toBeInTheDocument();
      }
      expect(within(chairCard("Arnór")).getByText("Virkur")).toBeInTheDocument();
      expect(within(chairCard("Aron")).getByText(/Þingstig/)).toBeInTheDocument();
    });

    it("a chair you cannot afford is not buyable", () => {
      seed({ tsCur: 10, tsTot: 10 }); // Aron costs 50
      render(<ArnorClickerGame />);
      fireEvent.click(thingTab());

      const aron = chairCard("Aron");
      expect(aron).toBeDisabled();
      fireEvent.click(aron);
      expect(within(aron).queryByText("Virkur")).not.toBeInTheDocument();
    });

    it("buying a chair spends the Þingstig and makes it the active fundarstjóri", () => {
      seed({ tsCur: 100, tsTot: 100 });
      render(<ArnorClickerGame />);
      fireEvent.click(thingTab());

      fireEvent.click(chairCard("Aron"));

      expect(within(chairCard("Aron")).getByText("Virkur")).toBeInTheDocument();
      expect(within(chairCard("Arnór")).getByText("Velja")).toBeInTheDocument();
      // 100 - 50, and the permanent boost falls with it, along the √ curve.
      expect(stat("Óeydd Þingstig — á töflunni")).toBe("50");
      expect(stat("Varanleg uppörvun")).toBe(
        `+${Math.round(prestigeBonusPct(50)).toLocaleString("is-IS")}%`
      );
    });

    it("switching back to a chair you already own is free", () => {
      seed({ tsCur: 100, tsTot: 100, chairs: ["arnor", "aron"], chair: "aron" });
      render(<ArnorClickerGame />);
      fireEvent.click(thingTab());

      fireEvent.click(chairCard("Arnór"));

      expect(within(chairCard("Arnór")).getByText("Virkur")).toBeInTheDocument();
      expect(stat("Óeydd Þingstig — á töflunni")).toBe("100"); // nothing spent
    });

    it("persists the chair roster so a reload keeps who you bought", () => {
      seed({ tsCur: 100, tsTot: 100 });
      render(<ArnorClickerGame />);
      fireEvent.click(thingTab());
      fireEvent.click(chairCard("Aron"));

      const saved = JSON.parse(localStorage.getItem(SAVE_KEY)!);
      expect(saved.chairs).toContain("aron");
      expect(saved.chair).toBe("aron");
    });

    it("puts the active fundarstjóri on the pedestal", () => {
      seed({ chairs: ["arnor", "aron"], chair: "aron" });
      render(<ArnorClickerGame />);
      expect(screen.getByAltText("Aron fundarstjóri")).toBeInTheDocument();
      expect(screen.queryByAltText("Arnór fundarstjóri")).not.toBeInTheDocument();
    });
  });

  // ── samfella (Aron's combo) ────────────────────────────────────────────────
  describe("samfella", () => {
    const tapArnor = () => fireEvent.pointerDown(screen.getByRole("button", { name: /^Smella á/ }));
    // Aron's chair card is titled "Samfella" too, so the chip needs the ×.
    const comboChip = /Samfella ×/;

    it("builds on consecutive clicks under a combo chair", () => {
      seed({ chairs: ["arnor", "aron"], chair: "aron" });
      render(<ArnorClickerGame />);

      tapArnor();
      expect(screen.getByText(`1/${COMBO_BASE.cap}`)).toBeInTheDocument();
      tapArnor();
      tapArnor();
      expect(screen.getByText(`3/${COMBO_BASE.cap}`)).toBeInTheDocument();
    });

    it("never builds under Arnór, whose ability is the goldens instead", () => {
      seed();
      render(<ArnorClickerGame />);

      tapArnor();
      tapArnor();
      expect(screen.queryByText(comboChip)).not.toBeInTheDocument();
    });

    it("drops back to nothing once the click window lapses", () => {
      // The combo window is measured on performance.now() (monotonic, so the
      // system clock can't stretch it), which vitest does not fake by default.
      vi.useFakeTimers({
        shouldAdvanceTime: true,
        toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"],
      });
      try {
        seed({ chairs: ["arnor", "aron"], chair: "aron" });
        render(<ArnorClickerGame />);

        tapArnor();
        expect(screen.getByText(comboChip)).toBeInTheDocument();

        // The 120ms display tick is what notices the lapse, so give it both the
        // window and a tick to run in — inside act(), or React never flushes
        // the state update the interval queues.
        act(() => {
          vi.advanceTimersByTime(COMBO_BASE.window + 300);
        });
        expect(screen.queryByText(comboChip)).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it("is cleared when you hand the meeting to another fundarstjóri", () => {
      seed({ chairs: ["arnor", "aron"], chair: "aron" });
      render(<ArnorClickerGame />);

      tapArnor();
      expect(screen.getByText(comboChip)).toBeInTheDocument();

      fireEvent.click(thingTab());
      fireEvent.click(chairCard("Arnór"));
      expect(screen.queryByText(comboChip)).not.toBeInTheDocument();
    });
  });

  // ── offline earnings hardening ─────────────────────────────────────────────
  // The reported cheat: quit, wind the device clock forward, come back rich.
  describe("away-time", () => {
    /** A save with real production, written `agoMs` before the server's now. */
    const producing = (agoMs: number, serverNow: number) => {
      const counts = WORKERS.map(() => 0);
      counts[2] = 50; // Kaffipása, 8/sek each
      return { counts, at: serverNow - agoMs, score: 1e6, run: 1e6 };
    };
    /** Sign a seeded save so the game will vouch for it. */
    const signed = (over: Record<string, unknown>) => {
      seed(over);
      const { sig, ...rest } = JSON.parse(localStorage.getItem(SAVE_KEY)!);
      void sig; // whatever seed() wrote is replaced by a matching signature
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...rest, sig: signSave(rest) }));
    };
    /** Serve `date` on the HEAD the game uses to read the server clock. */
    const serverClock = (date: number) =>
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ date: new Date(date).toUTCString() }),
            json: () => Promise.resolve([]),
          })
        )
      );

    it("pays out for time the server agrees has passed", async () => {
      const now = Date.now();
      serverClock(now);
      signed(producing(60 * 60 * 1000, now)); // an honest hour away
      render(<ArnorClickerGame />);

      expect(await screen.findByText("Á meðan þú varst í burtu")).toBeInTheDocument();
    });

    it("pays nothing when only the device clock ran forward", async () => {
      const serverTime = Date.now();
      serverClock(serverTime);
      // The device thinks it is a week later, so the save looks a week old to
      // it — but the server says the save was written moments ago.
      signed(producing(-7 * 24 * 3600 * 1000, serverTime));
      render(<ArnorClickerGame />);

      // Give the clock fetch a chance to resolve before asserting absence.
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.queryByText("Á meðan þú varst í burtu")).not.toBeInTheDocument();
    });

    it("pays nothing on a save it cannot vouch for", async () => {
      const now = Date.now();
      serverClock(now);
      seed(producing(60 * 60 * 1000, now)); // seeded without a signature
      render(<ArnorClickerGame />);

      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.queryByText("Á meðan þú varst í burtu")).not.toBeInTheDocument();
    });
  });

  // ── upgrade shop ───────────────────────────────────────────────────────────
  describe("uppfærslur", () => {
    /** A save rich enough to afford anything the shop will offer it. */
    const rich = (over: Record<string, unknown> = {}) => {
      const counts = WORKERS.map(() => 0);
      return { score: 1e7, run: 1e7, counts, ...over };
    };

    it("hides an upgrade whose worker requirement is not met", () => {
      seed(rich());
      render(<ArnorClickerGame />);
      fireEvent.click(upgradeTab());

      expect(screen.queryByText("Kjörbréfin yfirfarin")).not.toBeInTheDocument();
    });

    it("offers it once enough of that worker are owned", () => {
      const counts = WORKERS.map(() => 0);
      counts[0] = 10; // Þingfulltrúi tier 1 unlocks at 10
      seed(rich({ counts }));
      render(<ArnorClickerGame />);
      fireEvent.click(upgradeTab());

      expect(screen.getByText("Kjörbréfin yfirfarin")).toBeInTheDocument();
    });

    it("only shows the ability upgrades of the chair currently sitting", () => {
      seed(rich({ chairs: ["arnor", "aron"], chair: "arnor" }));
      render(<ArnorClickerGame />);
      fireEvent.click(upgradeTab());

      expect(screen.getByText("Gljáfægður fundarhamar")).toBeInTheDocument(); // Arnór
      expect(screen.queryByText("Taktur í salnum")).not.toBeInTheDocument(); // Aron
    });

    it("swaps the ability tree when the fundarstjóri changes", () => {
      seed(rich({ chairs: ["arnor", "aron"], chair: "arnor" }));
      render(<ArnorClickerGame />);

      fireEvent.click(thingTab());
      fireEvent.click(chairCard("Aron"));
      fireEvent.click(upgradeTab());

      expect(screen.getByText("Taktur í salnum")).toBeInTheDocument();
      expect(screen.queryByText("Gljáfægður fundarhamar")).not.toBeInTheDocument();
    });

    it("buying an upgrade removes it from the shop and counts it as earned", () => {
      seed(rich());
      render(<ArnorClickerGame />);
      fireEvent.click(upgradeTab());

      expect(screen.getByText("0")).toBeInTheDocument(); // áunnar uppfærslur
      fireEvent.click(screen.getByText("Ristabrauð handa Arnóri").closest("button")!);

      expect(screen.queryByText("Ristabrauð handa Arnóri")).not.toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).ups).toContain("ristabraud");
    });

    it("shows what an upgrade does, not just its flavour", () => {
      seed(rich());
      render(<ArnorClickerGame />);
      fireEvent.click(upgradeTab());

      const card = within(screen.getByText("Ristabrauð handa Arnóri").closest("button")!);
      expect(card.getByText("×2 smellikraftur")).toBeInTheDocument();
      expect(card.getByText("Fundarstjóri á fastandi maga afgreiðir ekkert.")).toBeInTheDocument();
    });
  });
});
