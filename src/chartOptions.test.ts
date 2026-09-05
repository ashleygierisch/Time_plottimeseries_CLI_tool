import { test } from 'node:test';
import assert from 'node:assert';
import { type ChartOptions, getChartOptions, parseNumericOption } from './chartOptions.ts';

function windowWith(href: string, injected?: ChartOptions): Window {
  return { location: { href }, __CHART_OPTIONS__: injected } as unknown as Window;
}

test('parseNumericOption', () => {
  assert.strictEqual(parseNumericOption('10'), 10);
  assert.strictEqual(parseNumericOption('-2.5'), -2.5);
  assert.strictEqual(parseNumericOption('0'), 0);
  assert.strictEqual(parseNumericOption(''), undefined);
  assert.strictEqual(parseNumericOption('   '), undefined);
  assert.strictEqual(parseNumericOption('abc'), undefined);
  assert.strictEqual(parseNumericOption('Infinity'), undefined);
  assert.strictEqual(parseNumericOption(null), undefined);
  assert.strictEqual(parseNumericOption(undefined), undefined);
});

test('getChartOptions', async (t) => {
  await t.test('returns nothing when there is no configuration', () => {
    assert.deepStrictEqual(getChartOptions(windowWith('http://localhost:3000/')), {});
  });

  await t.test('reads options injected by the CLI', () => {
    const win = windowWith('http://localhost:3000/', { yMax: 100, yMin: -5 });
    assert.deepStrictEqual(getChartOptions(win), { yMax: 100, yMin: -5 });
  });

  await t.test('reads options from query parameters', () => {
    const win = windowWith('http://localhost:3000/?yMax=100&yMin=-5');
    assert.deepStrictEqual(getChartOptions(win), { yMax: 100, yMin: -5 });
  });

  await t.test('accepts kebab-case and lowercase parameter names', () => {
    assert.deepStrictEqual(getChartOptions(windowWith('http://localhost:3000/?y-max=42')), { yMax: 42 });
    assert.deepStrictEqual(getChartOptions(windowWith('http://localhost:3000/?ymax=42')), { yMax: 42 });
  });

  await t.test('lets query parameters win over injected options', () => {
    const win = windowWith('http://localhost:3000/?yMax=7', { yMax: 100, yMin: -5 });
    assert.deepStrictEqual(getChartOptions(win), { yMax: 7, yMin: -5 });
  });

  await t.test('ignores unparseable parameters', () => {
    const win = windowWith('http://localhost:3000/?yMax=abc', { yMax: 100 });
    assert.deepStrictEqual(getChartOptions(win), { yMax: 100 });
  });

  await t.test('does not carry an undefined key for options that were not set', () => {
    const win = windowWith('http://localhost:3000/?yMax=100');
    assert.deepStrictEqual(Object.keys(getChartOptions(win)), ['yMax']);
  });
});
