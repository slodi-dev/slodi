/**
 * Formatting utilities for human-readable Icelandic program metadata strings.
 *
 * All functions are pure — no side effects, no module-level state.
 * Output strings are suitable for direct use as aria-label values.
 */

// ── Age Groups ──────────────────────────────────────────────────────────────────

const AGE_GROUP_DISPLAY: Record<string, string> = {
  Hrefnuskátar: "Hrefnuskátar",
  Drekaskátar: "Drekaskátar",
  Fálkaskátar: "Fálkaskátar",
  Dróttskátar: "Dróttskátar",
  Rekkaskátar: "Rekkaskátar",
  Róverskátar: "Róverskátar",
  Vættaskátar: "Vættaskátar",
};

/**
 * Map an age group enum value to its patrol token key (used for CSS classes).
 * Returns undefined for unknown groups.
 */
const AGE_GROUP_PATROL: Record<string, string> = {
  Drekaskátar: "drekar",
  Fálkaskátar: "falkar",
  Dróttskátar: "drott",
  Rekkaskátar: "rekkar",
  Róverskátar: "rover",
  Hrefnuskátar: "adrir",
  Vættaskátar: "adrir",
};

/**
 * The age bands, youngest first — the order BÍS lists them in.
 *
 * Exported so that a form, a filter and a card cannot disagree about how many
 * there are. They already had: the create form was offering five of the seven,
 * quietly making Hrefnuskátar and Vættaskátar unselectable for submitters.
 */
export const AGE_GROUPS = Object.keys(AGE_GROUP_DISPLAY);

export function getAgeGroupPatrol(age: string): string | undefined {
  return AGE_GROUP_PATROL[age];
}

// ── Minutes ─────────────────────────────────────────────────────────────────────

/**
 * Format a number of minutes into a short Icelandic string.
 *
 * - `0` → `"0 mín"`
 * - `30` → `"30 mín"`
 * - `60` → `"1 klst"`
 * - `90` → `"1 klst 30 mín"`
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} mín`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (remaining === 0) {
    return `${hours} klst`;
  }

  return `${hours} klst ${remaining} mín`;
}

/**
 * Format a number of minutes into a full Icelandic string for screen readers.
 *
 * - `0` → `"0 mínútur"`
 * - `1` → `"1 mínúta"`
 * - `21` → `"21 mínúta"`
 * - `30` → `"30 mínútur"`
 * - `60` → `"1 klukkustund"`
 * - `90` → `"1 klukkustund 30 mínútur"`
 * - `120` → `"2 klukkustundir"`
 */
function formatMinutesFull(minutes: number): string {
  if (minutes < 60) return countIs(minutes, "mínúta", "mínútur");

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  const hourWord = countIs(hours, "klukkustund", "klukkustundir");

  if (remaining === 0) {
    return hourWord;
  }

  return `${hourWord} ${countIs(remaining, "mínúta", "mínútur")}`;
}

// ── Duration ────────────────────────────────────────────────────────────────────

/**
 * Format a duration range as a short Icelandic string.
 *
 * - Both undefined → `""`
 * - Only one defined → single value
 * - `min === max` → single value
 * - Otherwise → `"30 mín – 1 klst"`
 */
export function formatDuration(min: number | undefined, max: number | undefined): string {
  if (min === undefined && max === undefined) return "";
  if (min === undefined) return formatMinutes(max!);
  if (max === undefined) return formatMinutes(min);
  if (min === max) return formatMinutes(min);
  return `${formatMinutes(min)} – ${formatMinutes(max)}`;
}

/**
 * Screen-reader-friendly duration label using full Icelandic words.
 *
 * - Both undefined → `""`
 * - Single value → `"Lengd: 30 mínútur"`
 * - Range → `"Lengd: 30 mínútur til 1 klukkustund"`
 */
export function formatDurationLabel(min: number | undefined, max: number | undefined): string {
  if (min === undefined && max === undefined) return "";
  if (min === undefined) return `Lengd: ${formatMinutesFull(max!)}`;
  if (max === undefined) return `Lengd: ${formatMinutesFull(min)}`;
  if (min === max) return `Lengd: ${formatMinutesFull(min)}`;
  return `Lengd: ${formatMinutesFull(min)} til ${formatMinutesFull(max)}`;
}

