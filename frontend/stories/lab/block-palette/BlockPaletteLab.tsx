"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { ChevronDown, GripVertical, Search, X } from "lucide-react";
import { useBench } from "@/components/plan/bench/BenchProvider";
import { blockAsLidur, dragId } from "@/components/plan/bench/dnd";
import { LIBRARY_FOLDERS, LIBRARY_KINDS } from "@/lib/mock/library.mock";
import { countIs, formatAgeGroups } from "@/lib/format";
import { BAND_OF, BANDS, type BandId, type SlotKind } from "@/services/plan.service";
import {
  FALLBACK_THEME_ICON,
  KIND_ICON,
  LAB_BLOCKS,
  THEME_ICON,
  themeIcon,
  type IconEntry,
  type LabBlock,
} from "./blockPaletteLabData";
import styles from "./BlockPaletteLab.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */

/**
 * - `merki`: A · Icons. Every block carries a picture: its own image, or its theme's icon.
 * - `listi`: B · Minimal list. Title and minutes; the rest behind hover, focus and an expand.
 * - `spjold`: C · Card grid. Two columns of small cards, for browsing.
 * - `hlutar`: D · By section. Grouped by the part of the fundur the block fits; no type chips.
 */
export type BlockPaletteLook = "merki" | "listi" | "spjold" | "hlutar";

export interface BlockPaletteLabProps {
  /** Which lab direction to render. */
  look: BlockPaletteLook;
  /** The bank. Defaults to the mock bank plus the lab's extra fields. */
  blocks?: LabBlock[];
  defaultQuery?: string;
  defaultFolder?: string;
  defaultKind?: SlotKind | "allt";
  /**
   * Lab only: told apart from other rails on the same page, so the landmarks have unique
   * names (axe landmark-unique) when several rails sit side by side in the Comparison.
   */
  instanceName?: string;
}

/* ── Copy ──────────────────────────────────────────────────────────────────── */

/** The rail's type chips, plus Endurmat, which the current rail leaves out. */
const KIND_FILTERS: { id: SlotKind | "allt"; label: string }[] = [
  ...LIBRARY_KINDS,
  { id: "endurmat", label: "Endurmat" },
];

const timesUsed = (n: number) => `notað ${countIs(n, "sinni", "sinnum")}`;
const minutes = (n: number) => `${n} mín`;

/* ── The rail ──────────────────────────────────────────────────────────────── */

