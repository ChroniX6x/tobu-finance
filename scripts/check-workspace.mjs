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
// Phase 3 archives retain original bytes. Reviewed active files implement the new runtime.
const adapted = new Set(['package.json', 'package-lock.json', 'tsconfig.json', 'scripts/new-migration.ts', 'src/new-migration.ts',
  '.env.example', 'src/auth/config.ts', 'src/auth/routes.ts', 'src/db.ts', 'src/server.ts', 'src/routes/month-view.ts', 'src/routes/planning.ts', 'tests/integration/api.test.mjs', 'src/docs/swagger.ts', 'docs/openapi.yaml', 'src/routes/member-incomes.ts', 'src/routes/category-budgets.ts', 'src/routes/contribution-rules.ts',
  ...['account-balances','accounts-summary','accounts','carryovers','categories','category-budgets','common','contribution-rules','member-incomes','members','recurrences','transactions'].map(name => `src/validation/${name}.ts`)]);
for (const item of manifest.files) {
  if (adapted.has(item.path)) continue;
  const archived = resolve(root, 'docs/database/legacy-migrations', item.path);
  // Prefer an active original when present (the archive has its own new README).
  const active = resolve(root, `apps/api/${item.path}`);
  const source = item.path === 'scripts/ensure-env.ts' ? archived : existsSync(active) ? active : archived;
  const bytes = readFileSync(source);
  assert.ok(matchesSource(bytes, item.sha256), `API import drift: ${item.path}`);
}
const assets = json('docs/migration/evidence/web-assets-manifest.json');
const image = read('scripts/lib/docker.mjs').match(/MONGO_IMAGE = '([^']+)'/)[1];
assert.ok(read('infra/compose.yaml').replaceAll('\r\n', '\n').includes(`image: ${image}\n`), 'Development and test MongoDB images must match');
assert.match(image, /^mongo:\d+\.\d+\.\d+$/, 'Pin a concrete MongoDB version');
for (const item of assets.files) {
  const bytes = readFileSync(resolve(root, 'apps/web', item.path));
  assert.ok(matchesSource(bytes, item.sha256), `Web asset drift: ${item.path}`);
}
console.log(`Workspace checks passed: pinned dependencies, API provenance (${manifest.commit}), ${assets.files.length} web assets, no nested locks/repositories or imported user export.`);
