import React, { useId, useMemo, useRef, useState } from "react";
import {
  NameField,
  NoticeBar,
  LoadingState,
  ErrorState,
  EmptyState,
  PageHeader,
  Highlight,
  focusSoon,
} from "./TagsLabParts";
import {
  SAMPLE_TAGS,
  compareIs,
  initial,
  usageText,
  useTagLab,
  validateName,
  type LabTag,
  type LoadStatus,
  type TagLabState,
} from "./tagLab";
import styles from "./TagsLab.module.css";

export type TagsLook = "leit" | "sky" | "tafla" | "skipt";

export interface TagsLabProps {
  /** Which lab variation to render. */
  look: TagsLook;
  tags?: LabTag[];
  status?: LoadStatus;
  /** Simulated save time in ms. */
  saveDelay?: number;
}

/**
 * Lab copy of the tag-management page (`app/tags/`), with the create input as part of each look.
 * Same jobs as the real page: create, rename, delete, search, plus merge in the table look.
 */
export default function TagsLab({
  look,
  tags = SAMPLE_TAGS,
  status = "ready",
  saveDelay,
}: TagsLabProps) {
  // A new key resets the state when a story or control swaps the data.
  return (
    <Page
      key={`${status}:${tags.length}`}
      look={look}
      tags={tags}
      status={status}
      saveDelay={saveDelay}
    />
  );
}

function Page({
  look,
  tags,
  status,
  saveDelay,
}: Required<Omit<TagsLabProps, "saveDelay">> & { saveDelay?: number }) {
  const lab = useTagLab({ tags, status, saveDelay });
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const Look = { leit: FindOrCreate, sky: Cloud, tafla: Table, skipt: Split }[look];

  return (
    <div ref={rootRef} className={`${styles.page} ${styles[look]}`}>
      <PageHeader total={lab.total} loading={lab.status === "loading"} />
      {lab.status === "error" ? (
        <ErrorState onRetry={lab.retry} />
      ) : (
        <Look lab={lab} rootRef={rootRef} fieldRef={fieldRef}>
          <NoticeBar notice={lab.notice} onDismiss={lab.dismissNotice} returnFocusTo={fieldRef} />
        </Look>
      )}
    </div>
  );
}

interface LookProps {
  lab: TagLabState;
  rootRef: React.RefObject<HTMLDivElement | null>;
  fieldRef: React.RefObject<HTMLInputElement | null>;
  /** The notice bar, placed by each look right after its main field. */
  children: React.ReactNode;
}

/** Shared rename bookkeeping: one open at a time, focus back on its trigger after. */
function useRenaming(rootRef: LookProps["rootRef"]) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const stop = () => {
    const id = editingId;
    setEditingId(null);
    if (id) focusSoon(rootRef, `[data-focus="rename-${id}"]`);
  };
  return { editingId, start: setEditingId, stop };
}

function RenameForm({ tag, lab, onDone }: { tag: LabTag; lab: TagLabState; onDone: () => void }) {
  return (
    <NameField
      label={`Nýtt nafn á „${tag.name}“`}
      labelHidden
      initial={tag.name}
      submitLabel="Vista"
      busyLabel="Vista…"
      autoFocus
      validate={(n) => validateName(n, lab.tags, tag.id)?.message ?? null}
      onSubmit={async (n) => {
        const err = await lab.rename(tag.id, n);
        if (!err) onDone();
        return err;
      }}
      onCancel={onDone}
      className={styles.renameField}
    />
  );
}

function SearchField({ lab, label = "Leita að merkimiða" }: { lab: TagLabState; label?: string }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="search"
        className={styles.input}
        value={lab.query}
        autoComplete="off"
        onChange={(e) => lab.setQuery(e.target.value)}
      />
    </div>
  );
}

