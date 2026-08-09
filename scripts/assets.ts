import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Assets } from './report.ts';

export const PROGRAM_NAME = 'npm run build --';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadAssets(): Assets {
  console.error('Building source...');

  const result = esbuild.buildSync({
    entryPoints: [path.join(rootDir, 'src', 'main.tsx')],
    bundle: true,
    write: false,
    loader: { '.tsx': 'tsx', '.ts': 'ts', '.css': 'css' },
    platform: 'browser',
    target: 'esnext',
    outdir: 'dist',
  });

  const js = result.outputFiles.find(file => file.path.endsWith('.js'))?.text ?? '';
  const css = result.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '';
  const template = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');

  return { template, js, css };
}
