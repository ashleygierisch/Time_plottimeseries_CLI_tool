/**
 * Rescales the numbers in a sample CSV, so a file taken from real data can be
 * committed without the real magnitudes.
 *
 * A cell is rescaled only if it reads as a finite number on its own. That
 * leaves the header, the dates, text columns, markdown links and blanks
 * untouched wherever they sit, so this makes no assumption about which column
 * is which.
 */

const DECIMALS = 3;

function round(value: number): number {
  const factor = 10 ** DECIMALS;
  return Math.round(value * factor) / factor;
}

function scaleRow(row: string, divisor: () => number): string {
  return row
    .split(',')
    .map(cell => {
      // `Number('')` is 0, so blanks have to be turned away before the test.
      if (cell.trim() === '') return cell;
      const value = Number(cell);
      return Number.isFinite(value) ? round(value / divisor()).toString() : cell;
    })
    .join(',');
}

/**
 * `divisor` is called once per rescaled cell and injected rather than drawn
 * inline, so a test can pin it.
 */
export function scaleCSV(csv: string, divisor: () => number): string {
  const [header, ...rows] = csv.split('\n');
  if (header == null) return csv;
  return [header, ...rows.map(row => scaleRow(row, divisor))].join('\n');
}
