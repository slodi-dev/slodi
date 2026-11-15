# Email Template Token Map

Email templates use hardcoded hex values (CSS variables don't work in email clients).
These values must stay in sync with `frontend/app/slodi-tokens.css`.

| sl- token | Hex value | Used in |
|---|---|---|
| --sl-color-primary (green-500) | #297a47 | Header background, CTA buttons, links, blockquote borders |
| --sl-color-background | #fafafa | Outer background |
| --sl-color-text-primary | #262626 | Body text, headings |
| --sl-color-text-secondary | #6b7280 | Footer text, captions |
| --sl-color-border | #d9d9d9 | Dividers, card borders |
| --sl-color-surface | #f2f2f2 | Footer background |

Last verified against slodi-tokens.css: 2026-11-15 (primary only)
