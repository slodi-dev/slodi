"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, Ellipsis, GripVertical, Plus, Users } from "lucide-react";
import { countIs } from "@/lib/format";
import {
  ALBUM_ICONS,
  SOURCES,
  themeIcon,
  type LabAlbum,
  type LabBlock,
  type LabSource,
} from "./blockPaletteLabData";
import { ALBUM_NAME_MAX, type AlbumsApi, type Selection } from "./useAlbums";
import styles from "./BlockPaletteLab.module.css";

/**
 * - `mappa`: C1 · Folder list. Two groups, Bankinn and Mitt, one row per collection.
 * - `kapur`: C2 · Album covers. Sources as tabs, albums as covers made of their blocks.
 * - `flogar`: C3 · Chips + "Öll albúm…". One row of chips; the rest in a panel.
 * - `tre`: C4 · Tabs. Bankinn · Mitt, with the albums in Mitt reorderable.
 */
export type CollectionsLook = "mappa" | "kapur" | "flogar" | "tre";

export interface CollectionsProps {
  api: AlbumsApi;
  blocks: LabBlock[];
  /** Lab only: makes landmark names unique when several rails share a page. */
  named: (label: string) => string;
}

const blocksWord = (n: number) => countIs(n, "blokk", "blokkir");

/** How many blocks a source holds, before search and type. */
export function sourceCount(source: LabSource["id"], blocks: LabBlock[]): number {
  return source === "allt" ? blocks.length : blocks.filter((b) => b.folder === source).length;
}

/** Whether a collection is the selected one. */
function isSelected(selection: Selection, type: Selection["type"], id: string): boolean {
  return selection.type === type && selection.id === id;
}

/* ── A popover that is not clipped by the rail's scrolling ─────────────────── */

/**
 * The native `popover` attribute puts the panel in the top layer. That way it is never cut off by
 * the scrolling card list, and Escape, light dismiss and the open/closed state come from the
 * browser. Placement is computed from the trigger, because CSS anchor positioning isn't in every
 * browser yet. Focus moves into the panel on open and back to the trigger on close.
 */
export function Popover({
  label,
  trigger,
  children,
  wide = false,
}: {
  /** The panel's accessible name. */
  label: string;
  trigger: (props: {
    ref: (node: HTMLButtonElement | null) => void;
    popoverTarget: string;
    onClick: () => void;
    "aria-expanded": boolean;
    "aria-haspopup": "dialog";
  }) => ReactNode;
  children: (close: () => void) => ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  openRef.current = open;

  // Open and close go through React state from the click that caused them; the native toggle
  // event only reports closes the browser did on its own (light dismiss, Escape).
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onToggle = (event: Event) => {
      const isOpen = (event as ToggleEvent).newState === "open";
      if (isOpen !== openRef.current) setOpen(isOpen);
    };
    panel.addEventListener("toggle", onToggle);
    return () => panel.removeEventListener("toggle", onToggle);
  }, []);

  const wasOpen = useRef(false);
  useEffect(() => {
    const panel = panelRef.current;
    // Only on a change: on mount nothing is open and focus must stay where it is.
    if (!panel || wasOpen.current === open) return;
    wasOpen.current = open;
    if (open) {
      place(panel, triggerRef.current);
      panel.querySelector<HTMLElement>("input, button:not(:disabled)")?.focus();
    } else if (panel.contains(document.activeElement) || document.activeElement === document.body) {
      triggerRef.current?.focus();
    }
  }, [open]);

  const close = () => {
    setOpen(false);
    if (panelRef.current?.matches(":popover-open")) panelRef.current.hidePopover();
    triggerRef.current?.focus();
  };

  return (
    <>
      {trigger({
        ref: (node) => {
          triggerRef.current = node;
        },
        popoverTarget: id,
        onClick: () => setOpen((o) => !o),
        "aria-expanded": open,
        "aria-haspopup": "dialog",
      })}
      <div
        ref={panelRef}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={label}
        className={wide ? `${styles.popover} ${styles.popoverWide}` : styles.popover}
        // The browser closes an auto popover on Escape too; this covers scripted key events
        // and any browser without the popover API's light dismiss.
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.defaultPrevented) {
            event.preventDefault();
            close();
          }
        }}
      >
        {open && children(close)}
      </div>
    </>
  );
}

