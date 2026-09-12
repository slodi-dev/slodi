"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/services/users.service";
import {
  ALL_STATES,
  CONTENT_TYPE_LABEL,
  REVIEW_STATE_LABEL,
  type ReportQueueItem,
  type ReviewDetail,
  type ReviewCommentVisibility,
  type ReviewFilters,
  type ReviewQueueItem,
  type ReviewState,
  addReviewComment,
  fetchOpenReports,
  fetchReviewDetail,
  fetchReviewQueue,
  resolveReport,
  reviewContent,
  setContentHidden,
} from "@/services/moderation.service";
import { REPORT_REASON_LABEL } from "@/services/reports.service";
import ReviewDetailPane from "./ReviewDetailPane";
import QueueProgress from "./QueueProgress";
import QueueEmpty from "./QueueEmpty";
import styles from "./yfirferd.module.css";
import { cn } from "@/lib/util";
import { formatIcelandicDateShort } from "@/lib/format";

type Tab = "content" | "reports";
type Action = "approve" | "reject" | "hide" | "unhide";

/**
 * One decision a reviewer can take back. A sweep at one keystroke per item will
 * mis-key sooner or later, and without a way back the only remedy is
 * remembering what the previous state was.
 */
type UndoableAction = { item: ReviewQueueItem; hadBeenHidden: boolean };

/** The views, in the order the segmented control offers them. */
const VIEWS: { id: ReviewState | typeof ALL_STATES; label: string }[] = [
  { id: "unreviewed", label: REVIEW_STATE_LABEL.unreviewed },
  { id: "approved", label: REVIEW_STATE_LABEL.approved },
  { id: "rejected", label: REVIEW_STATE_LABEL.rejected },
  { id: ALL_STATES, label: "Allt" },
];