// ── Prep Time ───────────────────────────────────────────────────────────────────

/**
 * Format a prep time range — same logic as duration.
 */
export function formatPrepTime(min: number | undefined, max: number | undefined): string {
  if (min === undefined && max === undefined) return "";
  if (min === undefined) return formatMinutes(max!);
  if (max === undefined) return formatMinutes(min);
  if (min === max) return formatMinutes(min);
  return `${formatMinutes(min)} – ${formatMinutes(max)}`;
}

/**
 * Screen-reader-friendly prep time label.
 */
export function formatPrepTimeLabel(min: number | undefined, max: number | undefined): string {
  if (min === undefined && max === undefined) return "";
  if (min === undefined) return `Undirbúningstími: ${formatMinutesFull(max!)}`;
  if (max === undefined) return `Undirbúningstími: ${formatMinutesFull(min)}`;
  if (min === max) return `Undirbúningstími: ${formatMinutesFull(min)}`;
  return `Undirbúningstími: ${formatMinutesFull(min)} til ${formatMinutesFull(max)}`;
}

// ── Participants ────────────────────────────────────────────────────────────────

/**
 * Format participant count with correct Icelandic plurals.
 *
 * - `1` → `"1 þátttakandi"`
 * - `21` → `"21 þátttakandi"`
 * - `5` → `"5 þátttakendur"`
 * - Range → `"5–15 þátttakendur"`
 */
export function formatParticipants(min: number | undefined, max: number | undefined): string {
  if (min === undefined && max === undefined) return "";

  const participants = (n: number) => countIs(n, "þátttakandi", "þátttakendur");

  if (min === undefined) return participants(max!);
  if (max === undefined) return participants(min);
  if (min === max) return participants(min);
  return `${min}–${max} þátttakendur`;
}

/**
 * Screen-reader-friendly participant count label.
 */
export function formatParticipantsLabel(min: number | undefined, max: number | undefined): string {
  const formatted = formatParticipants(min, max);
  if (!formatted) return "";
  return `Fjöldi þátttakenda: ${formatted}`;
}

// ── Price ───────────────────────────────────────────────────────────────────────

/**
 * Format price in Icelandic krónur.
 *
 * - `0` → `"Kostnaðarlaust"`
 * - `1500` → `"1.500 kr."`
 */
export function formatPrice(price: number): string {
  if (price === 0) return "Kostnaðarlaust";
  return `${formatIcelandicNumber(price)} kr.`;
}

/**
 * Screen-reader-friendly price label.
 */
export function formatPriceLabel(price: number): string {
  return `Kostnaður: ${formatPrice(price)}`;
}

// ── Age Groups ──────────────────────────────────────────────────────────────────

/**
 * Return the Icelandic display name for a single age group enum value.
 */
export function formatAgeGroup(age: string): string {
  return AGE_GROUP_DISPLAY[age] ?? age;
}

/**
 * Return comma-separated Icelandic display names for a list of age groups.
 * Empty array → `""`.
 */
export function formatAgeGroups(ages: string[]): string {
  if (ages.length === 0) return "";
  return ages.map(formatAgeGroup).join(", ");
}

/**
 * Icelandic month names, **lowercase**.
 *
 * Icelandic does not capitalise month names, and a date written "14. September
 * 2026" reads as an English sentence in Icelandic clothes. Spelled out here
 * rather than left to `Intl`: the casing is a rule about the language, not a
 * formatting preference, and it should not change because a runtime shipped
 * different CLDR data.
 */
const MONTHS_IS = [
  "janúar",
  "febrúar",
  "mars",
  "apríl",
  "maí",
  "júní",
  "júlí",
  "ágúst",
  "september",
  "október",
  "nóvember",
  "desember",
];

const MONTHS_IS_SHORT = [
  "jan.",
  "feb.",
  "mars",
  "apríl",
  "maí",
  "júní",
  "júlí",
  "ág.",
  "sept.",
  "okt.",
  "nóv.",
  "des.",
];

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A date as Icelandic writes it: `14. september 2026`.
 *
 * Returns an empty string for anything unparseable rather than "Invalid Date",
 * which is not a thing to show a leader.
 */
