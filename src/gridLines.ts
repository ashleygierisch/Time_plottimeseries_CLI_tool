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
  extent: [number, number],
): number[] {
  if (divisions < 2) return [];

  const sorted = [...majors].sort((a, b) => a - b);

  // The four majors the edge extrapolation needs. Reading them up front states
  // the "at least two majors" precondition in the one form the compiler checks
  // too, so nothing below has to index blind.
  const first = sorted[0];
  const second = sorted[1];
  const secondLast = sorted[sorted.length - 2];
  const lastMajor = sorted[sorted.length - 1];
  if (
    first === undefined ||
    second === undefined ||
    secondLast === undefined ||
    lastMajor === undefined
  ) {
    return [];
  }

  const [lo, hi] = extent[0] <= extent[1] ? extent : [extent[1], extent[0]];
  const positions: number[] = [];

  sorted.forEach((from, i) => {
    const to = sorted[i + 1];
    if (to === undefined) return; // the last major has no gap after it
    const gap = to - from;
    if (gap <= 0) return; // duplicate majors have nothing between them
    for (let step = 1; step < divisions; step++) {
      positions.push(from + (gap * step) / divisions);
    }
  });

  // Carry the outermost step widths out to the edges of the plot area so the
  // paper does not stop short of the axes.
  const leading = (second - first) / divisions;
  for (let p = first - leading; p >= lo && leading > 0; p -= leading) {
    positions.push(p);
  }

  const trailing = (lastMajor - secondLast) / divisions;
  for (let p = lastMajor + trailing; p <= hi && trailing > 0; p += trailing) {
    positions.push(p);
  }

  return positions.filter(p => p >= lo && p <= hi);
}
