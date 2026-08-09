import * as fs from 'node:fs';

import { parseArgs, usage } from './cliOptions.ts';
import type { Assets } from './report.ts';
import { inlineSources, renderReport } from './report.ts';
import { headersFile } from './securityHeaders.ts';

export function run(args: string[], loadAssets: () => Assets, programName: string): number {
  const options = parseArgs(args);

  if (options.error != null) {
    console.error(`Error: ${options.error}\n\n${usage(programName)}`);
    return 1;
  }

  if (options.help) {
    console.error(usage(programName));
    return 0;
  }

  const csvPath = options.csvPath;

  if (csvPath != null && !fs.existsSync(csvPath)) {
    console.error(`Error: CSV file not found: ${csvPath}`);
    return 1;
  }

  const csv = csvPath == null ? fs.readFileSync(0, 'utf-8') : fs.readFileSync(csvPath, 'utf-8');
  const assets = loadAssets();

  console.error('Generating HTML report...');

  const input = {
    template: assets.template,
    js: assets.js,
    css: assets.css,
    csv,
    chartOptions: options.chartOptions,
  };

  process.stdout.write(renderReport(input));

  if (options.headersFile != null) {
    // Same sources as the report, so the two copies of the policy agree.
    fs.writeFileSync(options.headersFile, headersFile(inlineSources(input)));
    console.error(`Wrote ${options.headersFile}`);
  }

  return 0;
}
