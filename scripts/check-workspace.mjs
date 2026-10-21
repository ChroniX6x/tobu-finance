import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = p => readFileSync(resolve(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function matchesSource(bytes, expected) {
  if (sha256(bytes) === expected) return true;
  // Git may check out UTF-8 text as CRLF on Windows; never normalize binary assets.
  const text = bytes.toString('utf8');
  return !bytes.includes(0) && Buffer.from(text).equals(bytes)
    && sha256(Buffer.from(text.replaceAll('\r\n', '\n'))) === expected;
}
const manifest = json('docs/migration/evidence/api-import-manifest.json');
const baseline = json('docs/migration/evidence/phase-2-dependency-baseline.json');
const lock = json('package-lock.json');
assert.equal(lock.lockfileVersion, 3);
assert.equal(json('package.json').private, true);
for (const app of ['web', 'api']) {
  const pkg = json(`apps/${app}/package.json`);
  assert.equal(pkg.name, `@tobu/${app}`);
  assert.equal(lock.packages[`node_modules/@tobu/${app}`].link, true);
  assert.equal(lock.packages[`node_modules/@tobu/${app}`].resolved, `apps/${app}`);
  for (const filename of ['package-lock.json', 'yarn.lock', '.git']) {
    assert.equal(existsSync(resolve(root, `apps/${app}/${filename}`)), false, `Nested ${filename}`);
  }
  for (const [name, previous] of Object.entries(baseline[app])) {
    assert.equal(pkg[previous.group][name], previous.version, `${app}: direct dependency drift ${name}`);
    assert.equal(lock.packages[`apps/${app}`][previous.group][name], previous.version);
    const installed = lock.packages[`apps/${app}/node_modules/${name}`] ?? lock.packages[`node_modules/${name}`];
    assert.equal(installed?.version, previous.version, `${app}: lockfile drift ${name}`);
  }
}
assert.equal(existsSync(resolve(root, 'yarn.lock')), false, 'Remove the one-time Yarn conversion input');
for (const excluded of manifest.excluded) assert.equal(existsSync(resolve(root, `apps/api/${excluded.path}`)), false);
// Only these source files require workspace-specific modifications. Everything
// else, including historical migrations, fixtures, and OpenAPI, stays byte-identical.
const adapted = new Set(['package.json', 'package-lock.json', 'tsconfig.json', 'scripts/new-migration.ts', 'src/new-migration.ts']);
for (const item of manifest.files) {
  if (adapted.has(item.path)) continue;
  const bytes = readFileSync(resolve(root, `apps/api/${item.path}`));
  assert.ok(matchesSource(bytes, item.sha256), `API import drift: ${item.path}`);
}
const assets = json('docs/migration/evidence/web-assets-manifest.json');
for (const item of assets.files) {
  const bytes = readFileSync(resolve(root, 'apps/web', item.path));
  assert.ok(matchesSource(bytes, item.sha256), `Web asset drift: ${item.path}`);
}
console.log(`Workspace checks passed: pinned dependencies, API provenance (${manifest.commit}), ${assets.files.length} web assets, no nested locks/repositories or imported user export.`);
