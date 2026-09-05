import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import type { TestContext } from 'node:test';

export interface SnapshotOptions {
  testFilePath: string;
  extension?: string;
}

const shouldUpdateSnapshots =
  process.env.UPDATE_SNAPSHOTS === '1' ||
  process.env.UPDATE_SNAPSHOTS === 'true' ||
  process.argv.includes('--test-update-snapshots');

function sanitizeTestName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

export function assertSnapshot(
  t: TestContext,
  value: string,
  options: SnapshotOptions
): void {
  const testName = sanitizeTestName(t.name);
  const ext = options.extension ?? '.snapshot';
  const snapshotDir = path.join(path.dirname(options.testFilePath), '__snapshots__');
  const snapshotFile = path.join(snapshotDir, `${testName}${ext}`);

  if (shouldUpdateSnapshots || !fs.existsSync(snapshotFile)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
    fs.writeFileSync(snapshotFile, value, 'utf-8');
    if (shouldUpdateSnapshots) {
      console.log(`Snapshot updated: ${snapshotFile}`);
    } else {
      console.log(`Snapshot created: ${snapshotFile}. Re-run tests to validate.`);
    }
    return;
  }

  const expected = fs.readFileSync(snapshotFile, 'utf-8');
  assert.strictEqual(
    value,
    expected,
    `Snapshot mismatch for "${t.name}". ` +
    `Run with UPDATE_SNAPSHOTS=1 to update, or delete ${snapshotFile} to regenerate.`
  );
}
