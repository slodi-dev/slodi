"use client";

import type { ReactNode } from "react";

import {
  formatAgeGroup,
  formatDuration,
  formatIcelandicDate,
  formatParticipants,
  formatPrepTime,
  formatPrice,
  getAgeGroupPatrol,
} from "@/lib/format";
import { cn } from "@/lib/util";
import type { Program } from "@/services/programs.service";

import styles from "../efnissida.module.css";

const Icon = {
  clock: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  hourglass: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 3h10" />
      <path d="M7 21h10" />
      <path d="M8 3v3.2c0 1.5 4 3.6 4 5.8s-4 4.3-4 5.8V21" />
      <path d="M16 3v3.2c0 1.5-4 3.6-4 5.8s4 4.3 4 5.8V21" />
    </svg>
  ),
  users: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 6a3 3 0 0 1 0 6" />
    </svg>
  ),
  pin: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  person: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  ),
  price: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <text
        x="12"
        y="12"
        textAnchor="middle"
        dominantBaseline="central"
        stroke="none"
        fill="currentColor"
        fontSize="9.5"
        fontWeight="600"
      >
        kr.
      </text>
    </svg>
  ),
};

const REVIEW_LABEL: Record<string, string> = {
  unreviewed: "Bíður yfirferðar",
  approved: "Samþykkt",
  rejected: "Ekki samþykkt",
};

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className={styles.fact}>
      {icon}
      <div>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  );
}

/**
 * The short facts a leader decides on, and the item's provenance.
 *
 * **An absent fact is omitted, never rendered as „—".** Six rows of dashes
 * tell the reader nothing and push the real values off the first screen. If
 * every fact is missing the panel disappears entirely and the sections move
 * up.
 *
 * Author and date live here rather than under the title: who made it and when
 * is reference material, the same class of fact as duration and cost.
 */
export default function ItemFacts({
  program,
  onReport,
  onPrint,
  typeLabel,
}: {
  program: Program;
  onReport?: () => void;
  onPrint?: () => void;
  /** Accusative form for the print label — „Prenta verkefnið". */
  typeLabel: string;
}) {
  const duration = formatDuration(
    program.duration_min ?? undefined,
    program.duration_max ?? undefined
  );
  const prep = formatPrepTime(
    program.prep_time_min ?? undefined,
    program.prep_time_max ?? undefined
  );
  const participants = formatParticipants(
    program.count_min ?? undefined,
    program.count_max ?? undefined
  );
  const ages = program.age ?? [];

  const facts: ReactNode[] = [];
  if (duration) {
    facts.push(
      <Fact key="duration" icon={Icon.clock} label="Lengd, að lágmarki" value={duration} />
    );
  }
  if (prep)
    facts.push(<Fact key="prep" icon={Icon.hourglass} label="Undirbúningur" value={prep} />);
  if (ages.length) {
    facts.push(
      <Fact
        key="age"
        icon={Icon.users}
        label="Aldur"
        value={
          <div className={styles.ages}>
            {ages.map((age) => (
              <span
                key={age}
                className={styles.age}
                style={
                  {
                    "--ef-patrol": `var(--sl-color-patrol-${getAgeGroupPatrol(age) ?? "adrir"})`,
                  } as React.CSSProperties
                }
              >
                {formatAgeGroup(age)}
              </span>
            ))}
          </div>
        }
      />
    );
  }
  if (program.location) {
    facts.push(<Fact key="loc" icon={Icon.pin} label="Staðsetning" value={program.location} />);
  }
  if (participants) {
    facts.push(
      <Fact key="count" icon={Icon.person} label="Fjöldi þátttakenda" value={participants} />
    );
  }
  if (program.price !== null && program.price !== undefined) {
    facts.push(
      <Fact key="price" icon={Icon.price} label="Verð" value={formatPrice(program.price)} />
    );
  }

  const hasFacts = facts.length > 0;

  return (
    <div className={styles.facts}>
      {hasFacts && (
        <>
          <p className={styles.factsTitle}>Upplýsingar</p>
          <dl>{facts}</dl>
          <div className={styles.divider} />
        </>
      )}

      <div className={styles.meta}>
        <span>
          Höfundur: <strong>{program.author_name || program.author?.name || "Óþekktur"}</strong>
        </span>
        <span>Stofnað: {formatIcelandicDate(program.created_at)}</span>
      </div>

      {/*
        Present only for the item's own author and for moderators — the server
        strips it for everyone else. Without it a leader whose submission was
        rejected or hidden has no way to find out: the item simply stops
        appearing.

        Only the rejection is coloured. Waiting is not a warning and approval is
        not a prize; the rejection is the one the author has to act on.
      */}
      {program.review_state && (
        <div
          className={cn(
            styles.review,
            program.review_state === "rejected" && styles.reviewRejected
          )}
        >
          <span className={styles.reviewState}>{REVIEW_LABEL[program.review_state]}</span>
          {program.review_note && <p className={styles.reviewNote}>{program.review_note}</p>}
        </div>
      )}

      <div className={styles.asideActions}>
        {onPrint && (
          <button type="button" className={cn(styles.asideBtn, styles.printBtn)} onClick={onPrint}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 9V4h10v5" />
              <rect x="4" y="9" width="16" height="7" rx="1.5" />
              <path d="M7 16h10v4H7z" />
            </svg>
            Prenta {typeLabel}
          </button>
        )}
        {onReport && (
          <button type="button" className={styles.asideBtn} onClick={onReport}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 21V4" />
              <path d="M6 4.5h12l-2.8 4.2L18 13H6z" />
            </svg>
            Tilkynna efni
          </button>
        )}
      </div>
    </div>
  );
}
