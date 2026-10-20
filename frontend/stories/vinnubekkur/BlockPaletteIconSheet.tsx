import type { SlotKind } from "@/services/plan.service";
import {
  FALLBACK_THEME_ICON,
  KIND_ICON,
  THEME_ICON,
  type IconEntry,
} from "@/components/plan/bench/blockIcons";
import styles from "@/components/plan/bench/palette.module.css";

/**
 * The BlockPalette's icons as a reference sheet, for the "Icon mapping" story: every type and
 * theme icon on the tint it gets on a card, with why that picture.
 */

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
              <span className={`${styles.marker} ${styles.markerSmall}`} data-kind={kind}>
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

/** Every type and theme icon, on the tint it gets on a card. */
export function IconMappingSheet() {
  const kinds = (Object.keys(KIND_ICON) as SlotKind[]).map((kind) => ({
    key: kind,
    kind,
    entry: KIND_ICON[kind],
  }));
  const themes = [
    ...Object.entries(THEME_ICON).map(([theme, entry]) => ({
      key: theme,
      // A theme tile takes the tint of the kind it most often comes with.
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
    <div className={styles.sheet}>
      <MappingTable caption="Tegund (kind): when in the fundur it runs" rows={kinds} />
      <MappingTable caption="Þema (theme): what it is about" rows={themes} />
    </div>
  );
}