/** Below the trigger, right-aligned to it, kept on screen; above it when there's no room. */
function place(panel: HTMLElement, trigger: HTMLElement | null) {
  if (!trigger) return;
  const t = trigger.getBoundingClientRect();
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;
  const left = Math.max(8, Math.min(t.right - width, window.innerWidth - width - 8));
  const below = t.bottom + 4;
  const top = below + height > window.innerHeight - 8 ? Math.max(8, t.top - height - 4) : below;
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

/* ── Naming an album ───────────────────────────────────────────────────────── */

/**
 * One field for create and rename. Enter submits, Escape cancels. An error stays on the field,
 * is announced, and the typed name is kept so it can be fixed (rule 6).
 */
export function NameField({
  label,
  initial = "",
  submitLabel,
  onSubmit,
  onCancel,
}: {
  label: string;
  initial?: string;
  submitLabel: string;
  /** Returns the error to show, or null when it worked. */
  onSubmit: (name: string) => string | null;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = onSubmit(name);
    setError(problem);
    if (problem) inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      // Inside a popover, Escape closes the field, not the whole panel.
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <form className={styles.nameField} onSubmit={submit} noValidate>
      <label htmlFor={inputId} className={styles.nameLabel}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        className={styles.nameInput}
        value={name}
        maxLength={ALBUM_NAME_MAX + 20}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          setName(e.target.value);
          // Validate on every change once the field is in error (rule 6).
          if (error) setError(null);
        }}
        onKeyDown={onKeyDown}
      />
      {error && (
        <p id={errorId} className={styles.nameError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.nameActions}>
        <button type="submit" className={styles.primaryButton}>
          {submitLabel}
        </button>
        <button type="button" className={styles.quietButton} onClick={onCancel}>
          Hætta við
        </button>
      </div>
    </form>
  );
}

/** "+ Nýtt albúm", turning into the name field in place. */
export function CreateAlbum({
  api,
  withBlock,
  select = true,
  onDone,
}: {
  api: AlbumsApi;
  /** Put this block in the new album straight away (from a card's "Setja í albúm…"). */
  withBlock?: string;
  select?: boolean;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  };
  if (open) {
    return (
      <NameField
        label="Heiti nýs albúms"
        submitLabel="Búa til"
        onSubmit={(name) => {
          const { error } = api.create(name, { select, withBlock });
          if (!error) {
            // Focus goes back to "Nýtt albúm", ready for the next one, never to the page body.
            close();
            onDone?.();
          }
          return error;
        }}
        onCancel={close}
      />
    );
  }
  return (
    <button ref={buttonRef} type="button" className={styles.newAlbum} onClick={() => setOpen(true)}>
      <Plus aria-hidden="true" />
      Nýtt albúm
    </button>
  );
}

/* ── Rows ──────────────────────────────────────────────────────────────────── */

export function AlbumGlyph({ album }: { album: LabAlbum }) {
  const Icon = ALBUM_ICONS[album.icon];
  return <Icon className={styles.collectionIcon} aria-hidden="true" />;
}

function SharedMark({ album }: { album: LabAlbum }) {
  if (!album.shared) return null;
  return (
    <>
      <Users className={styles.sharedIcon} aria-hidden="true" />
      <span className={styles.srOnly}>, deilt með sveitinni</span>
    </>
  );
}

function SourceRow({
  source,
  api,
  blocks,
}: {
  source: LabSource;
  api: AlbumsApi;
  blocks: LabBlock[];
}) {
  const Icon = source.icon;
  return (
    <li>
      <button
        type="button"
        className={styles.collection}
        aria-pressed={isSelected(api.selection, "source", source.id)}
        onClick={() => api.select({ type: "source", id: source.id })}
      >
        <Icon className={styles.collectionIcon} aria-hidden="true" />
        <span className={styles.collectionName}>{source.label}</span>
        <span className={styles.collectionCount}>{blocksWord(sourceCount(source.id, blocks))}</span>
      </button>
    </li>
  );
}

/** Rename and delete, behind "…" on a row. */
function AlbumActions({
  album,
  api,
  onRename,
}: {
  album: LabAlbum;
  api: AlbumsApi;
  onRename: () => void;
}) {
  return (
    <Popover
      label={`Aðgerðir: ${album.name}`}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className={styles.iconButton}
          aria-label={`Aðgerðir fyrir ${album.name}`}
        >
          <Ellipsis aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <div className={styles.menu}>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              close();
              onRename();
            }}
          >
            Endurnefna
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              close();
              api.remove(album.id);
            }}
          >
            Eyða albúmi
          </button>
        </div>
      )}
    </Popover>
  );
}

