import assert from 'node:assert';
import { describe, it } from 'node:test';

import { renderReport } from './report.ts';

const template = `<html><head><!--PRODUCTION_DATA--><!--PRODUCTION_STYLE--></head>`
  + `<body><script src="./dist/app.js"></script><!--PRODUCTION_SCRIPT--></body></html>`;

function render(overrides: { csv?: string; js?: string; css?: string } = {}): string {
  return renderReport({
    template,
    js: overrides.js ?? 'console.log(1)',
    css: overrides.css ?? 'body { color: red; }',
    csv: overrides.csv ?? 'date,value\n2026-01-01,1\n',
    chartOptions: { yMax: 10 },
  });
}

describe('renderReport', () => {
  it('injects the csv, the chart options, the styles and the script', () => {
    const html = render();

    assert.match(html, /window\.__INITIAL_CSV__ = "date,value\\n2026-01-01,1\\n"/);
    assert.match(html, /window\.__CHART_OPTIONS__ = \{"yMax":10\}/);
    assert.match(html, /<style>body \{ color: red; \}<\/style>/);
    assert.match(html, /<script>console\.log\(1\)<\/script>/);
  });

  it('leaves no placeholders behind', () => {
    assert.doesNotMatch(render(), /PRODUCTION_(DATA|STYLE|SCRIPT)/);
  });

  it('escapes markup in the csv so it cannot close the injected script tag', () => {
    const html = render({ csv: 'date,value\n</script><script>alert(1)</script>,1\n' });

    assert.doesNotMatch(html, /<\/script><script>alert\(1\)/);
    assert.match(html, /<\\\/script>/);
  });

  it('keeps dollar patterns in the bundled sources verbatim', () => {
    const html = render({ js: 'const a = "$&$`";', css: 'a::after { content: "$\'"; }' });

    assert.match(html, /const a = "\$&\$`";/);
    assert.match(html, /content: "\$'";/);
  });
});
