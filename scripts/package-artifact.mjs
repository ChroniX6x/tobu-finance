import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { root } from './lib/config.mjs';
import { capture } from './lib/processes.mjs';

const output = resolve(root, 'dist/release');
if (dirname(output) !== resolve(root, 'dist')) throw new Error('Invalid release path');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
// Preserve the exact workspace graph and lock. Only compiled runtime files travel.
for (const path of ['package.json', 'package-lock.json', 'apps/api/package.json', 'apps/web/package.json', 'packages/contracts/package.json', 'apps/api/dist', 'apps/web/dist', 'packages/contracts/dist', 'scripts/serve-artifact.mjs']) {
    const destination = resolve(output, path);
    await mkdir(dirname(destination), { recursive: true });
    await cp(resolve(root, path), destination, { recursive: true });
}
const pkg = JSON.parse(await readFile(resolve(output, 'package.json'), 'utf8'));
pkg.scripts = { start: 'node scripts/serve-artifact.mjs' };
await writeFile(resolve(output, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
await writeFile(
    resolve(output, 'release.json'),
    JSON.stringify({ commit: await capture('git', ['rev-parse', 'HEAD'], { cwd: root }), dirty: Boolean(await capture('git', ['status', '--porcelain'], { cwd: root })), node: process.version }, null, 2) + '\n'
);
console.log('Release prepared in dist/release. Install with npm ci --omit=dev; start with npm start.');