export function formatIcelandicDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = toDate(value);
  if (!date) return "";
  return `${date.getDate()}. ${MONTHS_IS[date.getMonth()]} ${date.getFullYear()}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * A date and time: `14. sept. 2026 kl. 09:05`, on the 24-hour clock.
 *
 * For lists where two things on the same day need telling apart (email
 * drafts). Local time, like the other date helpers.
 */
export function formatIcelandicDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = toDate(value);
  if (!date) return "";
  const day = `${date.getDate()}. ${MONTHS_IS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
  return `${day} kl. ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** `14. sept.` — for a list rail, where the year is noise and width is scarce. */
export function formatIcelandicDateShort(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = toDate(value);
  if (!date) return "";
  return `${date.getDate()}. ${MONTHS_IS_SHORT[date.getMonth()]}`;
}

/**
 * A number as Icelandic writes it: `5.003`, grouped with full stops.
 *
 * Spelled out rather than left to `toLocaleString("is-IS")` for the same
 * reason the month names are: the runtime cannot be relied on to have the
 * locale data. Chrome in this project resolves `is-IS` to nothing
 * (`Intl.NumberFormat.supportedLocalesOf(["is-IS"])` is empty) and silently
 * falls back to the English `5,003` — a separator that means a decimal point
 * in Icelandic, on a screen whose whole job is counting.
 */
export function formatIcelandicNumber(value: number): string {
  const sign = value < 0 ? "-" : "";
  const digits = Math.abs(Math.trunc(value)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * A number that may have a fraction, as Icelandic writes it: `1.234,5`.
 *
 * Full stops group the thousands and a comma marks the decimal, rounded to at
 * most `maxFractionDigits` places with trailing zeros dropped (`2,50` → `2,5`,
 * `3,00` → `3`). The hand-rolled twin of `toLocaleString("is-IS",
 * { maximumFractionDigits })`, for the reason given on `formatIcelandicNumber`.
 */
export function formatIcelandicDecimal(value: number, maxFractionDigits = 2): string {
  const fixed = Math.abs(value).toFixed(maxFractionDigits);
  const [whole, fraction = ""] = fixed.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  // -0,001 rounds to 0, and "-0" is not a number anyone writes.
  const sign = value < 0 && Number(fixed) !== 0 ? "-" : "";
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return sign + grouped + (trimmed ? `,${trimmed}` : "");
}

/** Decimal places `countIs` shows, and so the precision `pluralIs` judges at. */
const COUNT_FRACTION_DIGITS = 2;

/**
 * The Icelandic singular or plural for a count: `one` when the number ends in
 * 1 but not in 11, otherwise `many`.
 *
 * - `1`, `21`, `101`, `1.001` → `one` ("eining")
 * - `0`, `2`, `11`, `111`, `12` → `many` ("einingar")
 *
 * **Decimals:** the number is judged as `countIs` would print it, rounded to two
 * places. If that is a whole number (`1.004` → `1`), the whole-number rule
 * applies. Any real fraction (`1,5`, `21,1`) takes the plural: "1,5
 * klukkustundir". Negative numbers follow their absolute value.
 *
 * Returns the word only. Use `countIs` to get the number with it.
 */
export function pluralIs(n: number, one: string, many: string): string {
  const shown = Math.abs(Number(n.toFixed(COUNT_FRACTION_DIGITS)));
  if (!Number.isInteger(shown)) return many;
  return shown % 10 === 1 && shown % 100 !== 11 ? one : many;
}

/**
 * A count and its noun in agreement, with the number written the Icelandic
 * way: `countIs(21, "eining", "einingar")` → `"21 eining"`,
 * `countIs(5003, "eining", "einingar")` → `"5.003 einingar"`.
 *
 * See `pluralIs` for the rule, including how decimals behave.
 */
export function countIs(n: number, one: string, many: string): string {
  return `${formatIcelandicDecimal(n, COUNT_FRACTION_DIGITS)} ${pluralIs(n, one, many)}`;
}

/**
 * A file size with an Icelandic decimal comma: `512 B`, `34 kB`, `1,2 MB`.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${formatIcelandicNumber(bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatIcelandicNumber(Math.round(bytes / 1024))} kB`;
  return `${formatIcelandicDecimal(bytes / (1024 * 1024), 1)} MB`;
}
