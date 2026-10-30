import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { endpoints } from '@tobu/contracts/endpoints';
import { root, webRequire } from './lib/config.mjs';
import { implementedRoutes } from './lib/route-contracts.mjs';
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const mounts = { 'accounts-summary': 'accounts', 'account-overview': 'accounts', 'month-view': 'accounts', 'master-data': 'accounts', planning: 'accounts' };
const actual = [];
for (const filename of readdirSync(resolve(root, 'apps/api/src/routes')).filter((f) => f.endsWith('.ts'))) {
    const name = filename.slice(0, -3);
    for (const { method, path: suffix } of implementedRoutes(read('apps/api/src/routes/' + filename), 'r')) {
        actual.push(`${method} /api/${mounts[name] ?? name}${suffix === '/' ? '' : suffix}`);
    }
}
for (const { method, path: suffix } of implementedRoutes(read('apps/api/src/auth/routes.ts'), 'router')) actual.push(`${method} /api/auth${suffix}`);
assert.deepEqual(actual.sort(), endpoints.map((e) => `${e.method} ${e.path}`).sort(), 'Every implemented API route must have exactly one shared contract');
for (const filename of readdirSync(resolve(root, 'packages/contracts/src'))) {
    const source = read('packages/contracts/src/' + filename);
    // Only calendar.ts may use Luxon (the apps' date library); every other contract file stays zod-only.
    const allowed = filename === 'calendar.ts' ? ['zod', 'luxon'] : ['zod'];
    for (const [, specifier] of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
        assert.ok(allowed.includes(specifier) || specifier.startsWith('./'), `Server dependency in contracts: ${specifier}`);
    }
    assert.doesNotMatch(source, /\brequire\s*\(|\bimport\s*\(|\bprocess\.|\bBuffer\b/, 'Contracts must be browser-compatible');
}
const pkg = JSON.parse(read('packages/contracts/package.json'));
assert.deepEqual(pkg.dependencies, { luxon: '3.7.1', zod: '4.1.12' });
for (const app of ['web', 'api']) assert.equal(JSON.parse(read(`apps/${app}/package.json`)).dependencies.luxon, pkg.dependencies.luxon, `Luxon version must match in contracts and ${app}`);
const lock = JSON.parse(read('package-lock.json'));
assert.equal(lock.packages['node_modules/@tobu/contracts'].link, true);
for (const app of ['web', 'api']) assert.equal(JSON.parse(read(`apps/${app}/package.json`)).dependencies['@tobu/contracts'], '0.0.0');
// Use the browser bundler already declared by Angular's build package.
const buildRequire = createRequire(webRequire.resolve('@angular/build/package.json'));
const { build } = buildRequire('esbuild');
const browser = await build({ entryPoints: [resolve(root, 'packages/contracts/dist/endpoints.js')], bundle: true, platform: 'browser', format: 'esm', write: false, metafile: true });
for (const input of Object.keys(browser.metafile.inputs)) assert.doesNotMatch(input, /(?:node_modules[\\/](?:mongodb|mongoose|express)|apps[\\/]api[\\/])/);
console.log(`Contracts: ${actual.length} routes covered; real ESM exports, explicit workspace dependencies and browser boundaries checked.`);
