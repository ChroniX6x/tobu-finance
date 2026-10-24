import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, cp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { root } from '../lib/config.mjs';
import { capture } from '../lib/processes.mjs';

test('migration generator is exclusive, detects stale content and normalizes Windows line endings', async () => {
    const scratch = await mkdtemp(resolve(root, 'tmp-migration-generator-'));
    try {
        const scripts = resolve(scratch, 'scripts');
        await mkdir(scripts);
        const tool = resolve(scripts, 'migration-files.mjs');
        await cp(resolve(root, 'apps/api/scripts/migration-files.mjs'), tool);
        await capture(process.execPath, [tool, 'create', 'test-transition']);
        const directory = resolve(scratch, 'src/database/migrations');
        const files = await readdir(directory);
        assert.equal(files.length, 1);
        const file = resolve(directory, files[0]);
        const template = await readFile(file, 'utf8');
        assert.match(template, /Implement preUp/);
        assert.match(template, /Implement verifyDown/);
        await capture(process.execPath, [tool, '--check']);
        await writeFile(file, template.replaceAll('\n', '\r\n'));
        await capture(process.execPath, [tool, '--check']);
        await writeFile(file, template + '\n// Changed body\n');
        await assert.rejects(capture(process.execPath, [tool, '--check']), /Stale migration manifest/);
        await capture(process.execPath, [tool]);
        await capture(process.execPath, [tool, '--check']);
        await assert.rejects(capture(process.execPath, [tool, 'create', '../unsafe']), /lowercase migration slug/);
        await writeFile(file, template + '\nimport "mutable-runtime-helper";\n');
        await assert.rejects(capture(process.execPath, [tool]), /only import types/);
    } finally {
        assert.equal(dirname(scratch), resolve(root));
        await rm(scratch, { recursive: true, force: true });
    }
});
