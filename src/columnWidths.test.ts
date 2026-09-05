import { describe, it } from 'node:test';
import assert from 'node:assert';
import { apportionColumnWidths } from './columnWidths.ts';
import { defined } from './testing/assertions.ts';

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe('apportionColumnWidths', () => {
  it('never totals more than the measured width', () => {
    // Ceiling these 14 columns would add 7px and overflow the container.
    const measured = [80.5, 60.5, 60.5, 60.5, 60.5, 60.5, 60.5, 90.4, 90.4, 90.4, 90.4, 90.4, 90.4, 90.4];
    const widths = apportionColumnWidths(measured);
    assert.strictEqual(sum(widths), Math.floor(sum(measured)));
  });

  it('gives the leftover pixels to the largest remainders', () => {
    // 10.9 + 10.1 + 10.9 = 31.9, so 31px across three whole columns.
    assert.deepStrictEqual(apportionColumnWidths([10.9, 10.1, 10.9]), [11, 10, 10]);
  });

  it('keeps every column within a pixel of its measurement', () => {
    const measured = [12.7, 40.2, 8.9, 33.33, 100.01];
    const widths = apportionColumnWidths(measured);
    measured.forEach((want, i) => {
      const got = defined(widths[i], `width for column ${i}`);
      assert.ok(Math.abs(got - want) < 1, `${got} is not within a pixel of ${want}`);
    });
  });

  it('leaves whole numbers alone', () => {
    assert.deepStrictEqual(apportionColumnWidths([40, 60, 100]), [40, 60, 100]);
  });

  it('preserves overflow that the content really needs', () => {
    // Nothing here is a rounding artifact, so the total is not trimmed.
    assert.strictEqual(sum(apportionColumnWidths([500, 500, 500])), 1500);
  });

  it('handles no columns', () => {
    assert.deepStrictEqual(apportionColumnWidths([]), []);
  });
});