export default function BlockPaletteLab({
  look,
  blocks = LAB_BLOCKS,
  defaultQuery = "",
  defaultFolder = "allt",
  defaultKind = "allt",
  instanceName,
}: BlockPaletteLabProps) {
  const named = (label: string) => (instanceName ? `${label} (${instanceName})` : label);
  const bench = useBench();
  const activeId = bench?.state.active ?? null;
  const activeFundur = bench?.state.data.fundir.find((f) => f.event_id === activeId) ?? null;
  const onFundur = useMemo(
    () => new Set(activeFundur?.items.map((item) => item.name) ?? []),
    [activeFundur]
  );

  const [folder, setFolder] = useState(defaultFolder);
  const [kind, setKind] = useState<SlotKind | "allt">(defaultKind);
  const [query, setQuery] = useState(defaultQuery);
  const hintId = useId();
  const searchId = useId();

  // D replaces the type chips with its grouping, so a kind filter must not linger unseen.
  const showKinds = look !== "hlutar";
  const kindFilter = showKinds ? kind : "allt";

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("is");
    return blocks.filter((block) => {
      if (folder !== "allt" && block.folder !== folder) return false;
      if (kindFilter !== "allt" && block.kind !== kindFilter) return false;
      if (!needle) return true;
      const haystack = [block.name, block.theme, ...(block.needs ?? [])]
        .join(" ")
        .toLocaleLowerCase("is");
      return haystack.includes(needle);
    });
  }, [blocks, folder, kindFilter, query]);

  const filtered = query.trim() !== "" || folder !== "allt" || kindFilter !== "allt";
  const reset = () => {
    setQuery("");
    setFolder("allt");
    setKind("allt");
  };

  const add = activeFundur
    ? (block: LabBlock) =>
        bench?.dispatch({
          t: "add",
          fundurId: activeFundur.event_id,
          lidur: blockAsLidur(block, null),
        })
    : undefined;

  const itemProps = (block: LabBlock): ItemProps => ({
    block,
    onAdd: add ? () => add(block) : undefined,
    disabledReasonId: add ? undefined : hintId,
    isOnFundur: onFundur.has(block.name),
  });

  return (
    // A labelled section, as in the real rail: it sits inside the app's <main>.
    <section className={styles.rail} data-look={look} aria-label={named("Dagskrá og möppur")}>
      <nav className={styles.folders} aria-label={named("Möppur")}>
        {LIBRARY_FOLDERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={styles.folder}
            aria-pressed={folder === f.id}
            onClick={() => setFolder(f.id)}
          >
            <span className={styles.folderLabel}>{f.label}</span>
            <span className={styles.folderHint}>{f.hint}</span>
          </button>
        ))}
      </nav>

      <div className={styles.head}>
        <div className={styles.search}>
          <label htmlFor={searchId} className={styles.srOnly}>
            Leita í dagskrá
          </label>
          <Search className={styles.searchIcon} aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            className={styles.searchInput}
            placeholder="Leita í bankanum…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className={styles.clear}
              aria-label="Hreinsa leit"
              onClick={() => setQuery("")}
            >
              <X aria-hidden="true" />
            </button>
          )}
        </div>
        {showKinds && (
          <div className={styles.kinds} role="group" aria-label="Sía eftir tegund">
            {KIND_FILTERS.map((k) => {
              const Icon = k.id === "allt" ? null : KIND_ICON[k.id].icon;
              return (
                <button
                  key={k.id}
                  type="button"
                  className={styles.kind}
                  aria-pressed={kind === k.id}
                  onClick={() => setKind(k.id)}
                >
                  <span className={styles.kindPill}>
                    {look === "merki" && Icon && <Icon aria-hidden="true" />}
                    {k.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <p className={styles.count} role="status">
          {countIs(results.length, "blokk", "blokkir")}
          {filtered ? " passa" : " í bankanum"}
        </p>
      </div>

      {/* With every "Bæta við" disabled, A and C have nothing focusable in the list, so the
          list itself takes focus: a keyboard user must still be able to scroll and read the
          bank (axe scrollable-region-focusable). */}
      <div
        className={styles.body}
        {...(add ? {} : { tabIndex: 0, role: "region", "aria-label": named("Blokkir") })}
      >
        {blocks.length > 0 &&
          (activeFundur ? (
            <p className={styles.target}>
              Bætist við: <strong>{activeFundur.title}</strong>
            </p>
          ) : (
            // Why "Bæta við" is disabled, as visible text (docs/ux-conventions.md §9).
            <p className={styles.hint} id={hintId}>
              Veldu fund á bekknum til að bæta blokkum við. Þú getur samt dregið blokk á fund.
            </p>
          ))}

        {blocks.length === 0 ? (
          <p className={styles.empty}>
            Dagskrárbankinn er ekki tengdur enn. Þegar bakendinn svarar birtast blokkirnar hér.
          </p>
        ) : results.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>
              Ekkert fannst{query.trim() ? ` fyrir „${query.trim()}“` : ""}.
            </p>
            <p>Prófaðu færri orð, aðra möppu eða aðra tegund.</p>
            <button type="button" className={styles.secondaryButton} onClick={reset}>
              Hreinsa leit og síur
            </button>
          </div>
        ) : look === "hlutar" ? (
          <Sections blocks={results} itemProps={itemProps} />
        ) : (
          <ul className={styles.list} aria-label="Blokkir">
            {results.map((block) => {
              const props = itemProps(block);
              if (look === "listi") return <ListItem key={block.id} {...props} />;
              if (look === "spjold") return <CardItem key={block.id} {...props} />;
              return <IconItem key={block.id} {...props} />;
            })}
          </ul>
        )}
      </div>

      <div className={styles.foot}>
        {/* Not built yet (sc-148): visibly "Kemur síðar", never a live button (§9). */}
        <button type="button" className={styles.create} disabled>
          + Búa til nýja blokk <span className={styles.soon}>Kemur síðar</span>
        </button>
      </div>
    </section>
  );
}

/* ── Shared item parts ─────────────────────────────────────────────────────── */

interface ItemProps {
  block: LabBlock;
  /** Absent while there is no fundur to add to. */
  onAdd?: () => void;
  /** The visible hint that says why "Bæta við" is disabled. */
  disabledReasonId?: string;
  /** A liður with this name is already on the active fundur. */
  isOnFundur: boolean;
}

/**
 * Drag from the handle only, as in the real rail, so "Bæta við" stays a plain click. The handle
 * gets no `role="button"`: there is no keyboard drag here, and "Bæta við" is the keyboard path.
 */
function useBlockDrag(block: LabBlock) {
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId.library(block.id),
    data: { kind: "library", block },
  });
  return { listeners, setNodeRef, isDragging };
}

function Grip({ drag, children }: { drag: ReturnType<typeof useBlockDrag>; children?: ReactNode }) {
  return (
    <span
      ref={drag.setNodeRef}
      className={children ? styles.gripArea : styles.grip}
      aria-hidden="true"
      {...drag.listeners}
    >
      {children ?? <GripVertical />}
    </span>
  );
}

function AddButton({ onAdd, disabledReasonId, wide }: ItemProps & { wide?: boolean }) {
  return (
    <button
      type="button"
      className={wide ? `${styles.add} ${styles.addWide}` : styles.add}
      disabled={!onAdd}
      aria-describedby={disabledReasonId}
      onClick={onAdd}
    >
      Bæta við
    </button>
  );
}

/** The block's picture: its own image if it has one, else its theme's icon on its kind's tint. */
function Marker({ block, size }: { block: LabBlock; size: "sm" | "lg" }) {
  const { icon: Icon } = themeIcon(block.theme);
  return (
    <span className={styles.marker} data-size={size} data-kind={block.kind}>
      {block.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- a lab fixture SVG; next/image does not optimise SVG.
        <img className={styles.markerImage} src={block.image} alt="" />
      ) : (
        <Icon className={styles.markerIcon} aria-hidden="true" />
      )}
    </span>
  );
}

function KindLabel({ kind }: { kind: SlotKind }) {
  const { icon: Icon, label } = KIND_ICON[kind];
  return (
    <span className={styles.kindLabel}>
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}

function Flags({ block, isOnFundur }: { block: LabBlock; isOnFundur: boolean }) {
  if (!block.endurmat && !isOnFundur) return null;
  return (
    <>
      {block.endurmat && <span className={styles.flag}>Endurmat fylgir</span>}
      {isOnFundur && <span className={styles.flag}>Þegar á fundinum</span>}
    </>
  );
}

/* ── A · Icons ─────────────────────────────────────────────────────────────── */

function IconItem(props: ItemProps) {
  const { block, isOnFundur } = props;
  const drag = useBlockDrag(block);
  return (
    <li
      className={styles.iconItem}
      data-kind={block.kind}
      data-dragging={drag.isDragging || undefined}
    >
      <Grip drag={drag} />
      <Marker block={block} size="sm" />
      <div className={styles.itemBody}>
        <span className={styles.title}>{block.name}</span>
        <span className={styles.meta}>
          <KindLabel kind={block.kind} />
          <span className={styles.num}>{minutes(block.minutes)}</span>
          <span>{block.theme}</span>
        </span>
        <span className={styles.itemFoot}>
          <span className={styles.meta}>
            <span>{timesUsed(block.timesUsed)}</span>
            <Flags block={block} isOnFundur={isOnFundur} />
          </span>
          <AddButton {...props} />
        </span>
      </div>
    </li>
  );
}

/* ── B · Minimal list ──────────────────────────────────────────────────────── */

function ListItem(props: ItemProps) {
  const { block, isOnFundur } = props;
  const drag = useBlockDrag(block);
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  return (
    <li
      className={styles.listItem}
      data-kind={block.kind}
      data-dragging={drag.isDragging || undefined}
    >
      <Grip drag={drag} />
      <button
        type="button"
        className={styles.summary}
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.title}>{block.name}</span>
        <span className={styles.summaryMinutes}>{minutes(block.minutes)}</span>
        <ChevronDown className={styles.chevron} aria-hidden="true" />
      </button>
      <AddButton {...props} />
      {/* A one-line preview on hover or focus. Information only, so hiding it on touch loses
          nothing the expand does not also show (rule 8 is about actions). */}
      <span className={styles.peek} aria-hidden="true">
        <span className={styles.peekInner}>
          {KIND_ICON[block.kind].label} · {block.theme} · {timesUsed(block.timesUsed)}
        </span>
      </span>
      <dl className={styles.details} id={detailsId} hidden={!open}>
        <div>
          <dt>Tegund</dt>
          <dd>{KIND_ICON[block.kind].label}</dd>
        </div>
        <div>
          <dt>Þema</dt>
          <dd>{block.theme}</dd>
        </div>
        {block.ages && block.ages.length > 0 && (
          <div>
            <dt>Aldur</dt>
            <dd>{formatAgeGroups(block.ages)}</dd>
          </div>
        )}
        {block.needs && block.needs.length > 0 && (
          <div>
            <dt>Búnaður</dt>
            <dd>{block.needs.join(", ")}</dd>
          </div>
        )}
        {block.prepMinutes !== undefined && (
          <div>
            <dt>Undirbúningur</dt>
            <dd>{minutes(block.prepMinutes)}</dd>
          </div>
        )}
        <div>
          <dt>Notkun</dt>
          <dd>{timesUsed(block.timesUsed)}</dd>
        </div>
        {block.endurmat && (
          <div>
            <dt>Síðasta endurmat</dt>
            <dd>{block.endurmat}</dd>
          </div>
        )}
        {isOnFundur && (
          <div>
            <dt>Á fundinum</dt>
            <dd>Þegar á fundinum</dd>
          </div>
        )}
      </dl>
    </li>
  );
}

/* ── C · Card grid ─────────────────────────────────────────────────────────── */

function CardItem(props: ItemProps) {
  const { block, isOnFundur } = props;
  const drag = useBlockDrag(block);
  return (
    <li className={styles.card} data-kind={block.kind} data-dragging={drag.isDragging || undefined}>
      {/* The picture is the drag handle: the biggest thing on the card is the easiest to grab. */}
      <Grip drag={drag}>
        <Marker block={block} size="lg" />
        <GripVertical className={styles.cardGrip} />
      </Grip>
      <div className={styles.cardBody}>
        <span className={styles.title}>{block.name}</span>
        <span className={styles.meta}>
          <span className={styles.num}>{minutes(block.minutes)}</span>
          <span>{KIND_ICON[block.kind].label}</span>
        </span>
        <span className={styles.meta}>
          <span>{timesUsed(block.timesUsed)}</span>
          <Flags block={block} isOnFundur={isOnFundur} />
        </span>
      </div>
      <AddButton {...props} wide />
    </li>
  );
}

/* ── D · By section ────────────────────────────────────────────────────────── */

/** In Setning every block is a setning, so the type word is only shown where two kinds share. */
const MIXED_BANDS: BandId[] = ["kjarni", "lok"];

function Sections({
  blocks,
  itemProps,
}: {
  blocks: LabBlock[];
  itemProps: (block: LabBlock) => ItemProps;
}) {
  const idBase = useId();
  const [closed, setClosed] = useState<Set<BandId>>(new Set());
  const toggle = (band: BandId) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(band)) next.delete(band);
      else next.add(band);
      return next;
    });

  return (
    <div className={styles.sections}>
      {BANDS.map((band) => {
        const inBand = blocks.filter((block) => BAND_OF[block.kind] === band.id);
        if (inBand.length === 0) return null;
        const isOpen = !closed.has(band.id);
        const listId = `${idBase}-${band.id}`;
        return (
          <section key={band.id} className={styles.section} aria-label={band.label}>
            <h3 className={styles.sectionHead}>
              <button
                type="button"
                className={styles.sectionToggle}
                aria-expanded={isOpen}
                aria-controls={listId}
                onClick={() => toggle(band.id)}
              >
                <span>{band.label}</span>
                <span className={styles.sectionCount}>
                  {countIs(inBand.length, "blokk", "blokkir")}
                </span>
                <ChevronDown className={styles.chevron} aria-hidden="true" />
              </button>
            </h3>
            <ul className={styles.list} id={listId} hidden={!isOpen}>
              {inBand.map((block) => (
                <SectionItem
                  key={block.id}
                  {...itemProps(block)}
                  showKind={MIXED_BANDS.includes(band.id)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SectionItem(props: ItemProps & { showKind: boolean }) {
  const { block, isOnFundur, showKind } = props;
  const drag = useBlockDrag(block);
  return (
    <li
      className={styles.sectionItem}
      data-kind={block.kind}
      data-dragging={drag.isDragging || undefined}
    >
      <Grip drag={drag} />
      <span className={styles.stripe} aria-hidden="true" />
      <div className={styles.itemBody}>
        <span className={styles.title}>{block.name}</span>
        <span className={styles.meta}>
          {showKind && <span>{KIND_ICON[block.kind].label}</span>}
          <span className={styles.num}>{minutes(block.minutes)}</span>
          <span>{block.theme}</span>
        </span>
        <span className={styles.meta}>
          <span>{timesUsed(block.timesUsed)}</span>
          <Flags block={block} isOnFundur={isOnFundur} />
        </span>
      </div>
      <AddButton {...props} />
    </li>
  );
}

/* ── The icon mapping, as a reference sheet ────────────────────────────────── */

function MappingTable({
  caption,
  rows,
}: {
  caption: string;
  rows: { key: string; kind: SlotKind; entry: IconEntry }[];
}) {
  return (
    <table className={styles.mapping}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Merki</th>
          <th scope="col">Heiti</th>
          <th scope="col">Lucide</th>
          <th scope="col">Why</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ key, kind, entry }) => (
          <tr key={key}>
            <td>
              <span className={styles.marker} data-size="sm" data-kind={kind}>
                <entry.icon className={styles.markerIcon} aria-hidden="true" />
              </span>
            </td>
            <th scope="row">{entry.label}</th>
            <td>
              <code>{entry.icon.displayName ?? ""}</code>
            </td>
            <td>{entry.why}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Every type and theme icon, on the tint it gets in the rail. */
export function IconMappingSheet() {
  const kinds = (Object.keys(KIND_ICON) as SlotKind[]).map((kind) => ({
    key: kind,
    kind,
    entry: KIND_ICON[kind],
  }));
  const themes = [
    ...Object.entries(THEME_ICON).map(([theme, entry]) => ({
      key: theme,
      // A theme tile takes the tint of the kind it most often comes with; "Annað" stays neutral.
      kind: (theme === "Hefðir"
        ? "setning"
        : theme === "Endurmat"
          ? "endurmat"
          : "dagskra") as SlotKind,
      entry,
    })),
    { key: "fallback", kind: "custom" as SlotKind, entry: FALLBACK_THEME_ICON },
  ];
  return (
    <div className={styles.rail} style={{ height: "auto", border: 0 }}>
      <MappingTable caption="Tegund (kind): when in the fundur it runs" rows={kinds} />
      <MappingTable caption="Þema (theme): what it is about" rows={themes} />
    </div>
  );
}
