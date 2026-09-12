"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/util";

import styles from "../efnissida.module.css";

export type HeroImage = { url: string; alt: string };

/**
 * The item's pictures, as one frame you step through.
 *
 * Placement is the point: this sits *inside* the main column, below the title,
 * never above the breadcrumb. A 320px band above the title is exactly what the
 * old page did, and it pushed the title ~460px down a 784px viewport on the
 * majority of items — most submissions have no picture at all.
 *
 * So: **nothing renders when there are no images.** Not a placeholder, not a
 * grey box, not an icon in a frame. Making the common case look broken is
 * worse than having no picture.
 *
 * With exactly one image — which is all the data model stores today — the
 * arrows and the counter are absent too, because there is nowhere to go. The
 * carousel is built for N so it is ready when the model carries a set.
 */
export default function ItemHero({
  images,
  index,
  onIndexChange,
}: {
  images: HeroImage[];
  index: number;
  onIndexChange: (next: number) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [announced, setAnnounced] = useState("");

  const count = images.length;
  const clamped = Math.max(0, Math.min(count - 1, index));
  const current = images[clamped];

  useEffect(() => {
    if (count > 1 && current) setAnnounced(`Mynd ${clamped + 1} af ${count}. ${current.alt}`);
  }, [clamped, count, current]);

  if (count === 0 || !current) return null;

  /*
   * No wrap-around. The set has a first and a last image and the controls say
   * so: prev is absent on the first, next on the last. Hidden rather than
   * disabled, because a dead arrow still invites the click.
   */
  const atStart = clamped === 0;
  const atEnd = clamped === count - 1;

  function step(delta: number) {
    onIndexChange(Math.max(0, Math.min(count - 1, clamped + delta)));
  }

  return (
    <div
      className={styles.hero}
      ref={frameRef}
      tabIndex={count > 1 ? 0 : -1}
      role={count > 1 ? "group" : undefined}
      aria-roledescription={count > 1 ? "myndaflakk" : undefined}
      aria-label={count > 1 ? "Myndir efnisins" : undefined}
      onKeyDown={(e) => {
        if (count < 2) return;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          step(-1);
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          step(1);
        }
      }}
    >
      <div className={styles.media}>
        {/*
          Content images are Azure blob URLs and `next.config.ts` only allows
          that one host through the optimiser. Anything else would throw at
          render, so unoptimized is the safe default for author-supplied URLs.
        */}
        <Image
          src={current.url}
          alt={current.alt}
          fill
          sizes="(max-width: 1079px) 100vw, 760px"
          unoptimized
        />
      </div>

      {count > 1 && (
        <>
          {!atStart && (
            <button
              type="button"
              className={cn(styles.navBtn, styles.navPrev)}
              onClick={() => step(-1)}
              aria-label="Fyrri mynd"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14.5 5.5 8 12l6.5 6.5" />
              </svg>
            </button>
          )}
          {!atEnd && (
            <button
              type="button"
              className={cn(styles.navBtn, styles.navNext)}
              onClick={() => step(1)}
              aria-label="Næsta mynd"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9.5 5.5 16 12l-6.5 6.5" />
              </svg>
            </button>
          )}
          {/* A carousel with no count hides how much there is — the one
              complaint the tabs it replaced had earned. */}
          <p className={styles.count}>
            {clamped + 1} / {count}
          </p>
          <span aria-live="polite" className={styles.srOnly}>
            {announced}
          </span>
        </>
      )}
    </div>
  );
}
