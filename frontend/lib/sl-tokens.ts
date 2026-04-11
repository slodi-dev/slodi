/**
 * Design Token Accessor for JavaScript/TypeScript contexts.
 *
 * Use this module only when you need token values in JS (e.g. chart configs,
 * canvas drawing, dynamic style calculations). In CSS or CSS Modules, always
 * use `var(--sl-*)` directly.
 *
 * @example
 * ```ts
 * import { tokens, getTokenValue } from "@/lib/sl-tokens";
 *
 * // In a style object or chart config:
 * const color = tokens.colorPrimary; // "var(--sl-color-primary)"
 *
 * // To read the computed value at runtime:
 * const hex = getTokenValue("--sl-color-primary"); // e.g. "142 50% 42%"
 * ```
 */

// ---------------------------------------------------------------------------
// Token map — camelCase keys to CSS custom property references
// ---------------------------------------------------------------------------

export const tokens = {
  // --- Color: brand ---
  colorPrimary: "var(--sl-color-primary)",
  colorPrimaryHover: "var(--sl-color-primary-hover)",
  colorPrimaryActive: "var(--sl-color-primary-active)",
  colorPrimarySubtle: "var(--sl-color-primary-subtle)",
  colorPrimaryMuted: "var(--sl-color-primary-muted)",
  colorPrimaryBorder: "var(--sl-color-primary-border)",
  colorPrimaryText: "var(--sl-color-primary-text)",

  colorSecondary: "var(--sl-color-secondary)",
  colorSecondaryHover: "var(--sl-color-secondary-hover)",
  colorSecondaryActive: "var(--sl-color-secondary-active)",
  colorSecondarySubtle: "var(--sl-color-secondary-subtle)",

  colorAccent: "var(--sl-color-accent)",
  colorAccentHover: "var(--sl-color-accent-hover)",
  colorAccentActive: "var(--sl-color-accent-active)",
  colorAccentSubtle: "var(--sl-color-accent-subtle)",

  // --- Color: surface ---
  colorBackground: "var(--sl-color-background)",
  colorBackgroundSecondary: "var(--sl-color-background-secondary)",
  colorBackgroundTertiary: "var(--sl-color-background-tertiary)",

  colorSurface: "var(--sl-color-surface)",
  colorSurfaceHover: "var(--sl-color-surface-hover)",
  colorSurfaceActive: "var(--sl-color-surface-active)",
  colorSurfaceSecondary: "var(--sl-color-surface-secondary)",
  colorSurfaceTertiary: "var(--sl-color-surface-tertiary)",
  colorSurfaceRaised: "var(--sl-color-surface-raised)",
  colorSurfaceSunken: "var(--sl-color-surface-sunken)",

  // --- Color: border ---
  colorBorder: "var(--sl-color-border)",
  colorBorderHover: "var(--sl-color-border-hover)",
  colorBorderFocus: "var(--sl-color-border-focus)",
  colorBorderSubtle: "var(--sl-color-border-subtle)",
  colorBorderStrong: "var(--sl-color-border-strong)",

  // --- Color: text ---
  colorTextPrimary: "var(--sl-color-text-primary)",
  colorTextSecondary: "var(--sl-color-text-secondary)",
  colorTextTertiary: "var(--sl-color-text-tertiary)",
  colorTextDisabled: "var(--sl-color-text-disabled)",
  colorTextInverse: "var(--sl-color-text-inverse)",
  colorTextLink: "var(--sl-color-text-link)",
  colorTextLinkHover: "var(--sl-color-text-link-hover)",

  // --- Color: semantic ---
  colorSuccess: "var(--sl-color-success)",
  colorSuccessSubtle: "var(--sl-color-success-subtle)",
  colorSuccessText: "var(--sl-color-success-text)",

  colorWarning: "var(--sl-color-warning)",
  colorWarningSubtle: "var(--sl-color-warning-subtle)",
  colorWarningText: "var(--sl-color-warning-text)",

  colorError: "var(--sl-color-error)",
  colorErrorSubtle: "var(--sl-color-error-subtle)",
  colorErrorText: "var(--sl-color-error-text)",

  colorInfo: "var(--sl-color-info)",
  colorInfoSubtle: "var(--sl-color-info-subtle)",
  colorInfoText: "var(--sl-color-info-text)",

  // --- Color: Heiðursorðla tile states ---
  colorHeidursordlaCorrect: "var(--sl-color-heidursordla-correct)",
  colorHeidursordlaCorrectForeground: "var(--sl-color-heidursordla-correct-foreground)",
  colorHeidursordlaPresent: "var(--sl-color-heidursordla-present)",
  colorHeidursordlaPresentForeground: "var(--sl-color-heidursordla-present-foreground)",
  colorHeidursordlaAbsent: "var(--sl-color-heidursordla-absent)",
  colorHeidursordlaAbsentForeground: "var(--sl-color-heidursordla-absent-foreground)",

  // --- Spacing ---
  spacingXs: "var(--sl-spacing-xs)",
  spacingSm: "var(--sl-spacing-sm)",
  spacingMd: "var(--sl-spacing-md)",
  spacingLg: "var(--sl-spacing-lg)",
  spacingXl: "var(--sl-spacing-xl)",
  spacingElement: "var(--sl-spacing-element)",
  spacingInline: "var(--sl-spacing-inline)",
  spacingCompact: "var(--sl-spacing-compact)",
  spacingComponent: "var(--sl-spacing-component)",

  // --- Typography ---
  textXs: "var(--sl-text-xs)",
  textCaption: "var(--sl-text-caption)",
  textOverline: "var(--sl-text-overline)",
  textBodySm: "var(--sl-text-body-sm)",
  textBody: "var(--sl-text-body)",
  textBodyLg: "var(--sl-text-body-lg)",
  textHeading1: "var(--sl-text-heading-1)",
  textHeading2: "var(--sl-text-heading-2)",
  textHeading3: "var(--sl-text-heading-3)",
  textHeading4: "var(--sl-text-heading-4)",
  textHeading5: "var(--sl-text-heading-5)",
  textHeading6: "var(--sl-text-heading-6)",

  // --- Font weight ---
  fontWeightNormal: "var(--sl-font-weight-normal)",
  fontWeightMedium: "var(--sl-font-weight-medium)",
  fontWeightSemibold: "var(--sl-font-weight-semibold)",
  fontWeightHeading: "var(--sl-font-weight-heading)",
  fontWeightEmphasis: "var(--sl-font-weight-emphasis)",

  // --- Line height ---
  lineHeightTight: "var(--sl-line-height-tight)",
  lineHeightNormal: "var(--sl-line-height-normal)",
  lineHeightRelaxed: "var(--sl-line-height-relaxed)",

  // --- Border radius ---
  radiusXs: "var(--sl-radius-xs)",
  radiusSm: "var(--sl-radius-sm)",
  radiusMd: "var(--sl-radius-md)",
  radiusLg: "var(--sl-radius-lg)",
  radiusPill: "var(--sl-radius-pill)",
  radiusCard: "var(--sl-radius-card)",
  radiusButton: "var(--sl-radius-button)",
  radiusInput: "var(--sl-radius-input)",

  // --- Shadow ---
  shadowCard: "var(--sl-shadow-card)",
  shadowCardHover: "var(--sl-shadow-card-hover)",
  shadowDropdown: "var(--sl-shadow-dropdown)",
  shadowModal: "var(--sl-shadow-modal)",
  shadowFocus: "var(--sl-shadow-focus)",
  shadowFocusError: "var(--sl-shadow-focus-error)",

  // --- Transition ---
  transitionFast: "var(--sl-transition-fast)",
  transitionNormal: "var(--sl-transition-normal)",
  transitionBase: "var(--sl-transition-base)",
  transitionSlow: "var(--sl-transition-slow)",

  // --- Layout ---
  sidebarWidth: "var(--sl-sidebar-width)",
  cardMinWidth: "var(--sl-card-min-width)",
  contentMaxWidth: "var(--sl-content-max-width)",

  // --- Z-index ---
  zCardLink: "var(--sl-z-card-link)",
  zCardActions: "var(--sl-z-card-actions)",
  zDropdown: "var(--sl-z-dropdown)",
  zOverlay: "var(--sl-z-overlay)",
  zDrawer: "var(--sl-z-drawer)",
  zModal: "var(--sl-z-modal)",
} as const;

export type TokenKey = keyof typeof tokens;

// ---------------------------------------------------------------------------
// Runtime accessor — reads the computed CSS value from the document root.
// Only works in a browser environment; returns "" on the server.
// ---------------------------------------------------------------------------

/**
 * Read the current computed value of a CSS custom property from `:root`.
 *
 * @param name - The full CSS custom property name, e.g. `"--sl-color-primary"`.
 * @returns The computed value string, or `""` if unavailable (e.g. SSR).
 *
 * @example
 * ```ts
 * const primary = getTokenValue("--sl-color-primary");
 * // => "142 50% 42%" (the raw HSL components)
 * ```
 */
export function getTokenValue(name: string): string {
  if (typeof document === "undefined") {
    return "";
  }
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
