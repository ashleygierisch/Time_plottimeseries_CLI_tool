import assert from 'node:assert';
import { describe, it } from 'node:test';

import { inlineSources, renderReport } from './report.ts';
import { cspHash } from './securityHeaders.ts';

const template =
  `<html><head><!--PRODUCTION_CSP--><!--PRODUCTION_DATA--><!--PRODUCTION_STYLE-->` +
  `<link rel="stylesheet" href="./dist/app.css"></head>` +
  `<body><script type="module" src="./dist/app.js"></script>` +
  `<!--PRODUCTION_SCRIPT--></body></html>`;

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

  it('drops the dev server tags, which would 404 next to a report', () => {
    const html = render();

    assert.doesNotMatch(html, /\.\/dist\//);
  });
});

describe('renderReport content security policy', () => {
  function policy(html: string): string {
    const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]*)" \/>/.exec(html);
    assert.ok(meta, 'no Content-Security-Policy meta tag in the report');
    return meta[1] ?? '';
  }

  it('hashes every inline block it emits, so the browser runs all of them', () => {
    const input = {
      template,
      js: 'console.log(1)',
      css: 'body { color: red; }',
      csv: 'date,value\n2026-01-01,1\n',
      chartOptions: { yMax: 10 },
    };
    const csp = policy(renderReport(input));
    const sources = inlineSources(input);

    for (const source of [...sources.scripts, ...sources.styles]) {
      assert.ok(csp.includes(cspHash(source)), `no hash covering: ${source.slice(0, 40)}`);
    }
  });

  it('hashes the data script over what is actually inlined, escaping included', () => {
    // The escaping happens before hashing, so a `</` in the CSV must not put the
    // policy and the page out of step.
    const input = {
      template,
      js: 'console.log(1)',
      css: 'body {}',
      csv: 'date,value\n</script>,1\n',
      chartOptions: {},
    };
    const html = renderReport(input);
    // Non-greedy to the first real closing tag: the escaped one in the data
    // reads `<\/script>`, so it cannot end the match early.
    const inlined = /<script>(window\.__INITIAL_CSV__[\s\S]*?)<\/script>/.exec(html);

    assert.ok(inlined, 'no data script in the report');
    assert.ok(policy(html).includes(cspHash(inlined[1] ?? '')));
  });

  it('comes before the tags it governs', () => {
    const html = render();

    assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('__INITIAL_CSV__'));
  });

  it('denies by default and never allows eval', () => {
    const csp = policy(render());

    assert.ok(csp.includes(`default-src 'none'`));
    assert.ok(!csp.includes('unsafe-eval'));
  });
});
