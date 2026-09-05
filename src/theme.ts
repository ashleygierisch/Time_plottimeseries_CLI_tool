/**
 * The report's palette, named once.
 *
 * Colours reach the page two ways -- CSS rules in style.css, and inline styles
 * and d3 attributes written from TypeScript -- so the values have to exist in
 * both places. Rather than trusting that, style.css declares these same names
 * as custom properties under `:root`, and theme.test.ts fails if the two lists
 * ever disagree.
 *
 * Keys are camelCase here and `--kebab-case` there; the test does that
 * conversion, so a new colour needs adding in both places and nowhere else.
 */
export const THEME = {
  /** The page itself, and anything that has to be opaque against it. */
  ground: '#000000',
  /** Alternating table rows, and the scrollbar track. */
  groundAlt: '#0d0d0d',
  /** The hover details panel, lifted just off the ground. */
  panel: '#111111',
  /** The row under the pointer. */
  rowHover: '#333333',

  /** Hairlines between panels. */
  rule: '#333333',
  /** The heavier rule under the header labels, and the scrollbar thumb. */
  ruleStrong: '#555555',
  /** The scrollbar thumb under the pointer. */
  ruleHover: '#888888',

  text: '#ffffff',
  /** Body copy, a touch under full white so the figures stand out. */
  textMuted: 'rgba(255, 255, 255, 0.87)',
  link: '#4da6ff',

  /** Graph paper. The plot draws it directly; the table's row rules tint it. */
  gridInk: '#cfe0f0',

  /** The plot backdrop, black at the baseline lifting to a hint of blue. */
  plotTop: '#1b2029',
  plotMid: '#0b0d11',
  plotBottom: '#000000',
  /** The dashed rule that follows the pointer. */
  cursor: '#ffffff',

  accent: '#3b82f6',
  accentHover: '#2563eb',
} as const;

export type ThemeColor = keyof typeof THEME;

/** The CSS custom property carrying `key`, for use from an inline style. */
export function cssVar(key: ThemeColor): string {
  return `var(--${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)})`;
}
