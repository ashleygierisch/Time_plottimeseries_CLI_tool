import { isLinkData, type LinkData } from '../dataProcessing.ts';
import { cssVar } from '../theme.ts';

/**
 * One cell of the formatted data, as both tables see it. `undefined` is
 * reachable: a row need not carry every column the header names.
 */
export type CellValue = string | Date | LinkData | undefined;

/** Shown in place of a value a row does not have. */
export const EMPTY_VALUE = '-';

const LINK_COLOR = cssVar('link');

/**
 * The text a cell shows, with no markup around it. The hover details sizes its
 * columns from this, so it has to agree with `renderCellValue` below about what
 * a cell actually displays -- which is why the two live together.
 */
export function cellText(val: CellValue): string {
  if (isLinkData(val)) return val.linkText;
  if (val instanceof Date) return val.toISOString();
  return String(val ?? EMPTY_VALUE);
}

/** A cell's contents: a link renders as an anchor, anything else as its text. */
export function renderCellValue(val: CellValue) {
  if (isLinkData(val)) {
    return (
      <a
        href={val.url.toString()}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: LINK_COLOR, textDecoration: 'none' }}
        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
      >
        {val.linkText}
      </a>
    );
  }
  return cellText(val);
}
