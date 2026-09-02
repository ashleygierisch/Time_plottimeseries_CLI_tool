/**
 * Rounds measured column widths to whole pixels without inflating their total.
 *
 * Rounding each column up on its own adds up to a pixel per column, which is
 * enough to push a table that exactly fit its container past it and raise a
 * stray horizontal scrollbar. Flooring instead loses the same pixels from the
 * table's right edge, so the leftovers are handed back to the columns that were
 * rounded down hardest. Genuine overflow, where the content really is wider
 * than the container, is preserved.
 */
export function apportionColumnWidths(measured: number[]): number[] {
  const widths = measured.map(width => Math.floor(width));
  const total = measured.reduce((sum, width) => sum + width, 0);
  let leftover = Math.floor(total) - widths.reduce((sum, width) => sum + width, 0);

  const byRemainder = measured
    .map((width, index) => ({ index, remainder: width - Math.floor(width) }))
    .sort((a, b) => b.remainder - a.remainder);

  for (let i = 0; leftover > 0 && i < byRemainder.length; i++, leftover--) {
    widths[byRemainder[i].index] += 1;
  }

  return widths;
}
