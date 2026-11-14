import { temporaryDatabase } from '../../../../scripts/lib/docker.mjs';
import { creationFetch } from './creation-fetch.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { MongoClient } from 'mongodb';

const root = fileURLToPath(new URL('../../', import.meta.url));
async function freePort() {
    const socket = createServer();
    socket.listen(0, '127.0.0.1');
    await once(socket, 'listening');
    const port = socket.address().port;
    await new Promise((resolve, reject) => socket.close((error) => (error ? reject(error) : resolve())));
    return port;
}
const stop = async (child) => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
};

export async function activityStack(t) {
    const isolated = await temporaryDatabase();
    let release = async () => {};
    t.after(async () => {
        try {
            await release();
        } finally {
            await isolated.stop();
        }
    });
    const endpoint = isolated.uri;
    const parsed = new URL(endpoint);
    assert.equal(parsed.protocol, 'mongodb:');
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname), 'Only local test servers are accepted');
    const dbName = `tobu_test_${randomUUID().replaceAll('-', '')}`;
    parsed.pathname = `/${dbName}`;
    const uri = parsed.toString();
    const scratch = await mkdtemp(join(resolve(tmpdir()), 'tobu-acl-test-'));
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
    let api;
    let apiOutput = '';
    release = async () => {
        try {
            await stop(api);
            await client
                .db(dbName)
                .dropDatabase()
                .catch(() => {});
        } finally {
            await client.close();
        }
        if (dirname(resolve(scratch)) !== resolve(tmpdir())) throw new Error('Unexpected scratch path');
        await rm(scratch, { recursive: true, force: true });
    };
    await client.connect();
    assert.ok((await client.db('admin').command({ hello: 1 })).setName, 'Transactions need a replica set');

    const init = spawn(process.execPath, [join(root, 'dist/src/database/cli.js'), 'init'], {
        cwd: scratch,
        env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: uri, TOBU_MIGRATION_BACKUP_DIR: join(scratch, 'backups'), TOBU_MIGRATION_BACKUP_MODE: 'docker-local' },
        windowsHide: true,
        stdio: 'inherit'
    });
    assert.equal((await once(init, 'exit'))[0], 0, 'Baseline initialization');
    const env = { ...process.env, NODE_ENV: 'test', MONGODB_URI: uri, PORT: String(await freePort()), CORS_ORIGIN: 'http://localhost:4200' };
    for (const kind of ['ACCESS', 'REFRESH']) {
        const keys = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
        env[`JWT_${kind}_PRIVATE_KEY_PEM`] = keys.privateKey;
        env[`JWT_${kind}_PUBLIC_KEY_PEM`] = keys.publicKey;
    }
    api = spawn(process.execPath, [join(root, 'dist/src/server.js')], { cwd: scratch, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    api.stdout.on('data', (data) => (apiOutput += data));
    api.stderr.on('data', (data) => (apiOutput += data));
    const base = `http://127.0.0.1:${env.PORT}`;
    for (let attempt = 0; attempt < 250; attempt++) {
        assert.equal(api.exitCode, null, `API exited: ${apiOutput}`);
        try {
            if ((await fetch(`${base}/ready`, { signal: AbortSignal.timeout(500) })).ok) break;
        } catch {
            /* wait */
        }
        await delay(200);
    }

    const call = async (token, method, path, body) => {
        const response = await creationFetch(base + path, {
            method,
            signal: AbortSignal.timeout(15000),
            headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: ['Bearer', token].join(' ') } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        const text = await response.text();
        return { status: response.status, text, json: text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : undefined };
    };
    const db = client.db(dbName);
    // Everything except authentication data: any write or event by a rejected request shows up here.
    const snapshot = async () => {
        const out = {};
        for (const { name } of await db.listCollections().toArray()) {
            if (name.startsWith('_tobu') || name === 'users' || name === 'auth_sessions' || name.startsWith('system.')) continue;
            out[name] = JSON.stringify(await db.collection(name).find({}).sort({ _id: 1 }).toArray());
        }
        out.userRevisions = JSON.stringify(
            await db
                .collection('users')
                .find({}, { projection: { _id: 1, __v: 1, isActive: 1 } })
                .sort({ _id: 1 })
                .toArray()
        );
        return out;
    };
    const register = async (name) => {
        const email = `${name}@example.test`;
        const password = `${name}-test-password`;
        const reg = await call(undefined, 'POST', '/api/auth/register', { email, password, name });
        assert.equal(reg.status, 201);
        return { token: reg.json.accessToken, userId: reg.json.user.id, email, password };
    };

    const expectCall = async (who, method, path, body, status = 200) => {
        const result = await call(who?.token, method, path, body);
        assert.equal(result.status, status, method + ' ' + path + ': ' + result.text);
        return result.json;
    };
    return { db, call, register, snapshot, expectCall };
}