function CreateField({
  lab,
  fieldRef,
  compact,
}: Pick<LookProps, "lab" | "fieldRef"> & { compact?: boolean }) {
  return (
    <NameField
      label="Nýr merkimiði"
      placeholder={compact ? undefined : "t.d. Ratleikni"}
      submitLabel="Bæta við"
      busyLabel="Bæti við…"
      clearOnSuccess
      inputRef={fieldRef}
      validate={(n) => validateName(n, lab.tags)?.message ?? null}
      onSubmit={lab.create}
    />
  );
}

function ResultCount({ lab }: { lab: TagLabState }) {
  // Announced politely, only while searching, so typing isn't drowned in numbers.
  return (
    <p className={styles.resultCount} aria-live="polite">
      {lab.query.trim() ? `${lab.visible.length} af ${lab.total} passa við leitina` : ""}
    </p>
  );
}

// ── A · Find or create ────────────────────────────────────────────────────────

/** One field: typing filters the list, Enter creates the name if no tag has it yet. */
function FindOrCreate({ lab, rootRef, fieldRef, children }: LookProps) {
  const rename = useRenaming(rootRef);
  const q = lab.query.trim();

  return (
    <>
      <NameField
        label="Leita eða búa til merkimiða"
        type="search"
        value={lab.query}
        onValueChange={lab.setQuery}
        inputRef={fieldRef}
        hint="Skrifaðu til að leita. Enter býr til merkimiðann ef enginn heitir þetta."
        submitLabel="Búa til"
        busyLabel="Bý til…"
        clearOnSuccess
        validate={(n) => validateName(n, lab.tags)?.message ?? null}
        onSubmit={lab.create}
      />
      {children}
      {lab.status === "loading" ? (
        <LoadingState shape="rows" />
      ) : (
        <>
          <ResultCount lab={lab} />
          {lab.visible.length === 0 ? (
            <EmptyState searching={!!q} query={q} />
          ) : (
            <ul className={styles.rows}>
              {lab.visible.map((tag) => (
                <li
                  key={tag.id}
                  className={`${styles.row} ${lab.exactMatch?.id === tag.id ? styles.rowMatch : ""}`}
                >
                  {rename.editingId === tag.id ? (
                    <RenameForm tag={tag} lab={lab} onDone={rename.stop} />
                  ) : (
                    <>
                      <span className={styles.rowName}>
                        <Highlight name={tag.name} query={q} />
                        {lab.exactMatch?.id === tag.id ? (
                          <span className={styles.flag}>Er til</span>
                        ) : null}
                      </span>
                      <span className={styles.usage}>{usageText(tag.items.length)}</span>
                      <span className={styles.actions}>
                        <button
                          type="button"
                          className={styles.quietBtn}
                          data-focus={`rename-${tag.id}`}
                          onClick={() => rename.start(tag.id)}
                        >
                          Endurnefna<span className="sl-sr-only"> {tag.name}</span>
                        </button>
                        <button
                          type="button"
                          className={styles.dangerBtn}
                          onClick={() => lab.remove(tag.id)}
                        >
                          Eyða<span className="sl-sr-only"> {tag.name}</span>
                        </button>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

// ── B · Cloud ─────────────────────────────────────────────────────────────────

type Grouping = "letter" | "usage";

function groupTags(tags: LabTag[], by: Grouping): { label: string; tags: LabTag[] }[] {
  if (by === "usage") {
    const byCount = [...tags].sort(
      (a, b) => b.items.length - a.items.length || compareIs(a.name, b.name)
    );
    return [
      { label: "Mikið notaðir · 10 eða fleiri", tags: byCount.filter((t) => t.items.length >= 10) },
      {
        label: "Notaðir · 1 til 9",
        tags: byCount.filter((t) => t.items.length > 0 && t.items.length < 10),
      },
      { label: "Ónotaðir", tags: byCount.filter((t) => t.items.length === 0) },
    ].filter((g) => g.tags.length);
  }
  const groups = new Map<string, LabTag[]>();
  for (const t of tags) groups.set(initial(t.name), [...(groups.get(initial(t.name)) ?? []), t]);
  return [...groups.entries()].map(([label, list]) => ({ label, tags: list }));
}

/** Chips grouped by first letter or by usage; rename and delete right on the chip. */
function Cloud({ lab, rootRef, fieldRef, children }: LookProps) {
  const rename = useRenaming(rootRef);
  const [by, setBy] = useState<Grouping>("letter");
  const groups = useMemo(() => groupTags(lab.visible, by), [lab.visible, by]);
  const q = lab.query.trim();

  return (
    <>
      <div className={styles.cloudTools}>
        <CreateField lab={lab} fieldRef={fieldRef} />
        <SearchField lab={lab} label="Leita" />
        <div className={styles.toggle} role="group" aria-label="Flokka eftir">
          <button type="button" aria-pressed={by === "letter"} onClick={() => setBy("letter")}>
            Stafrófi
          </button>
          <button type="button" aria-pressed={by === "usage"} onClick={() => setBy("usage")}>
            Notkun
          </button>
        </div>
      </div>
      {children}
      {lab.status === "loading" ? (
        <LoadingState shape="chips" />
      ) : (
        <>
          <ResultCount lab={lab} />
          {lab.visible.length === 0 ? (
            <EmptyState searching={!!q} query={q} onClear={() => lab.setQuery("")} />
          ) : (
            groups.map((g) => (
              <div key={g.label} className={styles.cloudGroup}>
                <h3 className={by === "letter" ? styles.letter : styles.band}>{g.label}</h3>
                <ul className={styles.cloud}>
                  {g.tags.map((tag) =>
                    rename.editingId === tag.id ? (
                      <li key={tag.id} className={styles.chipEditing}>
                        <RenameForm tag={tag} lab={lab} onDone={rename.stop} />
                      </li>
                    ) : (
                      <li key={tag.id} className={styles.chip}>
                        <button
                          type="button"
                          className={styles.chipMain}
                          data-focus={`rename-${tag.id}`}
                          onClick={() => rename.start(tag.id)}
                        >
                          <span className={styles.chipName}>
                            <Highlight name={tag.name} query={q} />
                          </span>
                          <span className={styles.chipCount} aria-hidden="true">
                            {tag.items.length}
                          </span>
                          <span className="sl-sr-only">
                            , {usageText(tag.items.length).toLowerCase()}. Endurnefna
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.chipX}
                          onClick={() => lab.remove(tag.id)}
                        >
                          <span aria-hidden="true">✕</span>
                          <span className="sl-sr-only">Eyða {tag.name}</span>
                        </button>
                      </li>
                    )
                  )}
                </ul>
              </div>
            ))
          )}
        </>
      )}
    </>
  );
}

// ── C · Table ─────────────────────────────────────────────────────────────────

type SortKey = "name" | "usage";

/** A sortable table with usage counts, rename, and merge for near-duplicate names. */
function Table({ lab, rootRef, fieldRef, children }: LookProps) {
  const rename = useRenaming(rootRef);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [mergeInto, setMergeInto] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "name", desc: false });
  const q = lab.query.trim();

  const rows = useMemo(() => {
    const list = [...lab.visible];
    if (sort.key === "usage")
      list.sort((a, b) => a.items.length - b.items.length || compareIs(a.name, b.name));
    if (sort.desc) list.reverse();
    return list;
  }, [lab.visible, sort]);

  const sortBy = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key === "usage" }));
  const ariaSort = (key: SortKey) =>
    sort.key === key ? (sort.desc ? "descending" : "ascending") : undefined;

  const endMerge = (id: string) => {
    setMergingId(null);
    focusSoon(rootRef, `[data-focus="merge-${id}"]`);
  };

  return (
    <>
      <div className={styles.tableTools}>
        <CreateField lab={lab} fieldRef={fieldRef} compact />
        <SearchField lab={lab} />
      </div>
      {children}
      {lab.status !== "loading" && lab.likelyDuplicates.length > 0 ? (
        <div className={styles.dupes}>
          <h3 className={styles.dupesTitle}>Líklegar tvítekningar</h3>
          <ul className={styles.dupesList}>
            {lab.likelyDuplicates.map((group) => {
              const [keep, ...rest] = [...group].sort((a, b) => b.items.length - a.items.length);
              return (
                <li key={keep.id} className={styles.dupe}>
                  <span className={styles.dupeText}>
                    {group.map((t) => `„${t.name}“ (${t.items.length})`).join(" og ")}
                  </span>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => rest.forEach((r) => lab.merge(r.id, keep.id))}
                  >
                    Sameina í „{keep.name}“
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {lab.status === "loading" ? (
        <LoadingState shape="table" />
      ) : (
        <>
          <ResultCount lab={lab} />
          {rows.length === 0 ? (
            <EmptyState searching={!!q} query={q} onClear={() => lab.setQuery("")} />
          ) : (
            <table className={styles.table}>
              <caption className="sl-sr-only">Merkimiðar og hve margar einingar nota þá</caption>
              <thead>
                <tr>
                  <th scope="col" aria-sort={ariaSort("name")}>
                    <button type="button" className={styles.sortBtn} onClick={() => sortBy("name")}>
                      Merkimiði
                      <span aria-hidden="true">
                        {sort.key === "name" ? (sort.desc ? " ↓" : " ↑") : ""}
                      </span>
                    </button>
                  </th>
                  <th scope="col" aria-sort={ariaSort("usage")}>
                    <button
                      type="button"
                      className={styles.sortBtn}
                      onClick={() => sortBy("usage")}
                    >
                      Notkun
                      <span aria-hidden="true">
                        {sort.key === "usage" ? (sort.desc ? " ↓" : " ↑") : ""}
                      </span>
                    </button>
                  </th>
                  <th scope="col">
                    <span className="sl-sr-only">Aðgerðir</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tag) => (
                  <tr key={tag.id}>
                    {rename.editingId === tag.id ? (
                      <td colSpan={3} className={styles.cellEdit}>
                        <RenameForm tag={tag} lab={lab} onDone={rename.stop} />
                      </td>
                    ) : (
                      <>
                        <th scope="row" className={styles.cellName}>
                          <Highlight name={tag.name} query={q} />
                        </th>
                        <td className={styles.cellUsage}>{usageText(tag.items.length)}</td>
                        <td className={styles.cellActions}>
                          {mergingId === tag.id ? (
                            <form
                              className={styles.mergeForm}
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (!mergeInto) return;
                                setMergingId(null);
                                lab.merge(tag.id, mergeInto);
                              }}
                            >
                              <label htmlFor={`merge-${tag.id}`} className={styles.mergeLabel}>
                                Sameina við
                              </label>
                              <select
                                id={`merge-${tag.id}`}
                                className={styles.select}
                                value={mergeInto}
                                onChange={(e) => setMergeInto(e.target.value)}
                                autoFocus
                              >
                                <option value="">Veldu merkimiða</option>
                                {lab.tags
                                  .filter((t) => t.id !== tag.id)
                                  .map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                className={styles.quietBtn}
                                onClick={() => endMerge(tag.id)}
                              >
                                Hætta við
                              </button>
                              <button type="submit" className={styles.primaryBtn}>
                                Sameina
                              </button>
                            </form>
                          ) : (
                            <span className={styles.actions}>
                              <button
                                type="button"
                                className={styles.quietBtn}
                                data-focus={`rename-${tag.id}`}
                                onClick={() => rename.start(tag.id)}
                              >
                                Endurnefna<span className="sl-sr-only"> {tag.name}</span>
                              </button>
                              <button
                                type="button"
                                className={styles.quietBtn}
                                data-focus={`merge-${tag.id}`}
                                onClick={() => {
                                  setMergeInto("");
                                  setMergingId(tag.id);
                                }}
                              >
                                Sameina<span className="sl-sr-only"> {tag.name}</span>
                              </button>
                              <button
                                type="button"
                                className={styles.dangerBtn}
                                onClick={() => lab.remove(tag.id)}
                              >
                                Eyða<span className="sl-sr-only"> {tag.name}</span>
                              </button>
                            </span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  );
}

// ── D · Split view ────────────────────────────────────────────────────────────

/** A list beside a detail panel that shows what uses the selected tag. */
function Split({ lab, rootRef, fieldRef, children }: LookProps) {
  const rename = useRenaming(rootRef);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // On a phone only one pane shows; `open` means the detail pane.
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const q = lab.query.trim();

  const selected = lab.tags.find((t) => t.id === selectedId) ?? lab.visible[0] ?? null;

  const select = (id: string) => {
    setSelectedId(id);
    setOpen(true);
    // When the list hides (phone), move focus to the detail so it isn't lost.
    setTimeout(() => {
      if (listRef.current && getComputedStyle(listRef.current).display === "none")
        headingRef.current?.focus();
    }, 0);
  };
  const back = () => {
    setOpen(false);
    if (selected) focusSoon(rootRef, `[data-focus="pick-${selected.id}"]`);
  };
  const remove = (tag: LabTag) => {
    const i = lab.visible.findIndex((t) => t.id === tag.id);
    const next = lab.visible[i + 1] ?? lab.visible[i - 1];
    setSelectedId(next?.id ?? null);
    setOpen(false);
    lab.remove(tag.id);
  };

  return (
    <>
      {children}
      <div className={styles.split} data-open={open || undefined}>
        <div ref={listRef} className={styles.listPane}>
          <CreateField lab={lab} fieldRef={fieldRef} compact />
          <SearchField lab={lab} />
          {lab.status === "loading" ? (
            <LoadingState shape="split" />
          ) : (
            <>
              <ResultCount lab={lab} />
              {lab.visible.length === 0 ? (
                <EmptyState searching={!!q} query={q} onClear={() => lab.setQuery("")} />
              ) : (
                <ul className={styles.pickList}>
                  {lab.visible.map((tag) => (
                    <li key={tag.id}>
                      <button
                        type="button"
                        className={styles.pick}
                        data-focus={`pick-${tag.id}`}
                        aria-current={selected?.id === tag.id ? "true" : undefined}
                        onClick={() => select(tag.id)}
                      >
                        <span className={styles.pickName}>
                          <Highlight name={tag.name} query={q} />
                        </span>
                        <span className={styles.pickCount} aria-hidden="true">
                          {tag.items.length}
                        </span>
                        <span className="sl-sr-only">
                          , {usageText(tag.items.length).toLowerCase()}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        <div className={styles.detailPane}>
          {selected && lab.status === "ready" ? (
            <div className={styles.detail} aria-label={selected.name} role="region">
              <button type="button" className={styles.backBtn} onClick={back}>
                <span aria-hidden="true">← </span>Allir merkimiðar
              </button>
              {rename.editingId === selected.id ? (
                <RenameForm tag={selected} lab={lab} onDone={rename.stop} />
              ) : (
                <h3 ref={headingRef} tabIndex={-1} className={styles.detailTitle}>
                  {selected.name}
                </h3>
              )}
              <p className={styles.usage}>{usageText(selected.items.length)}</p>
              {rename.editingId !== selected.id ? (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    data-focus={`rename-${selected.id}`}
                    onClick={() => rename.start(selected.id)}
                  >
                    Endurnefna
                  </button>
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    onClick={() => remove(selected)}
                  >
                    Eyða merkimiða
                  </button>
                </div>
              ) : null}
              <h4 className={styles.itemsTitle}>Einingar með þessum merkimiða</h4>
              {selected.items.length === 0 ? (
                <p className={styles.emptyBody}>Engin eining ber þennan merkimiða enn.</p>
              ) : (
                <ul className={styles.items}>
                  {selected.items.map((item) => (
                    <li key={item.id} className={styles.item}>
                      <span className={styles.itemTitle}>{item.title}</span>
                      <span className={styles.kind}>{item.kind}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : lab.status === "loading" ? (
            <div aria-hidden="true" className={styles.detailSkeleton} />
          ) : null}
        </div>
      </div>
    </>
  );
}
