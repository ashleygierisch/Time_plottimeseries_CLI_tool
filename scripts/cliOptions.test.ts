import assert from 'node:assert';
import { describe, it } from 'node:test';

import { parseArgs } from './cliOptions.ts';

describe('parseArgs', () => {
  it('reads the first positional argument as the csv path', () => {
    const options = parseArgs(['data.csv', 'ignored.csv']);

    assert.strictEqual(options.csvPath, 'data.csv');
    assert.deepStrictEqual(options.chartOptions, {});
    assert.strictEqual(options.error, null);
  });

  it('leaves the csv path unset when there is none, for stdin', () => {
    assert.strictEqual(parseArgs([]).csvPath, null);
  });

  it('takes y bounds as separate or joined arguments', () => {
    assert.deepStrictEqual(parseArgs(['--y-max', '100', '--y-min', '-5']).chartOptions, {
      yMax: 100,
      yMin: -5,
    });
    assert.deepStrictEqual(parseArgs(['--y-max=100', '--y-min=-5']).chartOptions, {
      yMax: 100,
      yMin: -5,
    });
  });

  it('keeps the csv path alongside options in any order', () => {
    const options = parseArgs(['--y-max', '1', 'data.csv']);

    assert.strictEqual(options.csvPath, 'data.csv');
    assert.deepStrictEqual(options.chartOptions, { yMax: 1 });
  });

  it('reports help for -h and --help', () => {
    assert.strictEqual(parseArgs(['-h']).help, true);
    assert.strictEqual(parseArgs(['--help']).help, true);
    assert.strictEqual(parseArgs(['data.csv']).help, false);
  });

  it('reports a value that is not a number', () => {
    assert.strictEqual(parseArgs(['--y-max', 'abc']).error, '--y-max expects a number, got: abc');
    assert.strictEqual(parseArgs(['--y-min=']).error, '--y-min expects a number, got: ');
  });

  it('reports a missing value', () => {
    assert.strictEqual(parseArgs(['--y-max']).error, '--y-max expects a number, got: (nothing)');
  });

  it('reports an unknown option', () => {
    assert.strictEqual(parseArgs(['--nope', 'data.csv']).error, 'unknown option: --nope');
  });
});
