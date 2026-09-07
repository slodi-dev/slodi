"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/services/users.service";
import {
  CONTENT_TYPE_LABEL,
  REVIEW_STATE_LABEL,
  type ReportQueueItem,
  type ReviewDetail,
  type ReviewFilters,
  type ReviewQueueItem,
  type ReviewState,
  fetchOpenReports,
  fetchReviewDetail,
  fetchReviewQueue,
  resolveReport,
  reviewContent,
  setContentHidden,
} from "@/services/moderation.service";
import { REPORT_REASON_LABEL } from "@/services/reports.service";
import ReviewDetailPane from "./ReviewDetailPane";
import styles from "./yfirferd.module.css";

type Tab = "content" | "reports";
type Action = "approve" | "reject" | "hide" | "unhide";

/**
 * One decision a reviewer can take back. A sweep at one keystroke per item will
 * mis-key sooner or later, and without a way back the only remedy is
 * remembering what the previous state was.
 */
type UndoableAction = { item: ReviewQueueItem; hadBeenHidden: boolean };

/** The views, in the order the segmented control offers them. */
const VIEWS: { id: ReviewState | ""; label: string }[] = [
  { id: "unreviewed", label: REVIEW_STATE_LABEL.unreviewed },
  { id: "approved", label: REVIEW_STATE_LABEL.approved },
  { id: "rejected", label: REVIEW_STATE_LABEL.rejected },
  { id: "", label: "Allt" },
];

