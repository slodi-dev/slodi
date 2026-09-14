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
 * const color = tokens.colorPrimary; // "hsl(var(--sl-color-primary))"
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
  colorPrimary: "hsl(var(--sl-color-primary))",
  colorPrimaryHover: "hsl(var(--sl-color-primary-hover))",
  colorPrimaryActive: "hsl(var(--sl-color-primary-active))",
  colorPrimarySubtle: "hsl(var(--sl-color-primary-subtle))",
  colorPrimaryMuted: "hsl(var(--sl-color-primary-muted))",
  colorPrimaryBorder: "hsl(var(--sl-color-primary-border))",
  colorPrimaryText: "hsl(var(--sl-color-primary-text))",

  colorSecondary: "hsl(var(--sl-color-secondary))",
  colorSecondaryHover: "hsl(var(--sl-color-secondary-hover))",
  colorSecondaryActive: "hsl(var(--sl-color-secondary-active))",
  colorSecondarySubtle: "hsl(var(--sl-color-secondary-subtle))",

  colorAccent: "hsl(var(--sl-color-accent))",
  colorAccentHover: "hsl(var(--sl-color-accent-hover))",
  colorAccentActive: "hsl(var(--sl-color-accent-active))",
  colorAccentSubtle: "hsl(var(--sl-color-accent-subtle))",

  // --- Color: surface ---
  colorBackground: "hsl(var(--sl-color-background))",
  colorBackgroundSecondary: "hsl(var(--sl-color-background-secondary))",
  colorBackgroundTertiary: "hsl(var(--sl-color-background-tertiary))",

  colorSurface: "hsl(var(--sl-color-surface))",
  colorSurfaceHover: "hsl(var(--sl-color-surface-hover))",
  colorSurfaceActive: "hsl(var(--sl-color-surface-active))",
  colorSurfaceSecondary: "hsl(var(--sl-color-surface-secondary))",
  colorSurfaceTertiary: "hsl(var(--sl-color-surface-tertiary))",
  colorSurfaceRaised: "hsl(var(--sl-color-surface-raised))",
  colorSurfaceSunken: "hsl(var(--sl-color-surface-sunken))",

  // --- Color: border ---
  colorBorder: "hsl(var(--sl-color-border))",
  colorBorderHover: "hsl(var(--sl-color-border-hover))",
  colorBorderFocus: "hsl(var(--sl-color-border-focus))",
  colorBorderSubtle: "hsl(var(--sl-color-border-subtle))",
  colorBorderStrong: "hsl(var(--sl-color-border-strong))",

  // --- Color: text ---
  colorTextPrimary: "hsl(var(--sl-color-text-primary))",
  colorTextSecondary: "hsl(var(--sl-color-text-secondary))",
  colorTextTertiary: "hsl(var(--sl-color-text-tertiary))",
  colorTextDisabled: "hsl(var(--sl-color-text-disabled))",
  colorTextInverse: "hsl(var(--sl-color-text-inverse))",
  colorTextLink: "hsl(var(--sl-color-text-link))",
  colorTextLinkHover: "hsl(var(--sl-color-text-link-hover))",

  // --- Color: semantic ---
  colorSuccess: "hsl(var(--sl-color-success))",
  colorSuccessSubtle: "hsl(var(--sl-color-success-subtle))",
  colorSuccessText: "hsl(var(--sl-color-success-text))",

  colorWarning: "hsl(var(--sl-color-warning))",
  colorWarningSubtle: "hsl(var(--sl-color-warning-subtle))",
  colorWarningText: "hsl(var(--sl-color-warning-text))",

  colorError: "hsl(var(--sl-color-error))",
  colorErrorSubtle: "hsl(var(--sl-color-error-subtle))",
  colorErrorText: "hsl(var(--sl-color-error-text))",

  colorInfo: "hsl(var(--sl-color-info))",
  colorInfoSubtle: "hsl(var(--sl-color-info-subtle))",
  colorInfoText: "hsl(var(--sl-color-info-text))",

  // --- Color: Heiðursorðla tile states ---
  colorHeidursordlaCorrect: "hsl(var(--sl-color-heidursordla-correct))",
  colorHeidursordlaCorrectForeground: "hsl(var(--sl-color-heidursordla-correct-foreground))",
  colorHeidursordlaPresent: "hsl(var(--sl-color-heidursordla-present))",
  colorHeidursordlaPresentForeground: "hsl(var(--sl-color-heidursordla-present-foreground))",
  colorHeidursordlaAbsent: "hsl(var(--sl-color-heidursordla-absent))",
  colorHeidursordlaAbsentForeground: "hsl(var(--sl-color-heidursordla-absent-foreground))",

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
