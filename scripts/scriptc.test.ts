import assert from 'node:assert';
import { describe, it } from 'node:test';

import { parseCoverage, scriptcEntry } from './scriptc.ts';

describe('scriptcEntry', () => {
  it('inlines the assets as literals', () => {
    const entry = scriptcEntry({ template: '<p>hi</p>', js: 'x = 1;', css: 'p { color: red }' });

    assert.match(entry, /const template = "<p>hi<\/p>";/);
    assert.match(entry, /const js = "x = 1;";/);
    assert.match(entry, /const css = "p \{ color: red \}";/);
  });

  it('escapes assets that would otherwise break out of the literal', () => {
    const entry = scriptcEntry({ template: '</script>"\n`${}', js: '', css: '' });

    assert.ok(!entry.includes('</script>"\n'));
    assert.match(entry, /const template = "<\/script>\\"\\n`\$\{\}";/);
  });
});

describe('parseCoverage', () => {
  const report = (analyzed: number, compiled: number, percent: number): string =>
    `\n  statements analyzed   ${analyzed}\n  compile statically    ${compiled}  (${percent}%)\n`;

  it('reads a full report', () => {
    assert.equal(parseCoverage(report(97, 97, 100)), 100);
  });

  it('reads a partial report', () => {
    assert.equal(parseCoverage(`${report(6, 3, 50)}\n  blockers:\n      x1  something`), 50);
  });

  it('is undefined when scriptc printed something else', () => {
    assert.equal(parseCoverage('scriptc: no such file\n'), undefined);
  });
});