function AlbumRow({
  album,
  api,
  renaming,
  setRenaming,
  handle,
  onSelect,
  sortable,
}: {
  album: LabAlbum;
  api: AlbumsApi;
  renaming: string | null;
  setRenaming: (id: string | null) => void;
  handle?: ReactNode;
  onSelect?: () => void;
  /** C4: the row is a dnd-kit sortable node. */
  sortable?: { ref: (node: HTMLElement | null) => void; style: CSSProperties; dragging: boolean };
}) {
  const rowProps = {
    ref: sortable?.ref,
    style: sortable?.style,
    "data-dragging": sortable?.dragging || undefined,
    className: styles.albumRow,
  };
  if (renaming === album.id) {
    return (
      <li {...rowProps}>
        <NameField
          label={`Nýtt heiti á ${album.name}`}
          initial={album.name}
          submitLabel="Vista"
          onSubmit={(name) => {
            const error = api.rename(album.id, name);
            if (!error) setRenaming(null);
            return error;
          }}
          onCancel={() => setRenaming(null)}
        />
      </li>
    );
  }
  return (
    <li {...rowProps}>
      {handle}
      <button
        type="button"
        className={styles.collection}
        aria-pressed={isSelected(api.selection, "album", album.id)}
        onClick={() => {
          api.select({ type: "album", id: album.id });
          onSelect?.();
        }}
      >
        <AlbumGlyph album={album} />
        <span className={styles.collectionName}>
          {album.name}
          <SharedMark album={album} />
        </span>
        <span className={styles.collectionCount}>{blocksWord(album.blockIds.length)}</span>
      </button>
      <AlbumActions album={album} api={api} onRename={() => setRenaming(album.id)} />
    </li>
  );
}

/* ── C1 · Folder list ──────────────────────────────────────────────────────── */

export function FolderList({ api, blocks, named }: CollectionsProps) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const bank = SOURCES.filter((s) => s.group === "bankinn");
  const mine = SOURCES.filter((s) => s.group === "mitt");
  const headId = useId();
  return (
    <nav className={styles.folderList} aria-label={named("Söfn")}>
      <h3 className={styles.groupHead}>Bankinn</h3>
      <ul className={styles.rows}>
        {bank.map((source) => (
          <SourceRow key={source.id} source={source} api={api} blocks={blocks} />
        ))}
      </ul>
      <div className={styles.groupHeadRow}>
        <h3 className={styles.groupHead} id={headId}>
          Mitt
        </h3>
        <CreateAlbum api={api} />
      </div>
      {/* Only "Mitt" scrolls: the bank's three rows never grow, the albums do. */}
      <ul className={`${styles.rows} ${styles.scrollRows}`} aria-labelledby={headId}>
        {mine.map((source) => (
          <SourceRow key={source.id} source={source} api={api} blocks={blocks} />
        ))}
        {api.albums.map((album) => (
          <AlbumRow
            key={album.id}
            album={album}
            api={api}
            renaming={renaming}
            setRenaming={setRenaming}
          />
        ))}
      </ul>
    </nav>
  );
}

/* ── C2 · Album covers ─────────────────────────────────────────────────────── */

/** Up to four of the album's blocks as a 2 × 2 mosaic; the album's icon while it's empty. */
function Cover({ album, blocks }: { album: LabAlbum; blocks: LabBlock[] }) {
  const inside = album.blockIds
    .map((id) => blocks.find((b) => b.id === id))
    .filter((b): b is LabBlock => Boolean(b))
    .slice(0, 4);
  if (inside.length === 0) {
    return (
      <span className={styles.coverEmpty} aria-hidden="true">
        <AlbumGlyph album={album} />
      </span>
    );
  }
  return (
    <span className={styles.mosaic} aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => {
        const block = inside[i];
        if (!block) return <span key={i} className={styles.mosaicBlank} />;
        const { icon: Icon } = themeIcon(block.theme);
        return (
          <span key={i} className={styles.mosaicTile} data-kind={block.kind}>
            {block.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- a lab fixture SVG.
              <img src={block.image} alt="" />
            ) : (
              <Icon />
            )}
          </span>
        );
      })}
    </span>
  );
}

