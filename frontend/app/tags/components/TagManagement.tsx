"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { countIs } from "@/lib/format";
import { deleteTag, TagRequestError, updateTag, type Tag } from "@/services/tags.service";
import { hasPermission } from "@/services/users.service";
import { useTagList } from "../hooks/useTagList";
import { useTagListUrl, useWriteTagListUrl } from "../hooks/useTagListUrl";
import { useTagUsage } from "../hooks/useTagUsage";
import { sameName, searchTags, validateTagName } from "../tagRules";
import TagCreateInput from "./TagCreateInput";
import TagDeleteDialog from "./TagDeleteDialog";
import TagRow from "./TagRow";
import styles from "./tags.module.css";

const PAGE_SIZE = 20;

/** Focus `fallback` if the element that had focus has just been removed. */
function rescueFocus(fallback: React.RefObject<HTMLElement | null>) {
  setTimeout(() => {
    const active = document.activeElement;
    if (!active || active === document.body) fallback.current?.focus();
  }, 0);
}

/**
 * The moderators' page for the bank's shared merkimiðar: one field that
 * searches and creates, rename in place, and delete behind a confirmation.
 *
 * Gated by platform permission rather than workspace role: the vocabulary is
 * shared by the whole bank, so a rename reaches every item in it. That belongs
 * to Dagskrárstjórnarteymið, not to an editor of one workspace.
 */
export default function TagManagement() {
  const { user, isLoading: authLoading, getToken } = useAuth();
  const isModerator = hasPermission(user?.permissions, "moderator");
  const list = useTagList(!authLoading && isModerator);
  const url = useTagListUrl();
  const { query, setQuery } = url;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ tag: Tag; trigger: HTMLElement } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeSeq = useRef(0);
  const fieldRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  const say = useCallback((text: string) => {
    setNotice({ key: ++noticeSeq.current, text });
  }, []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const matches = useMemo(() => searchTags(list.tags, query), [list.tags, query]);
  const exactMatch = query.trim() ? matches.find((t) => sameName(t.name, query)) : undefined;
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = Math.min(url.page, pageCount);
  const shown = useMemo(
    () => matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [matches, page]
  );
  const usage = useTagUsage(useMemo(() => shown.map((t) => t.id), [shown]));

  useWriteTagListUrl(url.writeUrl, query, page, list.status === "ready");

  const handleCreated = (tag: Tag) => {
    list.add(tag);
    usage.setCount(tag.id, 0);
    say(`„${tag.name}“ bætt við.`);
  };

  const rename = async (tag: Tag, name: string) => {
    const saved = await updateTag(tag.id, name, getToken);
    const newName = typeof saved?.name === "string" ? saved.name : name;
    list.replace({ ...tag, name: newName });
    setEditingId(null);
    say(`„${tag.name}“ heitir nú „${newName}“.`);
    // The renamed tag may no longer match the search, and its row is gone.
    rescueFocus(fieldRef);
  };

  const closeDelete = () => {
    const trigger = deleting?.trigger;
    setDeleting(null);
    setTimeout(() => trigger?.focus(), 0);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { tag } = deleting;
    try {
      await deleteTag(tag.id, getToken);
    } catch (err) {
      // Already gone is what the reader asked for.
      if (!(err instanceof TagRequestError && err.status === 404)) throw err;
    }
    list.remove(tag.id);
    setDeleting(null);
    say(`„${tag.name}“ eytt.`);
    // Its row is gone with its button, so focus goes back to the field.
    setTimeout(() => fieldRef.current?.focus(), 0);
  };

  if (authLoading) {
    return (
      <PageShell>
        <PageHeader total={null} />
        <LoadingState />
      </PageShell>
    );
  }

  if (!isModerator) {
    return (
      <PageShell>
        <PageHeader total={null} />
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Merkimiðar eru í umsjón Dagskrárstjórnarteymisins.</p>
          <Link href="/programs" className={styles.link}>
            Fara í dagskrárbankann
          </Link>
        </div>
      </PageShell>
    );
  }

  if (list.status === "error") {
    return (
      <PageShell>
        <PageHeader total={null} />
        <div role="alert" className={styles.loadError}>
          <p className={styles.loadErrorTitle}>Ekki tókst að sækja merkimiðana.</p>
          <p className={styles.loadErrorBody}>Athugaðu nettenginguna og reyndu aftur.</p>
          <button type="button" className={styles.secondaryBtn} onClick={() => list.retry()}>
            Reyna aftur
          </button>
        </div>
      </PageShell>
    );
  }

  const searching = query.trim().length > 0;
  return (
    <PageShell
      overlay={
        <TagDeleteDialog
          key={deleting?.tag.id ?? "closed"}
          tag={deleting?.tag ?? null}
          usageCount={deleting ? usage.counts[deleting.tag.id] : null}
          onCancel={closeDelete}
          onConfirm={confirmDelete}
        />
      }
    >
      <PageHeader total={list.status === "ready" ? list.tags.length : null} />
      <TagCreateInput
        tags={list.tags}
        value={query}
        onValueChange={setQuery}
        onCreated={handleCreated}
        inputRef={fieldRef}
        formId={formId}
      />
      <NoticeBar notice={notice} onDismiss={dismissNotice} returnFocusTo={fieldRef} />

      {list.status === "loading" ? (
        <LoadingState />
      ) : (
        <>
          {/* Announced politely, and only while searching, so typing isn't drowned in numbers. */}
          <p className={styles.resultCount} aria-live="polite">
            {searching ? `Leitin skilar ${countIs(matches.length, "merkimiða", "merkimiðum")}` : ""}
          </p>
          {matches.length === 0 ? (
            <EmptyState query={query.trim()} formId={formId} />
          ) : (
            <ul className={styles.rows}>
              {shown.map((tag) => (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  usageCount={usage.counts[tag.id]}
                  query={query}
                  isMatch={exactMatch?.id === tag.id}
                  isEditing={editingId === tag.id}
                  onEdit={() => setEditingId(tag.id)}
                  onCancelEdit={() => setEditingId(null)}
                  validateName={(name) => validateTagName(name, list.tags, tag.id)}
                  onRename={(name) => rename(tag, name)}
                  onRequestDelete={(trigger) => setDeleting({ tag, trigger })}
                />
              ))}
            </ul>
          )}
          {pageCount > 1 ? (
            <Pagination page={page} pageCount={pageCount} onPage={url.setPage} />
          ) : null}
        </>
      )}
    </PageShell>
  );
}

