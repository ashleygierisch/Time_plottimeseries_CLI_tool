import * as fs from 'node:fs';
import * as path from 'node:path';

import { fileURLToPath } from 'node:url';

const dirName = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.resolve(dirName, '..', 'public', 'data.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

const lines = csvContent.trim().split('\n');
const dataLines = lines.slice(1);

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function roundTo3Decimals(num: number): number {
  return Math.round(num * 1000) / 1000;
}

const processedLines = dataLines.map((line: string, index: number): string => {
  if (index === 0) {
    return line.split(',').map((_, i) => i == 0 ? 'date' : `total_${i}`).join(',');
  }
  return line.split(',').map((cell: string, index: number): string => {
    if (index === 0) {
      return cell;
    }
    if (cell === '0') {
      return cell;
    }
    const num = parseFloat(cell);
    if (isNaN(num)) {
      return cell;
    }
    const divisor = randomBetween(9, 11);
    const result = roundTo3Decimals(num / divisor);
    return result.toString();
  }).join(',');
});

fs.writeFileSync(csvPath, processedLines.join('\n'));

console.log('CSV file processed and saved.');
