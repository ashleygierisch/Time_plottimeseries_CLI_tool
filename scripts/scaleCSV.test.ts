import assert from 'node:assert';
import { describe, it } from 'node:test';

import { scaleCSV } from './scaleCSV.ts';

/** A fixed divisor, so the arithmetic is the only thing under test. */
const byTen = () => 10;

describe('scaleCSV', () => {
  it('keeps every row it was given', () => {
    const csv = 'date,alpha,beta\n2023-01-01,100,200\n2023-01-02,300,400\n2023-01-03,500,600\n';

    assert.strictEqual(scaleCSV(csv, byTen).split('\n').length, csv.split('\n').length);
  });

  it('leaves the header alone, names and all', () => {
    const csv = 'date,alpha{type: currency},beta\n2023-01-01,100,200';

    assert.strictEqual(scaleCSV(csv, byTen).split('\n')[0], 'date,alpha{type: currency},beta');
  });

  it('divides the numbers and rounds to three places', () => {
    const csv = 'date,alpha,beta\n2023-01-01,100,7';

    assert.strictEqual(scaleCSV(csv, byTen), 'date,alpha,beta\n2023-01-01,10,0.7');
  });

  it('rounds to three places rather than carrying the full quotient', () => {
    assert.strictEqual(scaleCSV('date,a\nx,1', () => 3), 'date,a\nx,0.333');
  });

  it('passes through anything that is not a number on its own', () => {
    const csv = 'date,note,link\n2023-01-01,High,[Docs](https://d3js.org)';

    assert.strictEqual(scaleCSV(csv, byTen), csv);
  });

  it('leaves blank cells blank rather than reading them as zero', () => {
    assert.strictEqual(scaleCSV('date,a,b\n2023-01-01,,50', byTen), 'date,a,b\n2023-01-01,,5');
  });

  it('scales a number wherever its column sits', () => {
    assert.strictEqual(scaleCSV('a,date,b\n50,2023-01-01,70', byTen), 'a,date,b\n5,2023-01-01,7');
  });

  it('is idempotent in shape: rescaling twice loses no rows', () => {
    const csv = 'date,alpha\n2023-01-01,100\n2023-01-02,200\n';

    assert.strictEqual(scaleCSV(scaleCSV(csv, byTen), byTen), 'date,alpha\n2023-01-01,1\n2023-01-02,2\n');
  });

  it('keeps a trailing newline, and survives a file with no rows', () => {
    assert.strictEqual(scaleCSV('date,alpha\n', byTen), 'date,alpha\n');
    assert.strictEqual(scaleCSV('', byTen), '');
  });
});
