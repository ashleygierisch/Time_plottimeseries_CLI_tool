import assert from 'node:assert';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { contentType, isInside, resolveStaticFile } from './staticFiles.ts';

const ROOT = path.resolve('/srv/app');
const PUBLIC = path.resolve('/srv/app/public');

/** A stand-in disk: only these paths exist. */
function disk(...files: string[]) {
  const present = new Set(files.map(f => path.resolve(f)));
  return (filePath: string) => present.has(filePath);
}

const nothing = disk();

describe('isInside', () => {
  it('accepts a path under the directory', () => {
    assert.strictEqual(isInside(ROOT, path.join(ROOT, 'index.html')), true);
    assert.strictEqual(isInside(ROOT, path.join(ROOT, 'public', 'data.csv')), true);
  });

  it('rejects the directory itself, which is not a file in it', () => {
    assert.strictEqual(isInside(ROOT, ROOT), false);
  });

  it('rejects a path that climbs out', () => {
    assert.strictEqual(isInside(ROOT, path.resolve('/srv/secrets')), false);
    assert.strictEqual(isInside(ROOT, path.resolve('/etc/passwd')), false);
  });

  it('rejects a sibling whose name merely starts the same', () => {
    assert.strictEqual(isInside(ROOT, path.resolve('/srv/app-private/key')), false);
  });
});

describe('resolveStaticFile', () => {
  it('serves index.html for the site root', () => {
    const resolved = resolveStaticFile('/', [ROOT], disk(path.join(ROOT, 'index.html')));

    assert.deepStrictEqual(resolved, { kind: 'file', filePath: path.join(ROOT, 'index.html') });
  });

  it('tries the roots in order and takes the first hit', () => {
    const only = disk(path.join(PUBLIC, 'data.csv'));

    assert.deepStrictEqual(resolveStaticFile('/data.csv', [ROOT, PUBLIC], only), {
      kind: 'file',
      filePath: path.join(PUBLIC, 'data.csv'),
    });
  });

  it('prefers the earlier root when both hold the file', () => {
    const both = disk(path.join(ROOT, 'data.csv'), path.join(PUBLIC, 'data.csv'));

    assert.deepStrictEqual(resolveStaticFile('/data.csv', [ROOT, PUBLIC], both), {
      kind: 'file',
      filePath: path.join(ROOT, 'data.csv'),
    });
  });

  it('finds the dev bundle without a special case for it', () => {
    const built = disk(path.join(ROOT, 'dist', 'app.js.map'));

    assert.deepStrictEqual(resolveStaticFile('/dist/app.js.map', [ROOT, PUBLIC], built), {
      kind: 'file',
      filePath: path.join(ROOT, 'dist', 'app.js.map'),
    });
  });

  it('reports a missing file as missing, not as forbidden', () => {
    assert.deepStrictEqual(resolveStaticFile('/nope.css', [ROOT, PUBLIC], nothing), {
      kind: 'not-found',
    });
  });

  it('refuses a path that climbs out of every root', () => {
    for (const attempt of ['/../etc/passwd', '/../../etc/passwd', '/a/../../etc/passwd']) {
      assert.deepStrictEqual(
        resolveStaticFile(attempt, [ROOT, PUBLIC], disk('/etc/passwd')),
        { kind: 'forbidden' },
        attempt
      );
    }
  });

  it('refuses a percent-encoded climb, which survives URL parsing intact', () => {
    // `new URL()` normalises `../` but leaves `%2e%2e` alone, so this is the
    // form that actually reaches the server.
    for (const attempt of ['/%2e%2e/etc/passwd', '/%2E%2E%2Fetc%2Fpasswd', '/..%2f..%2fetc/passwd']) {
      assert.deepStrictEqual(
        resolveStaticFile(attempt, [ROOT, PUBLIC], disk('/etc/passwd')),
        { kind: 'forbidden' },
        attempt
      );
    }
  });

  it('refuses a malformed escape rather than guessing at it', () => {
    assert.deepStrictEqual(resolveStaticFile('/%zz', [ROOT], nothing), { kind: 'forbidden' });
  });

  it('refuses an embedded NUL, which truncates a path inside a syscall', () => {
    assert.deepStrictEqual(resolveStaticFile('/index.html%00.png', [ROOT], nothing), {
      kind: 'forbidden',
    });
  });

  it('serves a decoded name, so a file with a space in it is reachable', () => {
    const spaced = disk(path.join(ROOT, 'my data.csv'));

    assert.deepStrictEqual(resolveStaticFile('/my%20data.csv', [ROOT], spaced), {
      kind: 'file',
      filePath: path.join(ROOT, 'my data.csv'),
    });
  });

  it('never consults the disk for a path it will not serve', () => {
    const looked: string[] = [];
    resolveStaticFile('/../../etc/passwd', [ROOT, PUBLIC], filePath => {
      looked.push(filePath);
      return true;
    });

    assert.deepStrictEqual(looked, [], 'containment must be decided before any disk access');
  });
});

describe('contentType', () => {
  it('names the types the dev server serves', () => {
    assert.strictEqual(contentType('/srv/app/index.html'), 'text/html');
    assert.strictEqual(contentType('/srv/app/dist/app.js'), 'text/javascript');
    assert.strictEqual(contentType('/srv/app/dist/app.css'), 'text/css');
    assert.strictEqual(contentType('/srv/app/public/data.csv'), 'text/csv');
    assert.strictEqual(contentType('/srv/app/dist/app.js.map'), 'application/json');
  });

  it('falls back to plain text for anything else', () => {
    assert.strictEqual(contentType('/srv/app/README'), 'text/plain');
    assert.strictEqual(contentType('/srv/app/logo.png'), 'text/plain');
  });
});