export function AlbumCovers({ api, blocks, named }: CollectionsProps) {
  const [renaming, setRenaming] = useState(false);
  const selected =
    api.selection.type === "album" ? api.albums.find((a) => a.id === api.selection.id) : undefined;
  return (
    <nav className={styles.coverNav} aria-label={named("Söfn")}>
      <div className={styles.sourceTabs} role="group" aria-label="Bankinn">
        {SOURCES.map((source) => {
          const Icon = source.icon;
          return (
            <button
              key={source.id}
              type="button"
              className={styles.sourceTab}
              aria-pressed={isSelected(api.selection, "source", source.id)}
              onClick={() => api.select({ type: "source", id: source.id })}
            >
              <Icon aria-hidden="true" />
              <span>{source.label}</span>
              <span className={styles.srOnly}>, {blocksWord(sourceCount(source.id, blocks))}</span>
            </button>
          );
        })}
      </div>
      <h3 className={styles.groupHead}>
        Albúm{" "}
        <span className={styles.groupCount}>{countIs(api.albums.length, "albúm", "albúm")}</span>
      </h3>
      <ul className={styles.covers} aria-label="Albúm">
        {api.albums.map((album) => (
          <li key={album.id}>
            <button
              type="button"
              className={styles.cover}
              aria-pressed={isSelected(api.selection, "album", album.id)}
              onClick={() => {
                setRenaming(false);
                api.select({ type: "album", id: album.id });
              }}
            >
              <Cover album={album} blocks={blocks} />
              <span className={styles.coverName}>
                {album.name}
                <SharedMark album={album} />
              </span>
              <span className={styles.collectionCount}>{blocksWord(album.blockIds.length)}</span>
            </button>
          </li>
        ))}
        <li className={styles.coverNew}>
          <CreateAlbum api={api} />
        </li>
      </ul>
      {/* A cover is too small for a "…" button, so the selected album's actions sit under the
          covers, as words. */}
      {selected && (
        <div className={styles.albumBar}>
          {renaming ? (
            <NameField
              label={`Nýtt heiti á ${selected.name}`}
              initial={selected.name}
              submitLabel="Vista"
              onSubmit={(name) => {
                const error = api.rename(selected.id, name);
                if (!error) setRenaming(false);
                return error;
              }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <>
              <span className={styles.albumBarName}>{selected.name}</span>
              <button
                type="button"
                className={styles.quietButton}
                onClick={() => setRenaming(true)}
              >
                Endurnefna
              </button>
              <button
                type="button"
                className={styles.quietButton}
                onClick={() => api.remove(selected.id)}
              >
                Eyða albúmi
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

/* ── C3 · Chips + "Öll albúm…" ─────────────────────────────────────────────── */

/** How many albums get a chip of their own; the rest are one press away. */
const CHIP_ALBUMS = 2;

export function ChipRow({ api, blocks, named }: CollectionsProps) {
  const [renaming, setRenaming] = useState<string | null>(null);
  // The first albums in the leader's own order, plus the selected one, so it's always visible.
  const shown = api.albums.slice(0, CHIP_ALBUMS);
  const selectedAlbum =
    api.selection.type === "album" ? api.albums.find((a) => a.id === api.selection.id) : undefined;
  if (selectedAlbum && !shown.includes(selectedAlbum)) shown.push(selectedAlbum);
  const hidden = api.albums.length - shown.length;

  return (
    <nav className={styles.chipNav} aria-label={named("Söfn")}>
      {SOURCES.map((source) => {
        const Icon = source.icon;
        return (
          <button
            key={source.id}
            type="button"
            className={styles.collectionChip}
            aria-pressed={isSelected(api.selection, "source", source.id)}
            onClick={() => api.select({ type: "source", id: source.id })}
          >
            <span className={styles.chipFace}>
              <Icon aria-hidden="true" />
              {source.label}
              <span className={styles.srOnly}>, {blocksWord(sourceCount(source.id, blocks))}</span>
            </span>
          </button>
        );
      })}
      {shown.map((album) => (
        <button
          key={album.id}
          type="button"
          className={styles.collectionChip}
          aria-pressed={isSelected(api.selection, "album", album.id)}
          onClick={() => api.select({ type: "album", id: album.id })}
        >
          <span className={styles.chipFace}>
            <AlbumGlyph album={album} />
            <span className={styles.chipName}>{album.name}</span>
            <SharedMark album={album} />
            <span className={styles.srOnly}>, {blocksWord(album.blockIds.length)}</span>
          </span>
        </button>
      ))}
      <Popover
        label="Öll albúm"
        wide
        trigger={(props) => (
          <button {...props} type="button" className={styles.collectionChip}>
            <span className={`${styles.chipFace} ${styles.chipMore}`}>
              Öll albúm…
              {hidden > 0 && <span className={styles.chipBadge}>+{hidden}</span>}
              <ChevronDown aria-hidden="true" />
            </span>
          </button>
        )}
      >
        {(close) => (
          <>
            <h3 className={styles.popoverHead}>
              Albúm{" "}
              <span className={styles.groupCount}>
                {countIs(api.albums.length, "albúm", "albúm")}
              </span>
            </h3>
            {api.albums.length === 0 && <p className={styles.popoverNote}>Engin albúm enn.</p>}
            <ul className={`${styles.rows} ${styles.scrollRows}`}>
              {api.albums.map((album) => (
                <AlbumRow
                  key={album.id}
                  album={album}
                  api={api}
                  renaming={renaming}
                  setRenaming={setRenaming}
                  onSelect={close}
                />
              ))}
            </ul>
            <div className={styles.createRow}>
              <CreateAlbum api={api} onDone={close} />
            </div>
          </>
        )}
      </Popover>
    </nav>
  );
}

/* ── C4 · Tabs: Bankinn · Mitt ─────────────────────────────────────────────── */

const sortId = (albumId: string) => `album:${albumId}`;

/** dnd-kit animates the other rows as one moves; under reduced motion they jump instead. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function SortableAlbumRow(
  props: Parameters<typeof AlbumRow>[0] & { index: number; total: number; hintId: string }
) {
  const { album, api, index, total, hintId } = props;
  // dnd-kit's `attributes` are left off: they describe a keyboard drag this list doesn't use.
  const { listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: sortId(album.id), transition: prefersReducedMotion() ? null : undefined });

  /** The keyboard path for reordering: arrows on the handle, as on the bench's rows. */
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!delta) return;
    event.preventDefault();
    api.move(album.id, index + delta);
    // React keeps the node but the move can drop focus; put it back on the same album's handle.
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-album-handle="${album.id}"]`)?.focus()
    );
  };

  const handle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      className={styles.handle}
      data-album-handle={album.id}
      aria-label={`Færa ${album.name}, sæti ${index + 1} af ${total}`}
      aria-describedby={hintId}
      {...listeners}
      onKeyDown={onKeyDown}
    >
      <GripVertical aria-hidden="true" />
    </button>
  );

  return (
    <AlbumRow
      {...props}
      handle={handle}
      sortable={{
        ref: setNodeRef,
        style: {
          transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined,
          transition,
        },
        dragging: isDragging,
      }}
    />
  );
}

export function TreeTabs({ api, blocks, named }: CollectionsProps) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const inMine =
    api.selection.type === "album" ||
    (api.selection.type === "source" && api.selection.id === "sveitin");
  const [tab, setTab] = useState<"bankinn" | "mitt">(inMine ? "mitt" : "bankinn");
  const base = useId();
  const hintId = `${base}-hint`;
  const tabs = [
    { id: "bankinn" as const, label: "Bankinn" },
    { id: "mitt" as const, label: "Mitt" },
  ];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    )
      return;
    event.preventDefault();
    const next = tab === "bankinn" ? "mitt" : "bankinn";
    const target = event.key === "Home" ? "bankinn" : event.key === "End" ? "mitt" : next;
    setTab(target);
    requestAnimationFrame(() => document.getElementById(`${base}-tab-${target}`)?.focus());
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const to = api.albums.findIndex((a) => sortId(a.id) === over.id);
    api.move(String(active.id).replace(/^album:/, ""), to);
  };

  return (
    <nav className={styles.treeNav} aria-label={named("Söfn")}>
      <div className={styles.tabList} role="tablist" aria-label="Söfn">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`${base}-tab-${t.id}`}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={tab === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={onTabKey}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          id={`${base}-panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={tab !== t.id}
          className={styles.tabPanel}
        >
          {t.id === "bankinn" ? (
            <ul className={styles.rows}>
              {SOURCES.filter((s) => s.group === "bankinn").map((source) => (
                <SourceRow key={source.id} source={source} api={api} blocks={blocks} />
              ))}
            </ul>
          ) : (
            <>
              <ul className={styles.rows}>
                {SOURCES.filter((s) => s.group === "mitt").map((source) => (
                  <SourceRow key={source.id} source={source} api={api} blocks={blocks} />
                ))}
              </ul>
              <p id={hintId} className={styles.srOnly}>
                Upp- og niðurörvar færa albúmið.
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={api.albums.map((a) => sortId(a.id))}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className={`${styles.rows} ${styles.scrollRows}`} aria-label="Albúmin mín">
                    {api.albums.map((album, index) => (
                      <SortableAlbumRow
                        key={album.id}
                        album={album}
                        api={api}
                        renaming={renaming}
                        setRenaming={setRenaming}
                        index={index}
                        total={api.albums.length}
                        hintId={hintId}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
              <div className={styles.createRow}>
                <CreateAlbum api={api} />
              </div>
            </>
          )}
        </div>
      ))}
    </nav>
  );
}

export const COLLECTIONS: Record<CollectionsLook, (props: CollectionsProps) => ReactNode> = {
  mappa: FolderList,
  kapur: AlbumCovers,
  flogar: ChipRow,
  tre: TreeTabs,
};
