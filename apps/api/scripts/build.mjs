import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = spawnSync(process.execPath, [resolve(root, 'scripts/migration-files.mjs'), '--check'], { stdio: 'inherit', windowsHide: true });
if (manifest.error) throw manifest.error;
if (manifest.status !== 0) process.exit(manifest.status ?? 1);
const dist = resolve(root, 'dist');
if (dirname(dist) !== resolve(root)) throw new Error('Invalid build output path');
rmSync(dist, { recursive: true, force: true });
const require = createRequire(import.meta.url);
const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', root], {
    cwd: root,
    stdio: 'inherit'
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
mkdirSync(resolve(dist, 'docs'), { recursive: true });
cpSync(resolve(root, 'docs/openapi.yaml'), resolve(dist, 'docs/openapi.yaml'));
