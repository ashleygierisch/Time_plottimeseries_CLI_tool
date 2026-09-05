import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { cssVar, THEME, type ThemeColor } from './theme.ts';

const styleSheet = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'style.css'),
  'utf-8'
);

/** The first `:root { ... }` block, which is the palette. */
function declaredCustomProperties(): Map<string, string> {
  const block = /:root\s*\{([^}]*)\}/.exec(styleSheet);
  assert.ok(block, 'style.css has no :root block');

  const declared = new Map<string, string>();
  for (const [, name, value] of (block[1] ?? '').matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)) {
    if (name !== undefined && value !== undefined) declared.set(name, value.trim());
  }
  return declared;
}

describe('the palette in style.css and THEME', () => {
  const declared = declaredCustomProperties();
  const names = Object.keys(THEME) as ThemeColor[];

  it('found a palette to compare against', () => {
    assert.ok(declared.size > 0, 'no custom properties parsed out of style.css');
  });

  it('declares every THEME colour, with the same value', () => {
    for (const name of names) {
      const property = cssVar(name).slice('var('.length, -1);
      assert.strictEqual(
        declared.get(property),
        THEME[name],
        `${property} in style.css does not match THEME.${name}`
      );
    }
  });

  it('declares nothing THEME does not, so neither list grows alone', () => {
    const expected = new Set(names.map(name => cssVar(name).slice('var('.length, -1)));
    for (const property of declared.keys()) {
      assert.ok(expected.has(property), `${property} is in style.css but not in THEME`);
    }
  });
});

describe('cssVar', () => {
  it('spells a camelCase key as its kebab-case custom property', () => {
    assert.strictEqual(cssVar('ground'), 'var(--ground)');
    assert.strictEqual(cssVar('groundAlt'), 'var(--ground-alt)');
    assert.strictEqual(cssVar('accentHover'), 'var(--accent-hover)');
  });
});
