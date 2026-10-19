"use client";

import styles from "./MockDataBanner.module.css";

/**
 * The label on mock mode.
 *
 * Mock data is only safe if it is impossible to mistake for real data, and the
 * failure mode is specific: someone screenshots a view, the fake dagskrá ends
 * up in a thread, and a leader believes their term is already planned. So the
 * banner is sticky rather than a one-line note at the top — it stays on screen
 * while you scroll the grid, which is where the screenshot gets taken.
 *
 * The mock seasons also carry "GERVIGÖGN" in their own names, so even a crop
 * that loses this banner keeps the label.
 */
export type MockReason =
  /** `?mock=1` — fixtures pinned regardless of what the API says. */
  | "forced"
  /** An endpoint that exists answered with an error, so fixtures stood in. */
  | "fallback"
  /** No endpoint exists yet at all — the bench and the bank are both in this state. */
  | "unbuilt";

export default function MockDataBanner({ reason }: { reason: MockReason }) {
  return (
    <div className={styles.banner}>
      <span className={styles.tag}>GERVIGÖGN</span>
      <p className={styles.text}>
        {reason === "fallback" ? (
          <>
            Bakendinn svarar ekki fyrir starfsár, svo viðmótið sýnir{" "}
            <strong>tilbúin sýnigögn</strong>. Um leið og API-ið svarar birtast raunveruleg gögn
            sjálfkrafa — ekkert þarf að slökkva.
          </>
        ) : reason === "unbuilt" ? (
          <>
            Bekkurinn og dagskrárbankinn hafa engan bakenda enn, svo þeir sýna{" "}
            <strong>tilbúin sýnigögn</strong>. Starfsár og dagskrárhringur koma úr API-inu.
          </>
        ) : (
          <>
            Kveikt með <code>?mock=1</code>: viðmótið sýnir <strong>tilbúin sýnigögn</strong> þótt
            API-ið kunni að svara.
          </>
        )}
      </p>
      {/* A full page load, not a router push: it has to clear the cached mock
          queries as well as the session flag, and reloading does both. */}
      <a className={styles.off} href="?mock=0">
        {reason === "fallback" ? "Sýna villuna í staðinn" : "Slökkva"}
      </a>
    </div>
  );
}
