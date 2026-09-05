import { describe, it, test } from 'node:test';
import assert from 'node:assert';
import { defined } from './testing/assertions.ts';
import {
  parseCSV,
  analyzeColumnFormatters,
  extractColumnStyles,
  formatColumnName,
  isSeriesColumn,
  parseColumnHeader,
  parseColumnStyle,
  processCSV,
  spreadDuplicateDates,
  splitHeaderLine,
  type ColumnStyles,
  type DataPoint,
  type LinkData,
} from './dataProcessing.ts';

describe('parseCSV', () => {
  it('should parse valid CSV data', () => {
    const csv = `date,val1,val2\n2023-01-01,10,20\n2023-01-02,15,25`;
    const { data, columns } = parseCSV(csv);

    assert.deepStrictEqual(columns, ['date', 'val1', 'val2']);
    assert.strictEqual(data.length, 2);

    assert.strictEqual(defined(data[0]).date.toISOString().split('T')[0], '2023-01-01');
    assert.strictEqual(defined(data[0]).val1, 10);
    assert.strictEqual(defined(data[0]).val2, 20);
  });

  it('should handle date when it is not the first column', () => {
    const csv = `val1,date,val2\n1,2026-01-01,2`;
    const { columns } = processCSV(csv);
    assert.deepStrictEqual(columns, ['val1', 'date', 'val2']);
  });

  it('should ignore rows with invalid dates', () => {
    const csv = `date,val\ninvalid-date,10\n2023-01-01,20`;
    const { data } = parseCSV(csv);

    assert.strictEqual(data.length, 1);
    assert.strictEqual(defined(data[0]).val, 20);
  });

  it('should handle empty CSV', () => {
    const { data, columns } = parseCSV('');
    assert.strictEqual(data.length, 0);
    assert.strictEqual(columns.length, 0);
  });

  it('should parse dates correctly', () => {
    const dateString = '2023-01-01';
    const dateObject = new Date(dateString);

    assert.strictEqual(dateObject.toISOString(), '2023-01-01T00:00:00.000Z');
  });

  it('should handle data with uppercase Date field', () => {
    const csv = `Date,pct_change,amount,category
2023-01-01,0.15,45.5,High
2023-01-02,-0.8,-99.25,Low
2023-01-03,0.02,0.75,Medium
2023-01-04,1.0,100,High
2023-01-05,-0.33,-5.5,Low
2023-01-06,0.5,0.05,Medium`;
    const { data } = parseCSV(csv);

    assert.strictEqual(data.length, 6);
    assert.strictEqual(defined(data[0]).pct_change, 0.15);
    assert.strictEqual(defined(data[0]).amount, 45.5);
    assert.strictEqual(defined(data[0]).category, 'High');
  });
});

test('analyzeColumnFormatters', async (t) => {
  await t.test('formats range [-2, 2] as percentages', () => {
    const columns = ['pct'];
    const data: DataPoint[] = [
      { date: new Date(), pct: 0.5 },
      { date: new Date(), pct: -1.5 },
      { date: new Date(), pct: 2.0 },
    ];

    const formatters = analyzeColumnFormatters(data, columns);
    const fmt = defined(formatters['pct']);

    assert.strictEqual(fmt(0.123), '12.3%');
    assert.strictEqual(fmt(1.5), '150.0%');
    assert.strictEqual(fmt(-0.5), '-50.0%');
  });

  await t.test('formats range [-10, 10] as 1 decimal place', () => {
    const columns = ['dec'];
    const data: DataPoint[] = [
      { date: new Date(), dec: 5.55 },
      { date: new Date(), dec: -9.9 },
      { date: new Date(), dec: 0 },
    ];

    const formatters = analyzeColumnFormatters(data, columns);
    const fmt = defined(formatters['dec']);

    assert.strictEqual(fmt(5.543), '5.5');
    assert.strictEqual(fmt(0), '0.0');
    assert.strictEqual(fmt(-9.12), '-9.1');
  });

  await t.test('formats range outside [-10, 10] as integers', () => {
    const columns = ['int'];
    const data: DataPoint[] = [
      { date: new Date(), int: 10.1 },
      { date: new Date(), int: 1000 },
    ];

    const formatters = analyzeColumnFormatters(data, columns);
    const fmt = defined(formatters['int']);

    assert.strictEqual(fmt(1234.56), '1,235');
    assert.strictEqual(fmt(10.1), '10');
    assert.strictEqual(fmt(-15.9), '-16');
  });

  await t.test('column styles override the inferred format', () => {
    const columns = ['a', 'b', 'c', 'd', 'e'];
    const data: DataPoint[] = [{ date: new Date(), a: 0.7, b: 0.7, c: 0.7, d: 0.7, e: 0.7 }];
    const columnStyles: ColumnStyles = {
      a: { type: 'decimal', places: 2 },
      b: { type: 'integer' },
      c: { type: 'percent', places: 0 },
      d: { type: 'currency', currency: 'USD' },
      e: { places: 4 },
    };

    const formatters = analyzeColumnFormatters(data, columns, columnStyles);

    // Without a style, [-2, 2] would have been formatted as a percentage.
    assert.strictEqual(defined(formatters['a'])(0.7), '0.70');
    assert.strictEqual(defined(formatters['b'])(0.7), '1');
    assert.strictEqual(defined(formatters['c'])(0.7), '70%');
    assert.strictEqual(defined(formatters['d'])(0.7), '$0.70');
    assert.strictEqual(defined(formatters['e'])(0.7), '0.7000');
  });

  await t.test('falls back to inference for styles that say nothing about numbers', () => {
    const columns = ['pct'];
    const data: DataPoint[] = [{ date: new Date(), pct: 0.5 }];
    const formatters = analyzeColumnFormatters(data, columns, { pct: { color: 'red' } });

    assert.strictEqual(defined(formatters['pct'])(0.123), '12.3%');
  });
});