/**
 * The page frame. The content sits in a size container, so its layout follows the page's own
 * width; the dialog (`overlay`) is a viewport overlay, so it sits outside and follows the viewport.
 */
function PageShell({
  children,
  overlay,
}: {
  children: React.ReactNode;
  overlay?: React.ReactNode;
}) {
  return (
    <section className={styles.page}>
      <div className={styles.body}>{children}</div>
      {overlay}
    </section>
  );
}

function PageHeader({ total }: { total: number | null }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Merkimiðar</h1>
      <p className={styles.lede}>
        Sameiginlegur orðaforði bankans. Ný nöfn og breytingar ná til allra eininga sem bera
        merkimiðann.
      </p>
      {total !== null ? (
        <p className={styles.total}>{countIs(total, "merkimiði", "merkimiðar")}</p>
      ) : null}
    </header>
  );
}

/** UX rule 11: shaped like the rows it stands in for; static under reduced motion. */
function LoadingState() {
  return (
    <div role="status" className={styles.skeleton}>
      <span className="sl-sr-only">Hleð merkimiðum…</span>
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} aria-hidden="true" className={styles.skeletonBlock} data-n={i % 4} />
      ))}
    </div>
  );
}

/** Nothing matches: offers to create the searched name with the field's own submit. */
function EmptyState({ query, formId }: { query: string; formId: string }) {
  if (query) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Enginn merkimiði heitir „{query}“.</p>
        <button type="submit" form={formId} className={styles.secondaryBtn}>
          Búa til „{query}“
        </button>
      </div>
    );
  }
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>Engir merkimiðar enn.</p>
      <p className={styles.emptyBody}>
        Merkimiðar hjálpa foringjum að finna efni í bankanum. Skrifaðu nafn í reitinn hér fyrir ofan
        og ýttu á Enter til að búa til þann fyrsta.
      </p>
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  // aria-disabled rather than disabled, so focus stays put on the first and last page.
  return (
    <nav className={styles.pagination} aria-label="Síður">
      <button
        type="button"
        className={styles.quietBtn}
        aria-disabled={page === 1}
        onClick={() => page > 1 && onPage(page - 1)}
      >
        <span aria-hidden="true">← </span>Fyrri
      </button>
      <span className={styles.pageInfo}>
        Síða {page} af {pageCount}
      </span>
      <button
        type="button"
        className={styles.quietBtn}
        aria-disabled={page === pageCount}
        onClick={() => page < pageCount && onPage(page + 1)}
      >
        Næsta<span aria-hidden="true"> →</span>
      </button>
    </nav>
  );
}

// ── Status line ───────────────────────────────────────────────────────────────

interface Notice {
  key: number;
  text: string;
}

const NOTICE_MS = 10_000;

/**
 * The page's one status region (UX rule 4): what the last create, rename or
 * delete did. It clears after ten seconds, paused while the pointer or focus
 * is on it. No "Afturkalla": the backend can't undo a delete.
 */
function NoticeBar({
  notice,
  onDismiss,
  returnFocusTo,
}: {
  notice: Notice | null;
  onDismiss: () => void;
  returnFocusTo: React.RefObject<HTMLElement | null>;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!notice || paused) return;
    const timer = setTimeout(onDismiss, NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice, paused, onDismiss]);

  return (
    <div
      ref={boxRef}
      role="status"
      className={notice ? styles.notice : styles.noticeEmpty}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!boxRef.current?.contains(e.relatedTarget as Node)) setPaused(false);
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {notice ? (
        <>
          <p className={styles.noticeText}>{notice.text}</p>
          <button
            type="button"
            className={styles.noticeClose}
            onClick={() => {
              onDismiss();
              returnFocusTo.current?.focus();
            }}
          >
            <span aria-hidden="true">✕</span>
            <span className="sl-sr-only">Loka</span>
          </button>
        </>
      ) : null}
    </div>
  );
}
