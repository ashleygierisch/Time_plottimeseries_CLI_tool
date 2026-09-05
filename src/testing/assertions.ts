import assert from 'node:assert';

/**
 * Asserts that a lookup found something, and narrows away the `undefined` that
 * `noUncheckedIndexedAccess` adds to every index expression.
 *
 * A test that indexes past the end of its own fixture is a broken test, so this
 * says which lookup missed instead of leaving a `TypeError` on the next line to
 * explain it. Prefer it to a `!`, which asserts the same thing without checking
 * it or reporting anything when it is wrong.
 */
export function defined<T>(value: T | undefined, what = 'value'): T {
  assert.ok(value !== undefined, `expected a ${what}, found undefined`);
  return value;
}
