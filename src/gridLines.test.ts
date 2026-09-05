import { describe, it } from 'node:test';
import assert from 'node:assert';
import { subdivideGridPositions } from './gridLines.ts';

function sortedRounded(positions: number[]): number[] {
  return positions.map(p => Math.round(p * 1e6) / 1e6).sort((a, b) => a - b);
}

describe('subdivideGridPositions', () => {
  it('splits each gap into equal steps', () => {
    assert.deepStrictEqual(
      sortedRounded(subdivideGridPositions([0, 100], 4, [0, 100])),
      [25, 50, 75],
    );
  });

  it('never lands on a major position', () => {
    const majors = [0, 50, 100, 150];
    const minors = subdivideGridPositions(majors, 5, [0, 150]);
    majors.forEach(major => assert.ok(!minors.includes(major), `${major} is a major`));
    assert.strictEqual(minors.length, 12); // 3 gaps x 4 in-between lines, no room outside
  });

  it('carries the outer step widths to the edges of the extent', () => {
    // Majors at 40 and 60 in a 0..100 area: the 5px step keeps going both ways.
    const minors = sortedRounded(subdivideGridPositions([40, 60], 4, [0, 100]));
    assert.deepStrictEqual(
      minors,
      [0, 5, 10, 15, 20, 25, 30, 35, 45, 50, 55, 65, 70, 75, 80, 85, 90, 95, 100],
    );
  });

  it('subdivides unevenly spaced majors gap by gap', () => {
    // Time ticks are rarely evenly spaced, so each gap gets its own step.
    assert.deepStrictEqual(sortedRounded(subdivideGridPositions([0, 10, 40], 2, [0, 40])), [5, 25]);
  });

  it('accepts an inverted extent, as a y scale range is', () => {
    assert.deepStrictEqual(sortedRounded(subdivideGridPositions([0, 100], 2, [100, 0])), [50]);
  });

  it('stays inside the extent', () => {
    const minors = subdivideGridPositions([0, 20], 4, [0, 20]);
    minors.forEach(p => assert.ok(p >= 0 && p <= 20, `${p} is outside 0..20`));
  });

  it('has nothing to line up with under two majors', () => {
    assert.deepStrictEqual(subdivideGridPositions([], 5, [0, 100]), []);
    assert.deepStrictEqual(subdivideGridPositions([50], 5, [0, 100]), []);
  });

  it('returns nothing when there is nothing to divide', () => {
    assert.deepStrictEqual(subdivideGridPositions([0, 100], 1, [0, 100]), []);
    assert.deepStrictEqual(subdivideGridPositions([0, 0], 5, [0, 100]), []);
  });
});
