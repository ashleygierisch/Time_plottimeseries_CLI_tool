import type { ChartOptions } from '../src/chartOptions.ts';

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

export function renderReport(input: ReportInput): string {
  const data =
    `<script>window.__INITIAL_CSV__ = ${inlineJSON(input.csv)};` +
    `window.__CHART_OPTIONS__ = ${inlineJSON(input.chartOptions)};</script>`;

  let html = input.template;
  html = insertAt(html, '<!--PRODUCTION_DATA-->', data);
  html = insertAt(html, '<!--PRODUCTION_STYLE-->', `<style>${input.css}</style>`);
  html = insertAt(html, '<!--PRODUCTION_SCRIPT-->', `<script>${input.js}</script>`);

  return html;
}