test('formatColumnName', () => {
  assert.strictEqual(formatColumnName('hello_world'), 'Hello world');
  assert.strictEqual(formatColumnName('total_assets'), 'Total assets');
  assert.strictEqual(formatColumnName('date'), 'Date');
  assert.strictEqual(formatColumnName('simple'), 'Simple');
  assert.strictEqual(formatColumnName('multiple_underscores_here'), 'Multiple underscores here');
  assert.strictEqual(formatColumnName(''), '');
  assert.strictEqual(formatColumnName('total_assets', { label: 'AUM' }), 'AUM');
  assert.strictEqual(formatColumnName('total_assets', { type: 'percent' }), 'Total assets');
});

test('isSeriesColumn', () => {
  assert.strictEqual(isSeriesColumn('val1'), true);
  assert.strictEqual(isSeriesColumn('date'), false);
  assert.strictEqual(isSeriesColumn('Date'), false);
  assert.strictEqual(isSeriesColumn('val1', { val1: { plot: false } }), false);
  assert.strictEqual(isSeriesColumn('val1', { val1: { plot: true } }), true);
  assert.strictEqual(isSeriesColumn('val1', { val1: { color: 'red' } }), true);
});

test('splitHeaderLine', async (t) => {
  await t.test('splits a plain header line', () => {
    assert.deepStrictEqual(splitHeaderLine('date,val1,val2'), ['date', 'val1', 'val2']);
  });

  await t.test('keeps commas inside a style spec', () => {
    assert.deepStrictEqual(
      splitHeaderLine('date,col1{type: decimal, places: 2},col2'),
      ['date', 'col1{type: decimal, places: 2}', 'col2']
    );
  });

  await t.test('honors backslash-escaped commas inside a style spec', () => {
    assert.deepStrictEqual(
      splitHeaderLine("date,col1{type:'decimal'\\, places: 2},col2"),
      ['date', "col1{type:'decimal', places: 2}", 'col2']
    );
  });

  await t.test('honors standard CSV quoting', () => {
    assert.deepStrictEqual(
      splitHeaderLine('date,"col1{type: decimal, places: 2}",col2'),
      ['date', 'col1{type: decimal, places: 2}', 'col2']
    );
  });

  await t.test('unescapes doubled quotes in a quoted field', () => {
    assert.deepStrictEqual(splitHeaderLine('date,"a ""b"" c"'), ['date', 'a "b" c']);
  });

  await t.test('leaves a backslash outside a spec alone', () => {
    assert.deepStrictEqual(splitHeaderLine('date,a\\b'), ['date', 'a\\b']);
  });
});