export default function YfirferdPage() {
  const { user, getToken, isLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("content");
  const [filters, setFilters] = useState<ReviewFilters>({ review_state: "unreviewed" });
  const [search, setSearch] = useState("");

  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [reports, setReports] = useState<ReportQueueItem[]>([]);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
      const [q, r] = await Promise.all([
        fetchReviewQueue(filters, getToken),
        fetchOpenReports(getToken),
      ]);
      setQueue(q);
      setReports(r);
    } catch {
      setError("Ekki tókst að sækja yfirferðina. Reyndu aftur.");
    } finally {
      setLoading(false);
    }
  }, [filters, getToken]);

  useEffect(() => {
    if (!isLoading && !isModerator) {
      router.replace("/");
      return;
    }
    if (isModerator) void load();
  }, [isLoading, isModerator, load, router]);

  // Debounced, so typing does not fire a request per keystroke.
  useEffect(() => {
    const id = window.setTimeout(
      () => setFilters((f) => ({ ...f, search: search || undefined })),
      300
    );
    return () => window.clearTimeout(id);
  }, [search]);

  const rows: (ReviewQueueItem | ReportQueueItem)[] = tab === "content" ? queue : reports;
  // Clamped rather than reset: acting on the last row should leave the cursor
  // on the new last row, not jump to the top of a fifty-item sweep.
  const index = Math.min(cursor, Math.max(rows.length - 1, 0));
  const active = rows[index];
  const activeContentId =
    tab === "content"
      ? (active as ReviewQueueItem | undefined)?.id
      : (active as ReportQueueItem | undefined)?.content_id;

  useEffect(() => {
    if (active) rowRefs.current[active.id]?.focus();
  }, [active, tab]);

  // The reading pane follows the cursor.
  useEffect(() => {
    if (!activeContentId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetchReviewDetail(activeContentId, getToken)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setDetail(null))
      .finally(() => !cancelled && setDetailLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeContentId, getToken]);

  const act = useCallback(
    async (item: ReviewQueueItem, action: Action) => {
      let note: string | undefined;
      if (action === "reject" || action === "hide") {
        const answer =
          window.prompt(
            action === "reject"
              ? `Af hverju er „${item.name}“ hafnað? Höfundur sér þetta.`
              : `Af hverju er „${item.name}“ falið?`
          ) ?? undefined;
        // A rejection needs a reason — the backend refuses one without.
        if (action === "reject" && !answer?.trim()) return;
        note = answer;
      }
      setBusyId(item.id);
      try {
        if (action === "hide") await setContentHidden(item.id, true, note, getToken);
        else if (action === "unhide") await setContentHidden(item.id, false, note, getToken);
        else
          await reviewContent(
            item.id,
            action === "approve" ? "approved" : "rejected",
            note,
            getToken
          );

        setAnnouncement(
          {
            approve: `„${item.name}“ samþykkt.`,
            reject: `„${item.name}“ hafnað.`,
            hide: `„${item.name}“ falið.`,
            unhide: `„${item.name}“ birt aftur.`,
          }[action]
        );
        setUndoable({ item, hadBeenHidden: item.hidden_at !== null });
        // The row leaves the list only when it no longer matches the view —
        // in the audit views it stays, with its new state.
        if (filters.review_state === "unreviewed") {
          setQueue((q) => q.filter((x) => x.id !== item.id));
        } else {
          void load();
        }
      } catch {
        setAnnouncement(`Ekki tókst að vista ákvörðun um „${item.name}“.`);
      } finally {
        setBusyId(null);
      }
    },
    [getToken, filters.review_state, load]
  );

  const undo = useCallback(async () => {
    if (!undoable) return;
    const { item, hadBeenHidden } = undoable;
    setBusyId(item.id);
    try {
      // Both halves, because hiding also marks something reviewed — undoing one
      // and not the other leaves it out of the queue *and* out of the bank.
      if (!hadBeenHidden) await setContentHidden(item.id, false, undefined, getToken);
      await reviewContent(item.id, "unreviewed", undefined, getToken);
      setAnnouncement(`Afturkallað: „${item.name}“ er aftur í yfirferð.`);
      setUndoable(null);
      if (filters.review_state === "unreviewed") setQueue((q) => [item, ...q]);
      else void load();
    } catch {
      setAnnouncement("Ekki tókst að afturkalla.");
    } finally {
      setBusyId(null);
    }
  }, [undoable, getToken, filters.review_state, load]);

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
      } else if (key === "z" && undoable) {
        event.preventDefault();
        void undo();
      } else if (active && tab === "content") {
        const item = active as ReviewQueueItem;
        if (key === "s") void act(item, "approve");
        else if (key === "h") void act(item, "reject");
        else if (key === "f") void act(item, item.hidden_at ? "unhide" : "hide");
      }
    },
    [rows.length, active, tab, act, undo, undoable]
  );

  if (isLoading || (!isModerator && !user)) return <p className={styles.state}>Hleð…</p>;
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

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Yfirferðarlistar">
          <button
            role="tab"
            aria-selected={tab === "content"}
            className={tab === "content" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => {
              setTab("content");
              setCursor(0);
            }}
          >
            Efni <span className={styles.count}>{queue.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === "reports"}
            className={tab === "reports" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => {
              setTab("reports");
              setCursor(0);
            }}
          >
            Tilkynningar{" "}
            <span
              className={
                reports.some((r) => r.reason === "unsafe")
                  ? `${styles.count} ${styles.countUrgent}`
                  : styles.count
              }
            >
              {reports.length}
            </span>
          </button>
        </div>

        {tab === "content" && (
          <div className={styles.filters}>
            <div className={styles.segmented} role="group" aria-label="Staða">
              {VIEWS.map((v) => (
                <button
                  key={v.id || "all"}
                  aria-pressed={(filters.review_state ?? "unreviewed") === v.id}
                  className={
                    (filters.review_state ?? "unreviewed") === v.id
                      ? `${styles.segment} ${styles.segmentActive}`
                      : styles.segment
                  }
                  onClick={() => {
                    setFilters((f) => ({ ...f, review_state: v.id }));
                    setCursor(0);
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <label className={styles.searchLabel}>
              <span className="sl-sr-only">Leita eftir heiti</span>
              <input
                className={styles.search}
                type="search"
                placeholder="Leita eftir heiti…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={!!filters.reported}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, reported: e.target.checked || undefined }));
                  setCursor(0);
                }}
              />
              Aðeins tilkynnt
            </label>
          </div>
        )}
      </div>

      <p className={styles.live} role="status" aria-live="polite">
        {announcement}
        {undoable && (
          <button className={styles.undoBtn} onClick={() => void undo()}>
            Afturkalla
          </button>
        )}
      </p>

      {error && (
        <p className={styles.error} role="alert">
          {error}{" "}
          <button className={styles.linkBtn} onClick={() => void load()}>
            Reyna aftur
          </button>
        </p>
      )}

      <div className={styles.split}>
        <div className={styles.listPane}>
          {loading && <p className={styles.state}>Hleð…</p>}
          {!loading && !error && rows.length === 0 && (
            <p className={styles.empty}>
              {tab === "reports"
                ? "Engar opnar tilkynningar."
                : filters.review_state === "unreviewed"
                  ? "Ekkert bíður yfirferðar. Vel gert."
                  : "Ekkert efni passar við þessa síu."}
            </p>
          )}

          <ul className={styles.list}>
            {tab === "content"
              ? queue.map((item, i) => (
                  <ListRow
                    key={item.id}
                    id={item.id}
                    focused={i === index}
                    urgent={item.open_report_reasons.includes("unsafe")}
                    registerRef={(el) => (rowRefs.current[item.id] = el)}
                    onSelect={() => setCursor(i)}
                    label={`${item.name}, eftir ${item.author_name}`}
                    title={item.name}
                    line={`${CONTENT_TYPE_LABEL[item.content_type]} · ${item.author_name}`}
                    stamp={new Date(item.created_at).toLocaleDateString("is-IS", {
                      day: "numeric",
                      month: "short",
                    })}
                    flags={[
                      item.open_report_count > 0
                        ? `${item.open_report_count} tilkynning${item.open_report_count === 1 ? "" : "ar"}`
                        : null,
                      item.hidden_at ? "Falið" : null,
                      // Only once there is a decision behind the name — a
                      // stale reviewer on an unreviewed item reads as done.
                      item.review_state !== "unreviewed" && item.reviewed_by_name
                        ? `${REVIEW_STATE_LABEL[item.review_state]} · ${item.reviewed_by_name}`
                        : null,
                    ]}
                  />
                ))
              : reports.map((report, i) => (
                  <ListRow
                    key={report.id}
                    id={report.id}
                    focused={i === index}
                    urgent={report.reason === "unsafe"}
                    registerRef={(el) => (rowRefs.current[report.id] = el)}
                    onSelect={() => setCursor(i)}
                    label={`Tilkynning um ${report.content_name}`}
                    title={report.content_name}
                    line={REPORT_REASON_LABEL[report.reason]}
                    stamp={new Date(report.created_at).toLocaleDateString("is-IS", {
                      day: "numeric",
                      month: "short",
                    })}
                    flags={[report.content_author_name]}
                  />
                ))}
          </ul>
        </div>

        <div className={styles.detailPane}>
          <ReviewDetailPane
            detail={detail}
            loading={detailLoading}
            busy={busyId !== null}
            onAct={(action) => {
              if (!detail) return;
              void act(detail as ReviewQueueItem, action);
            }}
          />
          {tab === "reports" && active && (
            <div className={styles.reportActions}>
              {/* Labelled, because two unlabelled action rows leave a reviewer
                  guessing which one closes the report and which one judges the
                  content. They are different decisions. */}
              <span className={styles.actionsLabel}>Tilkynningin</span>
              <button
                className={styles.approve}
                disabled={busyId !== null}
                onClick={() => void closeReport(active as ReportQueueItem, "resolved")}
              >
                Afgreitt
              </button>
              <button
                className={styles.reject}
                disabled={busyId !== null}
                onClick={() => void closeReport(active as ReportQueueItem, "dismissed")}
              >
                Fella niður
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/** One row of the left rail — enough to choose what to read, no more. */
function ListRow({
  id,
  focused,
  urgent,
  registerRef,
  onSelect,
  label,
  title,
  line,
  stamp,
  flags,
}: {
  id: string;
  focused: boolean;
  urgent: boolean;
  registerRef: (el: HTMLElement | null) => void;
  onSelect: () => void;
  label: string;
  title: string;
  line: string;
  stamp: string;
  flags: (string | null)[];
}) {
  const shown = useMemo(() => flags.filter(Boolean) as string[], [flags]);
  return (
    <li
      ref={registerRef}
      id={id}
      tabIndex={focused ? 0 : -1}
      aria-current={focused}
      aria-label={label}
      onClick={onSelect}
      onFocus={onSelect}
      className={[styles.row, focused && styles.rowFocused, urgent && styles.rowUrgent]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.rowTop}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowStamp}>{stamp}</span>
      </div>
      <p className={styles.rowLine}>{line}</p>
      {shown.length > 0 && (
        <p className={styles.rowFlags}>
          {shown.map((f) => (
            <span key={f} className={styles.rowFlag}>
              {f}
            </span>
          ))}
        </p>
      )}
    </li>
  );
}
