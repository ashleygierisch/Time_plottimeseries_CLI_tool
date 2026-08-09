import * as fs from 'node:fs';

import { parseArgs, usage } from './cliOptions.ts';
import type { Assets } from './report.ts';
import { renderReport } from './report.ts';

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

  process.stdout.write(
    renderReport({
      template: assets.template,
      js: assets.js,
      css: assets.css,
      csv,
      chartOptions: options.chartOptions,
    })
  );

  return 0;
}
