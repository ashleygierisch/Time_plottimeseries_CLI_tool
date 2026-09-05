/**
 * Fail if the CLI has drifted out of the subset of TypeScript that scriptc
 * compiles statically.
 *
 * `npm run build:standalone` compiles the same entry point, but a failure
 * there is deliberately soft: the build drops the compiled binary and carries
 * on, and CI only leaves a warning annotation, because the compile also needs
 * `clang` and a supported platform. That makes a real regression easy to walk
 * past. `scriptc coverage` is static analysis with no toolchain behind it, so
 * it can run as an ordinary validate step and say so the moment the number
 * moves off 100%.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCoverage, scriptcEntry } from './scriptc.ts';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptcMain = path.join(rootDir, 'node_modules', 'scriptc', 'dist', 'main.js');
const entryPath = path.join(rootDir, 'dist', 'scriptc', 'main.ts');

function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

// The assets are inert string literals as far as the compiler is concerned, so
// the check does not need the real bundle -- and skipping esbuild keeps this
// step down to about a second.
const entry = scriptcEntry({ template: '', js: '', css: '' });

fs.mkdirSync(path.dirname(entryPath), { recursive: true });
fs.writeFileSync(entryPath, entry);

const relativeEntry = path.relative(rootDir, entryPath);
const { status, error, stdout, stderr } = spawnSync(
  process.execPath,
  [scriptcMain, 'coverage', entryPath],
  { encoding: 'utf-8', cwd: rootDir },
);

if (error) {
  console.error(error);
  process.exit(1);
}

const output = `${stdout}${stderr}`;
process.stderr.write(output);

if (status !== 0) fail(`Failed: scriptc coverage ${relativeEntry}`);

const coverage = parseCoverage(output);

if (coverage == null)
  fail(`Could not read a coverage report from scriptc coverage ${relativeEntry}`);

if (coverage < 100) {
  fail(
    `Only ${coverage}% of the CLI compiles statically. scripts/cli.ts and everything\n` +
      'it imports have to stay inside the scriptc subset; the blockers above name\n' +
      'the constructs that left it.',
  );
}
