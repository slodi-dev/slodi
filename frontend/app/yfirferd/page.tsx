"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/services/users.service";
import {
  CONTENT_TYPE_LABEL,
  type ReportQueueItem,
  type ReviewQueueItem,
  fetchOpenReports,
  fetchReviewQueue,
  resolveReport,
  reviewContent,
  setContentHidden,
} from "@/services/moderation.service";
import { REPORT_REASON_LABEL } from "@/services/reports.service";
import styles from "./yfirferd.module.css";

type Tab = "unreviewed" | "reports";

/**
 * One decision a reviewer can take back.
 *
 * A sweep at one keystroke per item will mis-key sooner or later, and without a
 * way back the only remedy is remembering what the previous state was. Only the
 * most recent is undoable — anything more needs a history nobody asked for.
 */
type UndoableAction = {
  item: ReviewQueueItem;
  message: string;
};

export default function YfirferdPage() {
  const { user, getToken, isLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("unreviewed");
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [reports, setReports] = useState<ReportQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [undoable, setUndoable] = useState<UndoableAction | null>(null);
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});

  const isModerator = hasPermission(user?.permissions, "moderator");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [q, r] = await Promise.all([fetchReviewQueue(getToken), fetchOpenReports(getToken)]);
      setQueue(q);
      setReports(r);
    } catch {
      setError("Ekki tókst að sækja yfirferðina. Reyndu aftur.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoading && !isModerator) {
      router.replace("/");
      return;
    }
    if (isModerator) void load();
  }, [isLoading, isModerator, load, router]);

  const rows = tab === "unreviewed" ? queue : reports;
  // Clamp rather than reset: acting on the last row should leave the cursor on
  // the new last row, not jump back to the top of a fifty-item sweep.
  const active = rows[Math.min(cursor, Math.max(rows.length - 1, 0))];

  useEffect(() => {
    if (active) rowRefs.current[activeKey(active)]?.focus();
  }, [active, tab]);

  const act = useCallback(
    async (item: ReviewQueueItem, action: "approve" | "reject" | "hide") => {
      let note: string | undefined;
      if (action !== "approve") {
        const prompt =
          action === "reject"
            ? `Af hverju er „${item.name}“ hafnað? Höfundur sér þetta.`
            : `Af hverju er „${item.name}“ falið?`;
        const answer = window.prompt(prompt) ?? undefined;
        // A rejection needs a reason — the backend refuses one without.
        if (action === "reject" && !answer?.trim()) return;
        note = answer;
      }
      setBusyId(item.id);
      try {
        if (action === "hide") await setContentHidden(item.id, true, note, getToken);
        else
          await reviewContent(
            item.id,
            action === "approve" ? "approved" : "rejected",
            note,
            getToken
          );
        setQueue((q) => q.filter((x) => x.id !== item.id));
        const message =
          action === "approve"
            ? `„${item.name}“ samþykkt.`
            : action === "reject"
              ? `„${item.name}“ hafnað.`
              : `„${item.name}“ falið.`;
        setAnnouncement(message);
        setUndoable({ item, message });
      } catch {
        setAnnouncement(`Ekki tókst að vista ákvörðun um „${item.name}“.`);
      } finally {
        setBusyId(null);
      }
    },
    [getToken]
  );

  const undo = useCallback(async () => {
    if (!undoable) return;
    const { item } = undoable;
    setBusyId(item.id);
    try {
      // Both halves, because hiding also marks something reviewed — undoing one
      // and not the other would leave it out of the queue *and* out of the bank.
      if (item.hidden_at === null) await setContentHidden(item.id, false, undefined, getToken);
      await reviewContent(item.id, "unreviewed", undefined, getToken);
      setQueue((q) => [item, ...q]);
      setAnnouncement(`Afturkallað: „${item.name}“ er aftur í yfirferð.`);
      setUndoable(null);
    } catch {
      setAnnouncement("Ekki tókst að afturkalla.");
    } finally {
      setBusyId(null);
    }
  }, [undoable, getToken]);

  const closeReport = useCallback(
    async (report: ReportQueueItem, status: "resolved" | "dismissed") => {
      setBusyId(report.id);
      try {
        await resolveReport(report.id, status, undefined, getToken);
        setReports((rs) => rs.filter((x) => x.id !== report.id));
        setAnnouncement(status === "resolved" ? "Tilkynning afgreidd." : "Tilkynning felld niður.");
      } catch {
        setAnnouncement("Ekki tókst að loka tilkynningunni.");
      } finally {
        setBusyId(null);
      }
    },
    [getToken]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Never steal a key from someone typing.
      const el = event.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return;

      const key = event.key.toLowerCase();
      if (key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((c) => Math.min(c + 1, rows.length - 1));
      } else if (key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (active && tab === "unreviewed") {
        const item = active as ReviewQueueItem;
        if (key === "s") void act(item, "approve");
        else if (key === "h") void act(item, "reject");
        else if (key === "f") void act(item, "hide");
      }
      if (key === "z" && undoable) {
        event.preventDefault();
        void undo();
      }
    },
    [rows.length, active, tab, act, undo, undoable]
  );

  if (isLoading || (!isModerator && !user)) {
    return <p className={styles.state}>Hleð…</p>;
  }
  if (!isModerator) {
    return <p className={styles.state}>Þessi síða er fyrir Dagskrárstjórnarteymið.</p>;
  }

  return (
    <main className={styles.page} onKeyDown={onKeyDown}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Yfirferð</h1>
          <p className={styles.subtitle}>
            Efni sem enginn hefur enn litið á, og það sem hefur verið tilkynnt.
          </p>
        </div>
        <p className={styles.shortcuts} aria-hidden="true">
          <kbd>j</kbd>/<kbd>k</kbd> hreyfa · <kbd>s</kbd> samþykkja · <kbd>h</kbd> hafna ·{" "}
          <kbd>f</kbd> fela · <kbd>z</kbd> afturkalla
        </p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Yfirferðarlistar">
        <Tab
          id="unreviewed"
          label="Óyfirfarið"
          count={queue.length}
          active={tab}
          onSelect={() => {
            setTab("unreviewed");
            setCursor(0);
          }}
        />
        <Tab
          id="reports"
          label="Tilkynningar"
          count={reports.length}
          active={tab}
          urgent={reports.some((r) => r.reason === "unsafe")}
          onSelect={() => {
            setTab("reports");
            setCursor(0);
          }}
        />
      </div>

      <p className={styles.live} role="status" aria-live="polite">
        {announcement}
        {undoable && (
          <button className={styles.undoBtn} onClick={() => void undo()}>
            Afturkalla
          </button>
        )}
      </p>

      {loading && <p className={styles.state}>Hleð…</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}{" "}
          <button className={styles.linkBtn} onClick={() => void load()}>
            Reyna aftur
          </button>
        </p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className={styles.empty}>
          {tab === "unreviewed"
            ? "Ekkert bíður yfirferðar. Vel gert."
            : "Engar opnar tilkynningar."}
        </p>
      )}

      {!loading && !error && tab === "unreviewed" && (
        <ul className={styles.list}>
          {queue.map((item, i) => (
            <ReviewRow
              key={item.id}
              item={item}
              focused={i === Math.min(cursor, queue.length - 1)}
              busy={busyId === item.id}
              onAct={act}
              registerRef={(el) => (rowRefs.current[item.id] = el)}
            />
          ))}
        </ul>
      )}

      {!loading && !error && tab === "reports" && (
        <ul className={styles.list}>
          {reports.map((report, i) => (
            <ReportRow
              key={report.id}
              report={report}
              focused={i === Math.min(cursor, reports.length - 1)}
              busy={busyId === report.id}
              onClose={closeReport}
              registerRef={(el) => (rowRefs.current[report.id] = el)}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function activeKey(item: ReviewQueueItem | ReportQueueItem) {
  return item.id;
}

function Tab({
  id,
  label,
  count,
  active,
  urgent,
  onSelect,
}: {
  id: Tab;
  label: string;
  count: number;
  active: Tab;
  urgent?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      role="tab"
      aria-selected={active === id}
      className={active === id ? `${styles.tab} ${styles.tabActive}` : styles.tab}
      onClick={onSelect}
    >
      {label}
      <span className={urgent ? `${styles.count} ${styles.countUrgent}` : styles.count}>
        {count}
      </span>
    </button>
  );
}

function ReviewRow({
  item,
  focused,
  busy,
  onAct,
  registerRef,
}: {
  item: ReviewQueueItem;
  focused: boolean;
  busy: boolean;
  onAct: (item: ReviewQueueItem, action: "approve" | "reject" | "hide") => void;
  registerRef: (el: HTMLElement | null) => void;
}) {
  const submitted = useMemo(
    () => new Date(item.created_at).toLocaleDateString("is-IS", { dateStyle: "medium" }),
    [item.created_at]
  );

  return (
    <li
      ref={registerRef}
      tabIndex={focused ? 0 : -1}
      className={focused ? `${styles.row} ${styles.rowFocused}` : styles.row}
      aria-label={`${item.name}, eftir ${item.author_name}`}
    >
      <div className={styles.rowMain}>
        <p className={styles.meta}>
          <span className={styles.type}>{CONTENT_TYPE_LABEL[item.content_type]}</span>
          <span>eftir {item.author_name}</span>
          <span>{submitted}</span>
          {item.open_report_count > 0 && (
            <span className={styles.reportFlag}>
              {item.open_report_count} tilkynning{item.open_report_count === 1 ? "" : "ar"}:{" "}
              {item.open_report_reasons.map((r) => REPORT_REASON_LABEL[r].toLowerCase()).join(", ")}
            </span>
          )}
          {item.author_strikes > 0 && (
            <span
              className={styles.strikes}
              title="Efni eftir sama höfund sem hefur verið falið eða hafnað"
            >
              {item.author_strikes} áminning{item.author_strikes === 1 ? "" : "ar"} áður
            </span>
          )}
        </p>
        <h2 className={styles.name}>
          <Link href={`/programs/${item.id}`} className={styles.nameLink}>
            {item.name}
          </Link>
        </h2>
        {item.description && <p className={styles.body}>{item.description}</p>}
        {item.instructions && (
          <p className={styles.instructions}>
            {/* Labelled, because unlabelled it reads as a second sentence of the
                description and a reviewer cannot tell what they are judging. */}
            <span className={styles.fieldLabel}>Leiðbeiningar</span>
            {item.instructions}
          </p>
        )}
      </div>

      <div className={styles.actions}>
        <button className={styles.approve} disabled={busy} onClick={() => onAct(item, "approve")}>
          Samþykkja
        </button>
        <button className={styles.reject} disabled={busy} onClick={() => onAct(item, "reject")}>
          Hafna
        </button>
        <button className={styles.hide} disabled={busy} onClick={() => onAct(item, "hide")}>
          Fela
        </button>
      </div>
    </li>
  );
}

function ReportRow({
  report,
  focused,
  busy,
  onClose,
  registerRef,
}: {
  report: ReportQueueItem;
  focused: boolean;
  busy: boolean;
  onClose: (report: ReportQueueItem, status: "resolved" | "dismissed") => void;
  registerRef: (el: HTMLElement | null) => void;
}) {
  const unsafe = report.reason === "unsafe";
  return (
    <li
      ref={registerRef}
      tabIndex={focused ? 0 : -1}
      className={[styles.row, focused && styles.rowFocused, unsafe && styles.rowUrgent]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.rowMain}>
        <p className={styles.meta}>
          <span className={unsafe ? styles.reasonUrgent : styles.reason}>
            {REPORT_REASON_LABEL[report.reason]}
          </span>
          <span>
            {new Date(report.created_at).toLocaleDateString("is-IS", { dateStyle: "medium" })}
          </span>
        </p>
        <h2 className={styles.name}>
          <Link href={`/programs/${report.content_id}`} className={styles.nameLink}>
            {report.content_name}
          </Link>
        </h2>
        <p className={styles.byline}>eftir {report.content_author_name}</p>
        {report.note ? (
          <p className={styles.body}>„{report.note}“</p>
        ) : (
          <p className={styles.bodyMuted}>Engin skýring gefin.</p>
        )}
      </div>

      <div className={styles.actions}>
        <button
          className={styles.approve}
          disabled={busy}
          onClick={() => onClose(report, "resolved")}
        >
          Afgreitt
        </button>
        <button
          className={styles.reject}
          disabled={busy}
          onClick={() => onClose(report, "dismissed")}
        >
          Fella niður
        </button>
      </div>
    </li>
  );
}
