import type { ChartOptions } from '../src/chartOptions.ts';
import { contentSecurityPolicy } from './securityHeaders.ts';
import type { InlineSources } from './securityHeaders.ts';

export interface Assets {
  template: string;
  js: string;
  css: string;
}

export interface ReportInput {
  template: string;
  js: string;
  css: string;
  csv: string;
  chartOptions: ChartOptions;
}

function inlineJSON(value: unknown): string {
  return JSON.stringify(value).split('</').join('<\\/');
}

function insertAt(html: string, marker: string, value: string): string {
  const index = html.indexOf(marker);
  if (index === -1) return html;
  return html.slice(0, index) + value + html.slice(index + marker.length);
}

/**
 * The inline scripts and styles a report ends up containing, in document order.
 * The CSP hashes have to be taken over exactly these strings, so they are built
 * once and used for both the report and the `_headers` file.
 */
export function inlineSources(input: ReportInput): InlineSources {
  const data =
    `window.__INITIAL_CSV__ = ${inlineJSON(input.csv)};` +
    `window.__CHART_OPTIONS__ = ${inlineJSON(input.chartOptions)};`;

  return { scripts: [data, input.js], styles: [input.css] };
}

export function renderReport(input: ReportInput): string {
  const sources = inlineSources(input);
  const csp = contentSecurityPolicy(sources);

  let html = input.template;
  // The policy has to be parsed before the tags it governs, so it goes first.
  html = insertAt(
    html,
    '<!--PRODUCTION_CSP-->',
    `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
  );
  html = insertAt(html, '<!--PRODUCTION_DATA-->', `<script>${sources.scripts[0]}</script>`);
  html = insertAt(html, '<!--PRODUCTION_STYLE-->', `<style>${input.css}</style>`);
  html = insertAt(html, '<!--PRODUCTION_SCRIPT-->', `<script>${input.js}</script>`);

  // The dev server's ./dist tags. Nothing is served next to a report, so they
  // would 404, and the CSP blocks them anyway -- which shows up in the console.
  html = html.split('<link rel="stylesheet" href="./dist/app.css">').join('');
  html = html.split('<script type="module" src="./dist/app.js"></script>').join('');

  return html;
}