export default function YfirferdPage() {
  const { user, getToken, isLoading, error: authError, refetch } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("content");
  const [filters, setFilters] = useState<ReviewFilters>({ review_state: "unreviewed" });
  const [search, setSearch] = useState("");
  const [author, setAuthor] = useState("");

  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [reports, setReports] = useState<ReportQueueItem[]>([]);
  // Totals come from X-Total-Count, so "load more" can say what is left rather
  // than guessing from whether the last page was full.
  const [queueTotal, setQueueTotal] = useState<number | null>(null);
  const [reportsTotal, setReportsTotal] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // The item named in the URL on arrival. Read once: after that the cursor
  // owns the selection, and re-reading would fight it.
  const [linkedId, setLinkedId] = useState<string | null>(() =>
    // Straight off the URL rather than useSearchParams: this component is
    // client-only, and the hook would force a Suspense boundary for nothing.
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("efni")
  );
  const [undoable, setUndoable] = useState<UndoableAction | null>(null);
  // Decided in this sitting. Deliberately not persisted and deliberately reset
  // by a filter change: a new filter is a new sitting, and a counter that
  // survives one measures nothing a reviewer can act on.
  const [doneThisSession, setDoneThisSession] = useState(0);
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
      setQueue(q.items);
      setQueueTotal(q.total);
      setReports(r.items);
      setReportsTotal(r.total);
    } catch {
      setError("Ekki tókst að sækja yfirferðina. Reyndu aftur.");
    } finally {
      setLoading(false);
    }
  }, [filters, getToken]);

  // Only send someone away once we know who they are. `isLoading` alone is
  // not enough: the auth context reports "done, nobody here" for a tick before
  // the backend user arrives, and treating that tick as "not a moderator"
  // bounced every cold load of this page to the landing page — including every
  // shared ?efni= link, which is the whole point of sharing one.
  useEffect(() => {
    if (!isLoading && user && !isModerator) {
      router.replace("/");
      return;
    }
    if (isModerator) void load();
  }, [isLoading, user, isModerator, load, router]);

  // A new filter or a new tab is a new sitting, so the bar starts again. A
  // counter that survived a filter change would be measuring two different
  // piles at once.
  useEffect(() => {
    setDoneThisSession(0);
  }, [filters, tab]);

  // Debounced, so typing does not fire a request per keystroke.
  useEffect(() => {
    const id = window.setTimeout(
      () =>
        setFilters((f) => ({
          ...f,
          search: search || undefined,
          author: author || undefined,
        })),
      300
    );
    return () => window.clearTimeout(id);
  }, [search, author]);

  const rows: (ReviewQueueItem | ReportQueueItem)[] = tab === "content" ? queue : reports;
  // Clamped rather than reset: acting on the last row should leave the cursor
  // on the new last row, not jump to the top of a fifty-item sweep.
  const index = Math.min(cursor, Math.max(rows.length - 1, 0));
  const active = rows[index];
  const cursorContentId =
    tab === "content"
      ? (active as ReviewQueueItem | undefined)?.id
      : (active as ReportQueueItem | undefined)?.content_id;
  const activeContentId = linkedId ?? cursorContentId;

  useEffect(() => {
    if (active) rowRefs.current[active.id]?.focus();
  }, [active, tab]);

  // A link points at an item, not at a position in a list. If it happens to be
  // on the loaded page, move the cursor there too; if it is item 4,000 of
  // 5,002, still show it. Only the reader moving on clears it — dropping it
  // because the list did not contain it is how a shared link silently opens
  // something else.
  useEffect(() => {
    if (!linkedId || queue.length === 0) return;
    const i = queue.findIndex((x) => x.id === linkedId);
    if (i >= 0) {
      setCursor(i);
      setLinkedId(null);
    }
  }, [linkedId, queue]);

  // Keep the address bar on the current item, so copying it shares what is on
  // screen. `replace`, not `push`: a fifty-item sweep should not bury the back
  // button under fifty entries.
  useEffect(() => {
    if (!activeContentId) return;
    const params = new URLSearchParams(window.location.search);
    params.set("efni", activeContentId);
    window.history.replaceState(null, "", `?${params}`);
  }, [activeContentId]);

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

        // The count goes in the announcement, because the pile going down is
        // the one thing a reviewer cannot see when their eyes are on the pane.
        const left = filters.review_state === "unreviewed" ? queue.length - 1 : queue.length;
        setAnnouncement(
          `${
            {
              approve: `„${item.name}“ samþykkt.`,
              reject: `„${item.name}“ hafnað.`,
              hide: `„${item.name}“ falið.`,
              unhide: `„${item.name}“ birt aftur.`,
            }[action]
          } ${left} bíða.`
        );
        setDoneThisSession((n) => n + 1);
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
    [getToken, filters.review_state, load, queue.length]
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
      setDoneThisSession((n) => Math.max(0, n - 1));
      setUndoable(null);
      if (filters.review_state === "unreviewed") setQueue((q) => [item, ...q]);
      else void load();
    } catch {
      setAnnouncement("Ekki tókst að afturkalla.");
    } finally {
      setBusyId(null);
    }
  }, [undoable, getToken, filters.review_state, load]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      if (tab === "content") {
        const next = await fetchReviewQueue(filters, getToken, queue.length);
        setQueue((q) => [...q, ...next.items]);
        setQueueTotal(next.total);
      } else {
        const next = await fetchOpenReports(getToken, reports.length);
        setReports((rs) => [...rs, ...next.items]);
        setReportsTotal(next.total);
      }
    } catch {
      setAnnouncement("Ekki tókst að sækja fleiri.");
    } finally {
      setLoadingMore(false);
    }
  }, [tab, filters, getToken, queue.length, reports.length]);

  const comment = useCallback(
    async (body: string, visibility: ReviewCommentVisibility) => {
      if (!detail) return;
      try {
        await addReviewComment(detail.id, body, visibility, getToken);
        // Re-read rather than appending: the server decides the note's id and
        // timestamp, and the pane should show what was actually stored.
        setDetail(await fetchReviewDetail(detail.id, getToken));
        setAnnouncement(
          visibility === "to_author" ? "Ábending send höfundi." : "Athugasemd vistuð innanhúss."
        );
      } catch {
        setAnnouncement("Ekki tókst að vista athugasemdina.");
      }
    },
    [detail, getToken]
  );

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
        setLinkedId(null);
        setCursor((c) => Math.min(c + 1, rows.length - 1));
      } else if (key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        setLinkedId(null);
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

  if (isLoading) return <p className={styles.state}>Hleð…</p>;
  // Three different reasons for an empty `user`, and they need three different
  // sentences. Telling someone to sign in when they already are — because the
  // API is down — sends them round a login loop that cannot fix anything.
  if (authError) {
    return (
      <p className={styles.error} role="alert">
        Náði ekki sambandi við Slóða.{" "}
        <button className={styles.linkBtn} onClick={() => void refetch()}>
          Reyna aftur
        </button>
      </p>
    );
  }
  if (!user) return <p className={styles.state}>Þú þarft að vera skráð/ur inn.</p>;
  if (!isModerator) {
    return <p className={styles.state}>Þessi síða er fyrir Dagskrárstjórnarteymið.</p>;
  }

  return (
    <main className={styles.page} onKeyDown={onKeyDown}>
      <header className={styles.header}>
        <h1 className={styles.title}>Yfirferð</h1>
        <p className={styles.shortcuts}>
          {[
            { keys: ["j", "k"], label: "hreyfa" },
            { keys: ["s"], label: "samþykkja" },
            { keys: ["h"], label: "hafna" },
            { keys: ["f"], label: "fela" },
            { keys: ["z"], label: "afturkalla" },
          ].map(({ keys, label }) => (
            <span key={label} className={styles.shortcutsItem}>
              {keys.map((k) => (
                <kbd key={k} className={styles.key}>
                  {k}
                </kbd>
              ))}
              {label}
            </span>
          ))}
        </p>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Yfirferðarlistar">
          <button
            role="tab"
            aria-selected={tab === "content"}
            className={styles.tab}
            onClick={() => {
              setTab("content");
              setCursor(0);
            }}
          >
            Efni <span className={styles.count}>{queueTotal ?? queue.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === "reports"}
            className={styles.tab}
            onClick={() => {
              setTab("reports");
              setCursor(0);
            }}
          >
            Tilkynningar{" "}
            <span
              className={cn(
                styles.count,
                reports.some((r) => r.reason === "unsafe") && styles.countUrgent
              )}
            >
              {reportsTotal ?? reports.length}
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
                  className={styles.segment}
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
            <label className={styles.searchLabel}>
              <span className="sl-sr-only">Leita eftir höfundi</span>
              <input
                className={styles.search}
                type="search"
                placeholder="Höfundur…"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </label>
            {/* The range applies to whichever date the current view is ordered
                by, so the label says which — otherwise "frá" is a guess. */}
            <label className={styles.dateLabel}>
              {filters.review_state === "unreviewed" ? "Sent inn" : "Afgreitt"} frá
              <input
                className={styles.date}
                type="date"
                value={filters.date_from ?? ""}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, date_from: e.target.value || undefined }));
                  setCursor(0);
                }}
              />
            </label>
            <label className={styles.dateLabel}>
              til
              <input
                className={styles.date}
                type="date"
                value={filters.date_to ?? ""}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, date_to: e.target.value || undefined }));
                  setCursor(0);
                }}
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
      </p>

      {/* Undo is what replaces most confirm dialogs here: every decision on
          this screen is reversible, so it happens and offers a way back rather
          than asking first. It sits outside the live region — a button inside
          one is re-announced on every unrelated update. */}
      {undoable && (
        <div className={styles.undo}>
          <p className={styles.undoText}>
            <strong>„{undoable.item.name}“</strong> afgreitt.
          </p>
          <button className={styles.undoBtn} onClick={() => void undo()}>
            Taka aftur <kbd className={styles.key}>z</kbd>
          </button>
        </div>
      )}

      <QueueProgress
        done={doneThisSession}
        waiting={queueTotal ?? queue.length}
        loaded={queue.length}
      />

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
            <QueueEmpty
              filtered={
                tab === "content" &&
                Boolean(
                  filters.search ||
                  filters.author ||
                  filters.date_from ||
                  filters.date_to ||
                  filters.reported ||
                  (filters.review_state ?? "unreviewed") !== "unreviewed"
                )
              }
              done={doneThisSession}
              openReports={tab === "content" ? (reportsTotal ?? reports.length) : 0}
              onShowReports={() => {
                setTab("reports");
                setCursor(0);
              }}
              onClearFilter={() => {
                setSearch("");
                setAuthor("");
                setFilters({ review_state: "unreviewed" });
                setCursor(0);
              }}
            />
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
                    onPick={() => {
                      setLinkedId(null);
                      setCursor(i);
                    }}
                    label={`${item.name}, eftir ${item.author_name}`}
                    title={item.name}
                    line={`${CONTENT_TYPE_LABEL[item.content_type]} · ${item.author_name}`}
                    stamp={formatIcelandicDateShort(item.created_at)}
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
                    onPick={() => {
                      setLinkedId(null);
                      setCursor(i);
                    }}
                    label={`Tilkynning um ${report.content_name}`}
                    title={report.content_name}
                    line={REPORT_REASON_LABEL[report.reason]}
                    stamp={formatIcelandicDateShort(report.created_at)}
                    flags={[report.content_author_name]}
                  />
                ))}
          </ul>

          {(() => {
            const total = tab === "content" ? queueTotal : reportsTotal;
            const shown = rows.length;
            if (total === null || shown >= total || shown === 0) return null;
            return (
              <div className={styles.loadMore}>
                <p className={styles.loadMoreCount}>
                  {shown} af {total}
                </p>
                <button
                  className={styles.linkBtn}
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? "Sæki…" : "Sýna fleiri"}
                </button>
              </div>
            );
          })()}
        </div>

        <div className={styles.detailPane}>
          <ReviewDetailPane
            detail={detail}
            loading={detailLoading}
            busy={busyId !== null}
            onComment={comment}
            shareUrl={
              activeContentId && typeof window !== "undefined"
                ? `${window.location.origin}${window.location.pathname}?efni=${activeContentId}`
                : null
            }
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
                className={cn(styles.btn, styles.btnPrimary)}
                disabled={busyId !== null}
                onClick={() => void closeReport(active as ReportQueueItem, "resolved")}
              >
                Afgreitt
              </button>
              <button
                className={cn(styles.btn, styles.btnSecondary)}
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
  onPick,
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
  /** Focus moved here — track the cursor, nothing more. */
  onSelect: () => void;
  /** A deliberate choice: a click. This is what drops a shared link. */
  onPick: () => void;
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
      onClick={onPick}
      // Focus only tracks the cursor. It must not count as choosing: the rail
      // focuses the current row itself, which would clear a shared link before
      // the reader had touched anything.
      onFocus={onSelect}
      className={cn(styles.row, focused && styles.rowFocused, urgent && styles.rowUrgent)}
    >
      <div className={styles.rowTop}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowStamp}>{stamp}</span>
      </div>
      <p className={styles.rowLine}>{line}</p>
      {shown.length > 0 && (
        <p className={styles.rowFlags}>
          {shown.map((f) => (
            <span key={f} className={styles.chip}>
              {f}
            </span>
          ))}
        </p>
      )}
    </li>
  );
}
