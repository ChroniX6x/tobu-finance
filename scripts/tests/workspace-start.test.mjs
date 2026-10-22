import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root } from '../lib/config.mjs';
import { capture } from '../lib/processes.mjs';

async function contractOutputs() {
    const directory = resolve(root, 'packages/contracts/dist');
    const entries = await readdir(directory, { recursive: true, withFileTypes: true });
    const result = {};
    for (const entry of entries.filter((entry) => entry.isFile())) {
        const path = resolve(entry.parentPath, entry.name);
        const metadata = await stat(path, { bigint: true });
        result[path] = metadata.mtimeNs;
    }
    assert.ok(Object.keys(result).length, 'Build contracts before running tooling tests');
    return result;
}

test('occupied dev ports are rejected without rewriting watched contracts', async () => {
    const server = createServer().listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
        const port = server.address().port;
        const spare = createServer().listen(0, '127.0.0.1');
        await once(spare, 'listening');
        const freePort = spare.address().port;
        await new Promise((resolve) => spare.close(resolve));
        for (const occupied of ['api', 'web']) {
            const before = await contractOutputs();
            await assert.rejects(
                () =>
                    capture(process.execPath, [resolve(root, 'scripts/workspace.mjs'), 'dev'], {
                        cwd: root,
                        env: {
                            ...process.env,
                            NODE_ENV: 'development',
                            DB_MODE: 'external',
                            MONGODB_URI: 'mongodb://127.0.0.1:27017/tobu_unused_port_check',
                            API_PORT: String(occupied === 'api' ? port : freePort),
                            WEB_PORT: String(occupied === 'web' ? port : freePort)
                        }
                    }),
                /occupied/
            );
            assert.deepEqual(await contractOutputs(), before, 'Rejected start must not trigger the running watchers');
        }
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
