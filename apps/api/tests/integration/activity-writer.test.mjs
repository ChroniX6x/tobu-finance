import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fork, spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID, generateKeyPairSync, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { MongoClient, ObjectId, UUID } from 'mongodb';
import jwt from 'jsonwebtoken';
import { ActivityWriteEventSchema } from '@tobu/contracts/activity';
import { mongoReplyProxy } from '../fixtures/mongo-reply-proxy.mjs';
import { temporaryDatabase } from '../../../../scripts/lib/docker.mjs';

test('E04/EIT-09–13/31 real HTTP JWT domain/activity transaction', { timeout: 180000 }, async (t) => {
    assert.ok(process.env.TEST_MONGODB_URI, 'Use the integration runner with real Docker prerequisites');
    // configureFailPoint is server-global even with appName filtering. Own the server as well as the DB,
    // so parallel integration files cannot replace this suite's failCommand configuration (or vice versa).
    const isolated = await temporaryDatabase();
    let closeResources = async () => {};
    t.after(async () => {
        try {
            await closeResources();
        } finally {
            await isolated.stop();
        }
    });
    const url = new URL(isolated.uri);
    assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
    url.pathname = `/tobu_test_e04_${randomUUID().replaceAll('-', '')}`;
    const apiName = `e04-${randomUUID()}`;
    const directUri = url.toString();
    const client = await new MongoClient(directUri).connect();
    closeResources = () => client.close();
    const proxy = await mongoReplyProxy(url);
    closeResources = async () => {
        try {
            await proxy.close();
        } finally {
            await client.close();
        }
    };
    url.port = String(proxy.port);
    url.searchParams.set('appName', apiName);
    const env = { ...process.env, NODE_ENV: 'test', MONGODB_URI: url.toString(), TEST_MONGODB_URI: url.toString(), TEST_FIXTURE_ID: randomUUID() };
    for (const kind of ['ACCESS', 'REFRESH']) {
        const keys = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
        env[`JWT_${kind}_PRIVATE_KEY_PEM`] = keys.privateKey;
        env[`JWT_${kind}_PUBLIC_KEY_PEM`] = keys.publicKey;
    }
    const db = client.db();
    let child,
        base,
        info,
        token,
        output = '';
    const wire = [];
    const stop = async () => {
        if (child && child.exitCode === null && child.signalCode === null) {
            const exited = once(child, 'exit');
            child.kill('SIGKILL');
            await exited;
        }
    };
    const off = () => client.db('admin').command({ configureFailPoint: 'failCommand', mode: 'off' });
    closeResources = async () => {
        await stop();
        try {
            await off();
            await db.dropDatabase();
        } finally {
            try {
                await proxy.close();
            } finally {
                await client.close();
            }
        }
    };
    // Database Tools identify the real container port; the fault proxy is only for the domain writer.
    const init = spawn(process.execPath, [resolve('dist/src/database/cli.js'), 'init'], { env: { ...env, MONGODB_URI: directUri }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    init.stdout.on('data', (data) => (output += data));
    init.stderr.on('data', (data) => (output += data));
    assert.equal((await once(init, 'exit'))[0], 0, output);
    const start = async () => {
        child = fork(resolve('tests/fixtures/activity-writer-server.mjs'), [], { env, windowsHide: true, silent: true });
        child.stdout.on('data', (data) => (output += data));
        child.stderr.on('data', (data) => (output += data));
        child.on('message', (msg) => {
            if (msg.command) wire.push(msg);
        });
        info = await new Promise((resolveReady, reject) => {
            child.on('message', (msg) => {
                if (msg.port) resolveReady(msg);
            });
            child.once('exit', () => reject(new Error(output)));
        });
        base = `http://127.0.0.1:${info.port}`;
        token = jwt.sign({ sub: info.userId, type: 'access' }, env.JWT_ACCESS_PRIVATE_KEY_PEM, { algorithm: 'RS256', expiresIn: '5m' });
    };
    await start();
    const request = async (name, body = {}, auth = token) => {
        const response = await fetch(`${base}/command/${name}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(40000)
        });
        const text = await response.text();
        return { status: response.status, body: response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
    };
    const snapshot = async () => ({ transactions: await db.collection('transactions').find().sort({ _id: 1 }).toArray(), events: await db.collection('events').find().sort({ _id: 1 }).toArray() });
    const oid = (name) => new ObjectId(createHash('sha256').update(`${env.TEST_FIXTURE_ID}:${name}`).digest('hex').slice(0, 24));
    const assertState = async (name, count) => {
        const parent = await db.collection('transactions').findOne({ _id: oid(`${name}:parent`) });
        const kids = await db
            .collection('transactions')
            .find({ parentTransactionId: oid(`${name}:parent`) })
            .toArray();
        const events = await db
            .collection('events')
            .find({ 'subject.id': oid(`${name}:parent`).toHexString() })
            .toArray();
        assert.equal(parent ? 1 : 0, count);
        assert.equal(kids.length, count);
        assert.equal(events.length, count);
        if (count) {
            assert.equal(parent.amountMinor, 1000);
            assert.equal(kids[0].amountMinor, 333);
            assert.equal(String(parent.paidByMemberId), info.payerId);
            assert.equal(String(parent.accountId), info.accountId);
            assert.equal(kids[0].month.toISOString(), parent.month.toISOString());
            const e = events[0];
            const raw = Object.fromEntries(Object.entries(e).filter(([key]) => !['_id', 'createdAt', 'updatedAt', '__v'].includes(key)));
            ActivityWriteEventSchema.parse({ ...raw, accountId: String(raw.accountId) });
            assert.equal(e.actor.userId, info.userId);
            assert.equal(e.trigger.kind, 'user_action');
            assert.equal(e.createdByMemberId, null);
            assert.ok(e.commandId && e.correlationId && e.date instanceof Date);
        }
    };
    const fail = (commands, skip = 0, extra = {}) => client.db('admin').command({ configureFailPoint: 'failCommand', mode: skip ? { skip } : { times: 1 }, data: { failCommands: commands, appName: apiName, errorCode: 8, ...extra } });

    await t.test('EIT-09 stable UTC/keys, real parent child and one event share session; replay does not write', async () => {
        const beforeWire = wire.length;
        assert.equal((await request('success', { title: '😀'.repeat(180) })).status, 201);
        await assertState('success', 1);
        const before = await snapshot();
        assert.equal(Array.from(before.events[0].params.title).length, 60);
        assert.equal(before.events[0].params.title.length, 120);
        assert.equal((await request('success', { title: '😀'.repeat(180) })).body.outcome, 'replayed');
        assert.deepEqual(await snapshot(), before);
        const writes = wire.slice(beforeWire).filter((e) => e.command === 'insert');
        assert.deepEqual(
            writes.map((e) => e.collection),
            ['transactions', 'transactions', 'events']
        );
        assert.equal(new Set(writes.map((e) => `${e.lsid}/${e.transaction}`)).size, 1);
        const externalMark = wire.length;
        assert.equal((await request('existing-session', { existingSession: true })).status, 201);
        await assertState('existing-session', 1);
        const externalWrites = wire.slice(externalMark).filter((entry) => entry.command === 'insert');
        assert.deepEqual(
            externalWrites.map((entry) => entry.collection),
            ['transactions', 'transactions', 'events']
        );
        assert.equal(new Set(externalWrites.map((entry) => `${entry.lsid}/${entry.transaction}`)).size, 1);
    });
    await t.test('EIT-10 real failpoints before domain, between parent/child, event insert, before commit; exact readback', async () => {
        for (const [name, commands, skip] of [
            ['before-domain', ['insert'], 0],
            ['after-parent', ['insert'], 1],
            ['event-insert', ['insert'], 2],
            ['before-commit', ['commitTransaction'], 0]
        ]) {
            const before = await snapshot();
            try {
                await fail(commands, skip);
                assert.equal((await request(name)).status, 500, name);
            } finally {
                await off();
            }
            assert.deepEqual(await snapshot(), before, name);
            await assertState(name, 0);
        }
        const before = await snapshot();
        assert.equal((await request('after-domain', { failAfterDomain: true })).status, 500);
        assert.deepEqual(await snapshot(), before);
    });
    await t.test('EIT-11/08/32 invalid 409/422, unknown code/params, foreign scope, forged capability, unauth: zero writes', async () => {
        for (const [body, status, error] of [
            [{ invalid: 409 }, 409, 'TEST_FAILURE'],
            [{ invalid: 422 }, 422, 'TEST_FAILURE'],
            [{ code: 'unknown.code' }, 422, 'TEST_FAILURE'],
            [{ extraParams: { notes: 'secret' } }, 422, 'TEST_FAILURE'],
            [{ extraParams: { categoryId: oid('foreign-subject').toHexString() } }, 500, 'ACTIVITY_REFERENCE_NOT_IN_ACCOUNT'],
            [{ foreignSubject: true }, 500, 'ACTIVITY_SUBJECT_NOT_IN_ACCOUNT'],
            [{ foreignAccount: true }, 404, null],
            [{ forged: true }, 500, 'ACTIVITY_UNTRUSTED_AUTHORITY'],
            [{ forgedCommand: true }, 500, 'ACTIVITY_UNTRUSTED_COMMAND']
        ]) {
            const before = await snapshot();
            const result = await request(`invalid-${randomUUID()}`, body);
            assert.equal(result.status, status, JSON.stringify(result));
            if (error) assert.equal(result.body.error, error);
            assert.deepEqual(await snapshot(), before);
        }
        const before = await snapshot();
        assert.equal((await request('unauth', {}, '')).status, 401);
        assert.deepEqual(await snapshot(), before);
    });
    await t.test('EIT-09/12 transient transaction retry preserves one parent/child/event', async () => {
        try {
            await fail(['insert'], 0, { errorCode: 112, errorLabels: ['TransientTransactionError'] });
            assert.equal((await request('transient-retry')).status, 201);
        } finally {
            await off();
        }
        await assertState('transient-retry', 1);
    });
    await t.test('EIT-13 no-op and GET/preview: identical domain/event BSON', async () => {
        const before = await snapshot();
        assert.equal((await request('noop', { noop: true })).body.outcome, 'noop');
        assert.equal((await fetch(`${base}/read`, { headers: { authorization: `Bearer ${token}` } })).status, 200);
        assert.equal((await fetch(`${base}/preview`, { headers: { authorization: `Bearer ${token}` } })).status, 200);
        const equal = await fetch(`${base}/equal/success`, { method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Domain' }) });
        assert.equal(equal.status, 200);
        assert.equal((await equal.json()).outcome, 'noop');
        assert.deepEqual(await snapshot(), before);
    });
    await t.test('EIT-12 eight parallel HTTP clients, stable retry, changed-payload conflict and legitimate fanout', async () => {
        const results = await Promise.all(Array.from({ length: 8 }, () => request('parallel')));
        assert.equal(results.filter((r) => r.status === 201).length, 1);
        assert.equal(results.filter((r) => r.status === 200 && r.body.outcome === 'replayed').length, 7);
        await assertState('parallel', 1);
        const before = await snapshot();
        assert.equal((await request('parallel', { amount: 1001 })).body.error, 'ACTIVITY_COMMAND_CONFLICT');
        assert.deepEqual(await snapshot(), before);
        assert.equal((await request('fanout', { fanout: true })).status, 201);
        const rows = await db
            .collection('events')
            .find({ 'subject.id': { $in: [oid('fanout:parent').toHexString(), oid('fanout:child').toHexString()] } })
            .toArray();
        assert.equal(rows.length, 2);
        assert.equal(rows[0].commandId, rows[1].commandId);
        assert.equal(rows[0].correlationId, rows[1].correlationId);
        assert.equal(rows[0].date.getTime(), rows[1].date.getTime());
        assert.equal((await request('fanout', { fanout: true })).body.outcome, 'replayed');
        assert.equal((await request('fanout')).body.error, 'ACTIVITY_COMMAND_CONFLICT');
    });
    await t.test('EIT-12/31 HTTP LostReply then new process: stable readback without extra mutation', async () => {
        await assert.rejects(request('lost-http', { lostReply: true }));
        await assertState('lost-http', 1);
        const before = await snapshot();
        await stop();
        await start();
        assert.equal((await request('lost-http')).body.outcome, 'replayed');
        assert.deepEqual(await snapshot(), before);
    });
    await t.test('EIT-31 kill before and after commit; restart and concurrent retry; no partial parent/child/event', async () => {
        for (const [name, flag, checkpoint] of [
            ['kill-before', 'pauseBeforeCommit', 'before-commit'],
            ['kill-after', 'pauseAfterCommit', 'after-commit']
        ]) {
            const reached = new Promise((done) =>
                child.on('message', (msg) => {
                    if (msg.checkpoint === checkpoint) done();
                })
            );
            const pending = request(name, { [flag]: true }).catch(() => null);
            await reached;
            await stop();
            await pending;
            await assertState(name, flag === 'pauseBeforeCommit' ? 0 : 1);
            if (flag === 'pauseBeforeCommit') {
                // Process death does not immediately expire server transactions. Drain ONLY the stopped
                // test process's session, then restart; never change the shared server lifetime or global limits.
                const lastSession = wire.filter((event) => event.command === 'insert').at(-1).lsid;
                await client.db('admin').command({ killSessions: [{ id: new UUID(lastSession) }] });
            }
            await start();
            const results = await Promise.all([request(name), request(name)]);
            assert.ok(results.every((r) => [200, 201].includes(r.status)));
            assert.equal(results.filter((r) => r.status === 201).length, flag === 'pauseBeforeCommit' ? 1 : 0);
            await assertState(name, 1);
        }
    });
    await t.test('EIT-31 real commit-unknown: server executes commit but returns writeConcernError; exact readback', async () => {
        try {
            await client.db('admin').command({
                configureFailPoint: 'failCommand',
                mode: 'alwaysOn',
                data: { failCommands: ['commitTransaction'], appName: apiName, writeConcernError: { code: 64, errmsg: 'E04 commit reply unavailable' }, errorLabels: ['UnknownTransactionCommitResult'] }
            });
            const result = await request('unknown-commit');
            assert.equal(result.status, 200, JSON.stringify(result));
            assert.equal(result.body.outcome, 'replayed');
        } finally {
            await off();
        }
        await assertState('unknown-commit', 1);
        const before = await snapshot();
        await stop();
        await start();
        assert.equal((await request('unknown-commit')).body.outcome, 'replayed');
        assert.deepEqual(await snapshot(), before);
    });
    await t.test('EIT-31 successful COMMIT response lost on real TCP wire: no callback replay or duplicate; restart readback', async () => {
        const mark = wire.length;
        proxy.arm();
        const result = await request('lost-commit-wire');
        assert.equal(result.status, 201, JSON.stringify(result));
        assert.equal(proxy.dropped(), 1, 'proxy received ok:1 from Mongo before destroying the socket');
        assert.equal(wire.slice(mark).filter((entry) => entry.command === 'insert').length, 3, 'domain callback was not replayed');
        await assertState('lost-commit-wire', 1);
        const before = await snapshot();
        await stop();
        await start();
        assert.equal((await request('lost-commit-wire')).body.outcome, 'replayed');
        assert.deepEqual(await snapshot(), before);
    });
    await t.test('EIT-31 unknown commit without receipt is not reported as success or blindly replayed', async () => {
        const before = await snapshot();
        try {
            await fail(['commitTransaction'], 0, { errorCode: 50, errorLabels: ['UnknownTransactionCommitResult'] });
            const result = await request('unknown-absent');
            assert.equal(result.status, 500);
            assert.equal(result.body.error, 'ACTIVITY_COMMIT_UNKNOWN_READBACK_REQUIRED');
        } finally {
            await off();
        }
        assert.deepEqual(await snapshot(), before);
        await assertState('unknown-absent', 0);
        const lastSession = wire.filter((event) => event.command === 'insert').at(-1).lsid;
        await stop();
        await client.db('admin').command({ killSessions: [{ id: new UUID(lastSession) }] });
        await start();
        assert.equal((await request('unknown-absent')).status, 201);
        await assertState('unknown-absent', 1);
    });
    await t.test('EIT-06 system context remains system with internal trigger and separate initiator', async () => {
        assert.equal((await request('system', { system: true })).status, 201);
        const event = await db.collection('events').findOne({ 'subject.id': oid('system:parent').toHexString() });
        assert.deepEqual(event.actor, { kind: 'system' });
        assert.deepEqual(event.trigger, { kind: 'automation', initiatedByUserId: info.userId });
    });
});
