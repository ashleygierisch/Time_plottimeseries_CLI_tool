/**
 * Positions for the fine grid lines behind the plot. A fixed pixel pattern
 * drifts against the tick marks and reads as decoration, so the fine lines are
 * derived from the major ones instead: every gap between neighbouring majors is
 * split into `divisions` equal steps, and that step keeps going past the
 * outermost majors to fill `extent`.
 *
 * Positions are in pixels, and the majors need not be evenly spaced — time
 * ticks rarely are — because each gap is subdivided on its own.
 */
export function subdivideGridPositions(
  majors: number[],
  divisions: number,
  extent: [number, number]
): number[] {
  if (divisions < 2 || majors.length < 2) return [];

  const sorted = [...majors].sort((a, b) => a - b);
  const [lo, hi] = extent[0] <= extent[1] ? extent : [extent[1], extent[0]];
  const positions: number[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1] - sorted[i];
    if (gap <= 0) continue; // duplicate majors have nothing between them
    for (let step = 1; step < divisions; step++) {
      positions.push(sorted[i] + (gap * step) / divisions);
    }
  }

  // Carry the outermost step widths out to the edges of the plot area so the
  // paper does not stop short of the axes.
  const leading = (sorted[1] - sorted[0]) / divisions;
  for (let p = sorted[0] - leading; p >= lo && leading > 0; p -= leading) {
    positions.push(p);
  }

  const last = sorted.length - 1;
  const trailing = (sorted[last] - sorted[last - 1]) / divisions;
  for (let p = sorted[last] + trailing; p <= hi && trailing > 0; p += trailing) {
    positions.push(p);
  }

  return positions.filter(p => p >= lo && p <= hi);
}
