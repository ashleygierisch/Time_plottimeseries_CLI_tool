/**
 * The scriptc side of the CLI: the entry point that gets compiled, and the
 * reading of what `scriptc coverage` says about it.
 *
 * Both the standalone build and the coverage check in `npm run validate`
 * generate the entry point from here, so the file the check reads is the file
 * the build compiles.
 */
import type { Assets } from './report.ts';

export const PROGRAM_NAME = 'plottimeseries';

/**
 * The compiled CLI has no bundler and no filesystem to load from, so the
 * assets are baked in as string literals and `run` is called directly.
 */
export function scriptcEntry(assets: Assets): string {
  return `import { run } from '../../scripts/cli.ts';

const template = ${JSON.stringify(assets.template)};
const js = ${JSON.stringify(assets.js)};
const css = ${JSON.stringify(assets.css)};

const code = run(process.argv.slice(2), () => ({ template, js, css }), ${JSON.stringify(PROGRAM_NAME)});

if (code !== 0) process.exit(code);
`;
}

/**
 * Pull the percentage out of the coverage report, which looks like:
 *
 *       statements analyzed   97
 *       compile statically    97  (100%)
 *
 * `scriptc coverage` exits 0 whatever it finds -- it is a report, not a check
 * -- so the number is the only signal there is. Undefined means the output was
 * not a report at all, which is its own failure.
 */
export function parseCoverage(output: string): number | undefined {
  const percent = /compile statically\s+\d+\s+\((\d+)%\)/.exec(output)?.[1];
  return percent == null ? undefined : Number(percent);
}
