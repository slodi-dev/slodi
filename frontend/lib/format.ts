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
 * - `30` → `"30 mínútur"`
 * - `60` → `"1 klukkustund"`
 * - `90` → `"1 klukkustund 30 mínútur"`
 * - `120` → `"2 klukkustundir"`
 */
function formatMinutesFull(minutes: number): string {
  if (minutes < 60) {
    if (minutes === 1) return "1 mínúta";
    return `${minutes} mínútur`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  const hourWord = hours === 1 ? "1 klukkustund" : `${hours} klukkustundir`;

  if (remaining === 0) {
    return hourWord;
  }

  const minuteWord = remaining === 1 ? "1 mínúta" : `${remaining} mínútur`;
  return `${hourWord} ${minuteWord}`;
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
 * - `5` → `"5 þátttakendur"`
 * - Range → `"5–15 þátttakendur"`
 */
export function formatParticipants(min: number | undefined, max: number | undefined): string {
  if (min === undefined && max === undefined) return "";

  const participantWord = (n: number) => (n === 1 ? "þátttakandi" : "þátttakendur");

  if (min === undefined) return `${max} ${participantWord(max!)}`;
  if (max === undefined) return `${min} ${participantWord(min)}`;
  if (min === max) return `${min} ${participantWord(min)}`;
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
  return `${price.toLocaleString("is-IS")} kr.`;
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