test('parseColumnStyle', async (t) => {
  await t.test('parses each supported key', () => {
    assert.deepStrictEqual(
      parseColumnStyle("type: 'currency', places: 3, currency: eur, color: #ff0000, label: 'Net, total', plot: false"),
      {
        type: 'currency',
        places: 3,
        currency: 'EUR',
        color: '#ff0000',
        label: 'Net, total',
        plot: false,
      }
    );
  });

  await t.test('accepts type aliases', () => {
    assert.deepStrictEqual(parseColumnStyle('type: pct'), { type: 'percent' });
    assert.deepStrictEqual(parseColumnStyle('type: INT'), { type: 'integer' });
    assert.deepStrictEqual(parseColumnStyle('type: number'), { type: 'decimal' });
    assert.deepStrictEqual(parseColumnStyle('decimals: 4'), { places: 4 });
  });

  await t.test('ignores unknown keys and invalid values', () => {
    assert.deepStrictEqual(parseColumnStyle('bogus: 1, type: nonsense, places: -1, places: abc'), {});
  });

  await t.test('ignores a currency that is not a 3-letter code', () => {
    assert.deepStrictEqual(parseColumnStyle('type: currency, currency: usdollar'), { type: 'currency' });
    // The default currency still formats rather than throwing.
    const formatters = analyzeColumnFormatters(
      [{ date: new Date(), val: 1 }],
      ['val'],
      { val: parseColumnStyle('type: currency, currency: usdollar') }
    );
    assert.strictEqual(defined(formatters['val'])(1), '$1.00');
  });

  await t.test('ignores entries without a value', () => {
    assert.deepStrictEqual(parseColumnStyle('type, places:'), {});
  });

  await t.test('treats plot as true unless explicitly false', () => {
    assert.deepStrictEqual(parseColumnStyle('plot: true'), { plot: true });
    assert.deepStrictEqual(parseColumnStyle('plot: FALSE'), { plot: false });
  });
});

test('parseColumnHeader', async (t) => {
  await t.test('returns the header unchanged when there is no spec', () => {
    assert.deepStrictEqual(parseColumnHeader(' val1 '), { name: ' val1 ', style: {} });
  });

  await t.test('separates the name from the spec', () => {
    assert.deepStrictEqual(parseColumnHeader('col1 {type: decimal, places: 2}'), {
      name: 'col1',
      style: { type: 'decimal', places: 2 },
    });
  });

  await t.test('treats an empty spec as no styling', () => {
    assert.deepStrictEqual(parseColumnHeader('col1{}'), { name: 'col1', style: {} });
  });
});

test('extractColumnStyles', async (t) => {
  await t.test('leaves a CSV without specs untouched', () => {
    const csv = 'date,val1\n2023-01-01,10';
    assert.deepStrictEqual(extractColumnStyles(csv), { csv, columnStyles: {} });
  });

  await t.test('strips specs from the header line', () => {
    const { csv, columnStyles } = extractColumnStyles(
      "date,col1{type:'decimal'\\, places: 2},col2\n2026-01-01,0.7,foo"
    );
    assert.strictEqual(csv, 'date,col1,col2\n2026-01-01,0.7,foo');
    assert.deepStrictEqual(columnStyles, { col1: { type: 'decimal', places: 2 } });
  });

  await t.test('preserves CRLF line endings', () => {
    const { csv } = extractColumnStyles('date,col1{places: 2}\r\n2026-01-01,0.7\r\n');
    assert.strictEqual(csv, 'date,col1\r\n2026-01-01,0.7\r\n');
  });

  await t.test('re-quotes a column name that needs it', () => {
    const { csv, columnStyles } = extractColumnStyles('date,"a,b"{places: 2}\n2026-01-01,0.7');
    assert.strictEqual(csv, 'date,"a,b"\n2026-01-01,0.7');
    assert.deepStrictEqual(columnStyles, { 'a,b': { places: 2 } });
  });

  await t.test('handles a header-only CSV', () => {
    const { csv, columnStyles } = extractColumnStyles('date,col1{places: 2}');
    assert.strictEqual(csv, 'date,col1');
    assert.deepStrictEqual(columnStyles, { col1: { places: 2 } });
  });
});

