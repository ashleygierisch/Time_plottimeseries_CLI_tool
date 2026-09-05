/**
 * The whole pre-deploy check, in one command.
 *
 * `npm audit` needs the network, so it runs first and on its own. Everything
 * after it -- lint, typecheck, test, and the build itself -- runs inside a
 * network namespace with no egress, because those are the steps that execute
 * dependency code. A compromised package can still ruin the build, but it
 * cannot phone home or pull down a second stage while doing it.
 *
 * The sandbox is verified rather than assumed: `assertNoEgress` tries a real
 * connection and fails the run if it succeeds.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cspHash } from './securityHeaders.ts';

const THIS_FILE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(THIS_FILE), '..');
const SITE_DIR = path.join(ROOT, 'pages-public');
const SAMPLE_CSV = path.join('public', 'data.csv');
const SCREENSHOT = path.join('public', 'plottimeseries-screen-shot.png');

const OFFLINE_STEPS = ['lint', 'typecheck', 'test'];

// Tried in order; the first one that can run a command is used.
const SANDBOXES = [
  ['unshare', '--net', '--'],
  ['sudo', '-n', 'env', `PATH=${process.env.PATH ?? ''}`, 'unshare', '--net', '--'],
];

function run(command: string, args: string[]): void {
  const { status, error } = spawnSync(command, args, { stdio: 'inherit', cwd: ROOT });
  if (error) {
    console.error(error);
    process.exit(1);
  }
  if (status !== 0) {
    console.error(`\nFailed: ${[command, ...args].join(' ')}`);
    process.exit(status ?? 1);
  }
}

function pickSandbox(): string[] | undefined {
  return SANDBOXES.find(([command, ...args]) => {
    if (command === undefined) return false;
    const { status } = spawnSync(command, [...args, process.execPath, '-e', ''], {
      stdio: 'ignore',
    });
    return status === 0;
  });
}

// Confirm the sandbox actually severed egress rather than trusting the flag.
function assertNoEgress(): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: '1.1.1.1', port: 443 });
    const finish = (err?: Error): void => {
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };
    socket.setTimeout(5000);
    socket.on('error', () => finish());
    socket.on('timeout', () => finish());
    socket.on('connect', () => finish(new Error('network egress is not blocked')));
  });
}

/**
 * Build the deployable site. This happens inside the sandbox so that what gets
 * uploaded is the artifact that was produced with no network available.
 */
function buildSite(): void {
  fs.rmSync(SITE_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(SITE_DIR, 'img'), { recursive: true });

  const indexPath = path.join(SITE_DIR, 'index.html');
  const out = fs.openSync(indexPath, 'w');
  try {
    const { status, error } = spawnSync(
      'npm',
      ['run', 'build', '--', SAMPLE_CSV, '--headers-file', path.join(SITE_DIR, '_headers')],
      { stdio: ['ignore', out, 'inherit'], cwd: ROOT }
    );
    if (error) {
      console.error(error);
      process.exit(1);
    }
    if (status !== 0) {
      console.error('\nFailed: npm run build');
      process.exit(status ?? 1);
    }
  } finally {
    fs.closeSync(out);
  }

  fs.copyFileSync(path.join(ROOT, SCREENSHOT), path.join(SITE_DIR, 'img', path.basename(SCREENSHOT)));
}

function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

/**
 * Smoke-test the built site. The interesting check is the last one: every
 * inline script and style must be covered by a hash in the CSP. Nothing else
 * catches a change that makes the policy and the page disagree, and the
 * symptom -- a blank page, only in production -- is easy to ship.
 */
function checkBuildArtifacts(): void {
  for (const file of ['index.html', '_headers', path.join('img', path.basename(SCREENSHOT))]) {
    if (!fs.existsSync(path.join(SITE_DIR, file))) {
      fail(`Missing build output: pages-public/${file}`);
    }
  }

  const html = fs.readFileSync(path.join(SITE_DIR, 'index.html'), 'utf-8');

  if (!html.includes('<div id="root"></div>')) fail('Built index.html has no mount point');
  if (html.includes('./dist/')) fail('Built index.html still references the dev server bundle');

  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1];
  if (csp == null) fail('Built index.html has no Content-Security-Policy meta tag');

  const inline = [
    ...[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1] ?? ''),
    ...[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1] ?? ''),
  ];
  if (inline.length !== 3) {
    fail(`Expected 2 inline scripts and 1 inline style, found ${inline.length} blocks total`);
  }
  for (const source of inline) {
    if (!csp.includes(cspHash(source))) {
      fail(
        'An inline <script>/<style> in the built page is not covered by a CSP hash, '
        + 'so the browser will block it. Check scripts/plot-csv.ts.'
      );
    }
  }
}

async function offlineSteps(sandboxed: boolean): Promise<void> {
  if (sandboxed) await assertNoEgress();
  for (const step of OFFLINE_STEPS) run('npm', ['run', step]);
  buildSite();
}

async function validate(): Promise<void> {
  if (process.argv.includes('--offline')) {
    await offlineSteps(process.argv.includes('--sandboxed'));
    return;
  }

  run('npm', ['audit', '--audit-level', 'high']);

  const [command, ...args] = pickSandbox() ?? [];
  if (command !== undefined) {
    run(command, [...args, process.execPath, THIS_FILE, '--offline', '--sandboxed']);
  } else if (process.env.CI) {
    fail('No no-egress sandbox available (needs unshare, and sudo unless root).');
  } else {
    console.error('Warning: no no-egress sandbox available, running with network access.\n');
    await offlineSteps(false);
  }

  checkBuildArtifacts();
  console.error('\nvalidate: ok');
}

validate().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
