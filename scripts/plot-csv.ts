import { PROGRAM_NAME, loadAssets } from './assets.ts';
import { run } from './cli.ts';

try {
  process.exitCode = run(process.argv.slice(2), loadAssets, PROGRAM_NAME);
} catch (err: unknown) {
  console.error(err);
  process.exitCode = 1;
}