test('spreadDuplicateDates', async (t) => {
  const msPerDay = 24 * 60 * 60 * 1000;

  await t.test('leaves unique dates unchanged', () => {
    const d1 = new Date('2023-01-01');
    const d2 = new Date('2023-01-02');
    const data: DataPoint[] = [{ date: d1, val: 1 }, { date: d2, val: 2 }];
    const result = spreadDuplicateDates(data);
    assert.strictEqual(defined(result[0]).date.getTime(), d1.getTime());
    assert.strictEqual(defined(result[1]).date.getTime(), d2.getTime());
  });

  await t.test('spreads two points on the same date 12 hours apart', () => {
    const base = new Date('2023-01-01');
    const data: DataPoint[] = [{ date: base, val: 1 }, { date: base, val: 2 }];
    const result = spreadDuplicateDates(data);
    assert.strictEqual(defined(result[0]).date.getTime(), base.getTime());
    assert.strictEqual(defined(result[1]).date.getTime(), base.getTime() + msPerDay / 2);
  });

  await t.test('spreads three points on the same date 8 hours apart', () => {
    const base = new Date('2023-01-01');
    const data: DataPoint[] = [
      { date: base, val: 1 },
      { date: base, val: 2 },
      { date: base, val: 3 },
    ];
    const result = spreadDuplicateDates(data);
    assert.strictEqual(defined(result[0]).date.getTime(), base.getTime());
    assert.strictEqual(defined(result[1]).date.getTime(), base.getTime() + Math.floor(msPerDay / 3));
    assert.strictEqual(defined(result[2]).date.getTime(), base.getTime() + Math.floor(2 * msPerDay / 3));
  });

  await t.test('does not mutate the original data', () => {
    const base = new Date('2023-01-01');
    const data: DataPoint[] = [{ date: base, val: 1 }, { date: base, val: 2 }];
    spreadDuplicateDates(data);
    assert.strictEqual(defined(data[0]).date.getTime(), base.getTime());
    assert.strictEqual(defined(data[1]).date.getTime(), base.getTime());
  });

  await t.test('handles mixed: some dates unique, some duplicated', () => {
    const d1 = new Date('2023-01-01');
    const d2 = new Date('2023-01-02');
    const data: DataPoint[] = [
      { date: d1, val: 1 },
      { date: d2, val: 2 },
      { date: d2, val: 3 },
    ];
    const result = spreadDuplicateDates(data);
    assert.strictEqual(defined(result[0]).date.getTime(), d1.getTime());
    assert.strictEqual(defined(result[1]).date.getTime(), d2.getTime());
    assert.strictEqual(defined(result[2]).date.getTime(), d2.getTime() + msPerDay / 2);
  });
});

test('processCSV', async (t) => {
  await t.test('converts CSV string to formatted data points', () => {
    const csv = `date,pct_change,amount,category
2023-01-01,0.15,45.5,High
2023-01-02,-0.8,-99.25,Low`;

    const { formattedData, columns } = processCSV(csv);

    assert.deepStrictEqual(columns, ['date', 'pct_change', 'amount', 'category']);
    assert.strictEqual(formattedData.length, 2);

    assert.strictEqual(defined(formattedData[0]).formattedDate, '2023-01-01');
    assert.strictEqual(defined(formattedData[0]).pct_change, '15.0%');
    assert.strictEqual(defined(formattedData[0]).amount, '46');
    assert.strictEqual(defined(formattedData[0]).category, 'High');

    assert.strictEqual(defined(formattedData[1]).formattedDate, '2023-01-02');
    assert.strictEqual(defined(formattedData[1]).pct_change, '-80.0%');
    assert.strictEqual(defined(formattedData[1]).amount, '-99');
    assert.strictEqual(defined(formattedData[1]).category, 'Low');
  });

  await t.test('handles markdown links', () => {
    const csv = `date,link\n2023-01-01,[Google](https://google.com)`;
    const { formattedData } = processCSV(csv);

    const linkData = defined(formattedData[0]).link as LinkData;
    assert.strictEqual(linkData.linkText, 'Google');
    assert.strictEqual(linkData.url.toString(), 'https://google.com/');
  });

  await t.test('handles invalid markdown links as strings', () => {
    const csv = `date,link\n2023-01-01,[Invalid](not-a-url)`;
    const { formattedData } = processCSV(csv);

    assert.strictEqual(defined(formattedData[0]).link, '[Invalid](not-a-url)');
  });

  await t.test('handles empty CSV', () => {
    const { formattedData, columns } = processCSV('');
    assert.strictEqual(formattedData.length, 0);
    assert.strictEqual(columns.length, 0);
  });

  await t.test('applies styles from the column headers', () => {
    const csv = `date,col1{type:'decimal'\\, places: 2},col2{label: Category},col3{plot: false}
2026-01-01,0.7,foo,3`;

    const { formattedData, columns, columnStyles } = processCSV(csv);

    assert.deepStrictEqual(columns, ['date', 'col1', 'col2', 'col3']);
    assert.deepStrictEqual(columnStyles, {
      col1: { type: 'decimal', places: 2 },
      col2: { label: 'Category' },
      col3: { plot: false },
    });
    assert.strictEqual(defined(formattedData[0]).col1, '0.70');
    assert.strictEqual(defined(formattedData[0]).col2, 'foo');
  });
});
