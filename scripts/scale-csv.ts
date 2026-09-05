import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scaleCSV } from './scaleCSV.ts';

// The divisor varies per cell so the rescaled series keep their shape without
// being an exact multiple of the original.
const MIN_DIVISOR = 9;
const MAX_DIVISOR = 11;

const dirName = path.dirname(fileURLToPath(import.meta.url));
// Rewrites the file in place, which is the point: this exists to tweak the
// committed sample. Pass a path to point it somewhere else.
const csvPath = process.argv[2] ?? path.resolve(dirName, '..', 'public', 'data.csv');

const scaled = scaleCSV(
  fs.readFileSync(csvPath, 'utf-8'),
  () => Math.random() * (MAX_DIVISOR - MIN_DIVISOR) + MIN_DIVISOR
);

fs.writeFileSync(csvPath, scaled);

console.error(`Rescaled ${csvPath}`);
