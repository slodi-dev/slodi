import Link from "next/link";

import { ROUTES } from "@/constants/routes";
import styles from "./not-found.module.css";

/**
 * The site-wide fallback for any URL that matches no route.
 *
 * Slóði had no root `not-found.tsx`, so every unknown path fell through to the
 * Next.js default — an unstyled, English "This page could not be found." The
 * only 404 the project ever had was `app/programs/[id]/not-found.tsx`, removed
 * in 8ad53e8 as unused, and it only ever covered a missing Dagskrá.
 *
 * This renders inside `ConditionalLayout`, which means it appears under the
 * marketing header for an unknown top-level path and inside the dashboard
 * sidebar for something like `/programs/does-not-exist`. It therefore sizes
 * itself from its content instead of claiming the viewport, so it sits
 * correctly in both frames.
 */
export default function NotFound() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/*
          Decorative: the heading below carries the same meaning in words. A
          screen reader announcing "404" before it would only be noise.
        */}
        <p className={styles.code} aria-hidden="true">
          404
        </p>

        {/*
          Same voice as `ProgramDetailError`, which is the 404 the project
          already had: a scout-themed line first, then a plain one that says
          what actually happened. The heading carries the meaning rather than
          the "404" above it, so it is the `h1`.
        */}
        <h1 className={styles.title}>Úps! Fórstu út fyrir slóðann?</h1>

        <p className={styles.message}>
          Þessi síða finnst ekki. Hún gæti hafa verið færð, eða hlekkurinn er úreltur.
        </p>

        <div className={styles.actions}>
          <Link href={ROUTES.HOME} className={styles.primaryAction}>
            Heim á svæðið
          </Link>
          <Link href={ROUTES.PROGRAMS} className={styles.secondaryAction}>
            Í dagskrárbankann
          </Link>
        </div>
      </div>
    </div>
  );
}
