import { test } from 'node:test';
import assert from 'node:assert';
import { isFramed } from './frameGuard.ts';

test('isFramed is false for a top-level window', () => {
  const win = {};
  assert.strictEqual(isFramed({ top: win, self: win }), false);
});

test('isFramed is true when the window is not the top window', () => {
  assert.strictEqual(isFramed({ top: {}, self: {} }), true);
});

test('isFramed is true when reading `top` throws, as it can cross-origin', () => {
  const guarded = {
    get top(): unknown {
      throw new Error('Blocked a frame from accessing a cross-origin frame.');
    },
    self: {},
  };
  assert.strictEqual(isFramed(guarded), true);
});
