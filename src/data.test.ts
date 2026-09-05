import { test } from 'node:test';
import assert from 'node:assert';
import { getCSVData } from './data.ts';

const TEST_CSV = `date,pct_change,amount,category
2023-01-01,0.15,45.5,High
2023-01-02,-0.8,-99.25,Low
2023-01-03,0.02,0.75,Medium
2023-01-04,1.0,100,High
2023-01-05,-0.33,-5.5,Low
2023-01-06,0.5,0.05,Medium`;

test('getCSVData prefer query parameter', async () => {
  const win = {
    location: {
      href: `http://localhost:3000/?csv=${encodeURIComponent(TEST_CSV)}`
    },
    __INITIAL_CSV__: 'csv-from-window'
  } as unknown as Window;

  const loadDefault = () => Promise.resolve('csv-from-fetch');

  const result = await getCSVData(win, loadDefault);
  assert.strictEqual(result, TEST_CSV);
});

test('getCSVData fallback to window.__INITIAL_CSV__', async () => {
  const win = {
    location: {
      href: 'http://localhost:3000/'
    },
    __INITIAL_CSV__: 'csv-from-window'
  } as unknown as Window;

  const loadDefault = () => Promise.resolve('csv-from-fetch');

  const result = await getCSVData(win, loadDefault);
  assert.strictEqual(result, 'csv-from-window');
});

test('getCSVData fallback to loadDefault', async () => {
  const win = {
    location: {
      href: 'http://localhost:3000/'
    }
  } as unknown as Window;

  const loadDefault = () => Promise.resolve('csv-from-fetch');

  const result = await getCSVData(win, loadDefault);
  assert.strictEqual(result, 'csv-from-fetch');
});
