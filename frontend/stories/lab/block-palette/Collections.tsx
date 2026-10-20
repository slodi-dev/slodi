"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Plus, Users } from "lucide-react";
import { countIs } from "@/lib/format";
import {
  FOLDER_ICONS,
  SOURCES,
  themeIcon,
  type LabFolder,
  type LabBlock,
  type LabSource,
} from "./blockPaletteLabData";
import { FOLDER_NAME_MAX, type FoldersApi, type Selection } from "./useFolders";
import styles from "./BlockPaletteLab.module.css";

export interface CollectionsProps {
  api: FoldersApi;
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
        className={styles.popover}
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

/* ── Naming a folder ───────────────────────────────────────────────────────── */

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
        maxLength={FOLDER_NAME_MAX + 20}
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

/** "+ Ný mappa", turning into the name field in place. */
export function CreateFolder({
  api,
  withBlock,
  select = true,
  onDone,
}: {
  api: FoldersApi;
  /** Put this block in the new folder straight away (from a card's "Setja í möppu…"). */
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
        label="Heiti nýrrar möppu"
        submitLabel="Búa til"
        onSubmit={(name) => {
          const { error } = api.create(name, { select, withBlock });
          if (!error) {
            // Focus goes back to "Ný mappa", ready for the next one, never to the page body.
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
    <button
      ref={buttonRef}
      type="button"
      className={styles.newFolder}
      onClick={() => setOpen(true)}
    >
      <Plus aria-hidden="true" />
      Ný mappa
    </button>
  );
}

/* ── Rows ──────────────────────────────────────────────────────────────────── */

export function FolderGlyph({ folder }: { folder: LabFolder }) {
  const Icon = FOLDER_ICONS[folder.icon];
  return <Icon className={styles.collectionIcon} aria-hidden="true" />;
}

function SharedMark({ folder }: { folder: LabFolder }) {
  if (!folder.shared) return null;
  return (
    <>
      <Users className={styles.sharedIcon} aria-hidden="true" />
      <span className={styles.srOnly}>, deilt með sveitinni</span>
    </>
  );
}

/* ── C2 · Folder covers ─────────────────────────────────────────────────────── */

/** Up to four of the folder's blocks as a 2 × 2 mosaic; the folder's icon while it's empty. */
function Cover({ folder, blocks }: { folder: LabFolder; blocks: LabBlock[] }) {
  const inside = folder.blockIds
    .map((id) => blocks.find((b) => b.id === id))
    .filter((b): b is LabBlock => Boolean(b))
    .slice(0, 4);
  if (inside.length === 0) {
    return (
      <span className={styles.coverEmpty} aria-hidden="true">
        <FolderGlyph folder={folder} />
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

export function FolderCovers({ api, blocks, named }: CollectionsProps) {
  const [renaming, setRenaming] = useState(false);
  const selected =
    api.selection.type === "folder"
      ? api.folders.find((a) => a.id === api.selection.id)
      : undefined;
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
        Möppur{" "}
        <span className={styles.groupCount}>{countIs(api.folders.length, "mappa", "möppur")}</span>
      </h3>
      <ul className={styles.covers} aria-label="Möppur">
        {api.folders.map((folder) => (
          <li key={folder.id}>
            <button
              type="button"
              className={styles.cover}
              aria-pressed={isSelected(api.selection, "folder", folder.id)}
              onClick={() => {
                setRenaming(false);
                api.select({ type: "folder", id: folder.id });
              }}
            >
              <Cover folder={folder} blocks={blocks} />
              <span className={styles.coverName}>
                {folder.name}
                <SharedMark folder={folder} />
              </span>
              <span className={styles.collectionCount}>{blocksWord(folder.blockIds.length)}</span>
            </button>
          </li>
        ))}
        <li className={styles.coverNew}>
          <CreateFolder api={api} />
        </li>
      </ul>
      {/* A cover is too small for a "…" button, so the selected folder's actions sit under the
          covers, as words. */}
      {selected && (
        <div className={styles.folderBar}>
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
              <span className={styles.folderBarName}>{selected.name}</span>
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
                Eyða möppu
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
