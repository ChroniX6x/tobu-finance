import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { loadConfig, apiEnvironment, root, apiRoot, apiRequire } from '../lib/config.mjs';
import { capture, start, stop, assertPortFree, waitHttp } from '../lib/processes.mjs';

test('configuration chooses an explicit database, rejects invalid ports and never falls back', () => {
    const original = { ...process.env };
    try {
        Object.assign(process.env, { DB_MODE: 'docker', DEV_DB_NAME: 'tobu_finance_dev', DB_PORT: '27018', API_PORT: '4000', WEB_PORT: '4200', COMPOSE_PROJECT: 'tobu-test', MONGODB_URI: 'mongodb://localhost:27017/old_native' });
        const docker = loadConfig();
        assert.equal(docker.uri, 'mongodb://127.0.0.1:27018/tobu_finance_dev?directConnection=true&replicaSet=tobu-local');
        assert.equal(apiEnvironment(docker).MONGODB_URI, docker.uri);
        process.env.DB_MODE = 'external';
        assert.equal(loadConfig().uri, process.env.MONGODB_URI);
        process.env.MONGODB_URI = 'mongodb+srv://example.test/tobu_external?tls=true&retryWrites=true';
        assert.equal(loadConfig().uri, process.env.MONGODB_URI, 'External SRV/TLS options must not be rewritten');
        process.env.MONGODB_URI = 'mongodb://user:encoded%40password@node-a:27017,node-b:27017/tobu_external?replicaSet=production&tls=true';
        assert.equal(loadConfig().uri, process.env.MONGODB_URI, 'Multi-host URI and credentials must be preserved');
        assert.equal(loadConfig().dbName, 'tobu_external');
        const lifecycle = loadConfig({ ...process.env, DB_MODE: 'docker', DB_PORT: '54758', DEV_DB_NAME: 'tobu_test_lifecycle' });
        const lifecycleUri = new URL(lifecycle.uri);
        assert.equal(lifecycleUri.hostname, '127.0.0.1');
        assert.equal(lifecycleUri.port, '54758');
        assert.equal(lifecycleUri.pathname, '/tobu_test_lifecycle');
        assert.equal(lifecycleUri.searchParams.get('directConnection'), 'true');
        assert.equal(lifecycleUri.searchParams.get('replicaSet'), 'tobu-local');
        assert.equal(loadConfig().uri, process.env.MONGODB_URI, 'Explicit child environment must not mutate the parent configuration');
        process.env.MONGODB_URI = '';
        assert.throws(loadConfig, /explicit/);
        process.env.MONGODB_URI = 'mongodb://localhost/admin';
        assert.throws(loadConfig, /application database/);
        process.env.DB_MODE = 'docker';
        process.env.API_PORT = '4200';
        assert.throws(loadConfig, /differ/);
        process.env.API_PORT = 'invalid';
        assert.throws(loadConfig, /Invalid API_PORT/);
    } finally {
        for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
        Object.assign(process.env, original);
    }
});

test('port conflicts, early process exit and shutdown are bounded', async () => {
    const server = createServer().listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    try {
        await assert.rejects(() => assertPortFree(port), /occupied/);
    } finally {
        await new Promise((r) => server.close(r));
    }
    await assertPortFree(port);
    const child = start(process.execPath, ['-e', 'process.exit(7)'], { stdio: 'ignore' });
    await child.done;
    await assert.rejects(() => waitHttp(`http://127.0.0.1:${port}`, child, 1000), /exited/);
    const running = start(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore', detached: process.platform !== 'win32' });
    await stop(running);
    assert.ok(running.exitCode !== null || running.signalCode !== null);
});

test('environment setup preserves bytes and keys; missing public key is derived', async () => {
    const scratch = await mkdtemp(join(root, 'tmp-env-test-'));
    try {
        const script = resolve(scratch, 'scripts/ensure-env.mjs');
        await cp(resolve(apiRoot, 'scripts'), resolve(scratch, 'scripts'), { recursive: true });
        const ts = apiRequire('typescript');
        const source = await readFile(resolve(apiRoot, 'scripts/ensure-env.ts'), 'utf8');
        await writeFile(script, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
        await cp(resolve(apiRoot, '.env.example'), resolve(scratch, '.env.example'));
        await writeFile(resolve(scratch, 'package.json'), '{"type":"module"}');
        const args = [script];
        await capture(process.execPath, args);
        const path = resolve(scratch, '.env');
        const original = await readFile(path, 'utf8');
        await writeFile(path, original + '\nCUSTOM_VALUE=preserve-me\n');
        await capture(process.execPath, args);
        assert.equal(await readFile(path, 'utf8'), original + '\nCUSTOM_VALUE=preserve-me\n');
        await writeFile(path, original.replace(/^JWT_ACCESS_PUBLIC_KEY_PEM=.*$/m, 'JWT_ACCESS_PUBLIC_KEY_PEM='));
        await capture(process.execPath, args);
        assert.equal(await readFile(path, 'utf8'), original);
        await writeFile(path, original.replace(/^JWT_ACCESS_PRIVATE_KEY_PEM=.*$/m, 'JWT_ACCESS_PRIVATE_KEY_PEM='));
        await assert.rejects(() => capture(process.execPath, args), /private key is missing/);
    } finally {
        if (dirname(resolve(scratch)) !== resolve(root) || !scratch.includes('tmp-env-test-')) throw new Error('Unsafe scratch path');
        await rm(scratch, { recursive: true, force: true });
    }
});
