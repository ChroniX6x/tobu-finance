import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork, spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID, generateKeyPairSync, createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient, ObjectId, BSON } from 'mongodb';
import jwt from 'jsonwebtoken';
import { ActivityWriteEventSchema, ActivityPageSchema, RECURRENCE_ACTIVITY_CODES } from '@tobu/contracts/activity';
import { mongoReplyProxy } from '../fixtures/mongo-reply-proxy.mjs';
import { temporaryDatabase } from '../../../../scripts/lib/docker.mjs';

test('E07 PLATFORM EIT25–30: generic Mongo mutations and real JWT/HTTP emit adapter; NOT recurrence domain execution', { timeout: 300000 }, async (t) => {
    const isolated = await temporaryDatabase();
    let release = async () => {};
    t.after(async () => {
        try {
            await release();
        } finally {
            await isolated.stop();
        }
    });
    const url = new URL(isolated.uri);
    url.pathname = `/tobu_test_e07_${randomUUID().replaceAll('-', '')}`;
    const client = await new MongoClient(url.toString()).connect();
    const db = client.db();
    const scratch = await mkdtemp(join(tmpdir(), 'tobu-e07-platform-'));
    const proxy = await mongoReplyProxy(url);
    const direct = url.toString();
    url.port = String(proxy.port);
    url.searchParams.set('appName', 'e07-platform');
    const env = { ...process.env, NODE_ENV: 'test', MONGODB_URI: url.toString(), TEST_MONGODB_URI: url.toString(), TEST_FIXTURE_ID: randomUUID(), TOBU_MIGRATION_BACKUP_DIR: join(scratch, 'backups'), TOBU_MIGRATION_BACKUP_MODE: 'docker-local' };
    for (const kind of ['ACCESS', 'REFRESH']) {
        const pair = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
        env[`JWT_${kind}_PRIVATE_KEY_PEM`] = pair.privateKey;
        env[`JWT_${kind}_PUBLIC_KEY_PEM`] = pair.publicKey;
    }
    let child,
        base,
        info,
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
    release = async () => {
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
        assert.equal(dirname(resolve(scratch)), resolve(tmpdir()));
        await rm(scratch, { recursive: true, force: true });
    };
    const apiRoot = fileURLToPath(new URL('../../', import.meta.url));
    const init = spawn(process.execPath, [join(apiRoot, 'dist/src/database/cli.js'), 'init'], { cwd: scratch, env: { ...env, MONGODB_URI: direct }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    init.stdout.on('data', (d) => (output += d));
    init.stderr.on('data', (d) => (output += d));
    assert.equal((await once(init, 'exit'))[0], 0, output);
    const start = async () => {
        child = fork(new URL('../fixtures/recurrence-activity-server.mjs', import.meta.url), [], { env, windowsHide: true, silent: true });
        child.stdout.on('data', (d) => (output += d));
        child.stderr.on('data', (d) => (output += d));
        child.on('message', (message) => {
            if (message.command) wire.push(message);
        });
        info = await new Promise((ready, reject) => {
            child.on('message', (message) => {
                if (message.port) ready(message);
            });
            child.once('exit', () => reject(new Error(output)));
        });
        base = `http://127.0.0.1:${info.port}`;
    };
    await start();
    const token = (who) => jwt.sign({ sub: info[who + 'Id'], type: 'access' }, env.JWT_ACCESS_PRIVATE_KEY_PEM, { algorithm: 'RS256', expiresIn: '10m' });
    const id = (name) => createHash('sha256').update(`${env.TEST_FIXTURE_ID}:${name}`).digest('hex').slice(0, 24);
    const oid = (name) => new ObjectId(id(name));
    const ids = (name) => ({ ...Object.fromEntries(['recurrence', 'revision', 'previousRevision', 'occurrence', 'previousRecurrence', 'previousOccurrence'].map((key) => [key, id(name + ':' + key)])), transaction: id('transaction') });
    const generic = db.collection('e07_generic_domain');
    const seed = async (name, code) => {
        const i = ids(name),
            accountId = new ObjectId(info.accountId),
            recurrenceId = new ObjectId(i.recurrence);
        if (code === 'recurrence.created') return;
        const docs = [
            { _id: recurrenceId, kind: 'recurrence', accountId, value: 0 },
            { _id: new ObjectId(i.previousRevision), kind: 'revision', accountId, recurrenceId }
        ];
        if (code !== 'recurrence.config.updated') docs.push({ _id: new ObjectId(i.revision), kind: 'revision', accountId, recurrenceId });
        if (['occurrence.unskipped', 'occurrence.unlinked'].includes(code))
            docs.push({ _id: new ObjectId(i.occurrence), kind: 'occurrence', accountId, recurrenceId, occurrenceKey: '2026-11', transactionId: code === 'occurrence.unlinked' ? oid('transaction') : null, value: 0 });
        if (code === 'occurrence.reassigned')
            docs.push(
                { _id: new ObjectId(i.previousRecurrence), kind: 'recurrence', accountId, value: 0 },
                { _id: new ObjectId(i.previousOccurrence), kind: 'occurrence', accountId, recurrenceId: new ObjectId(i.previousRecurrence), occurrenceKey: '2026-10', transactionId: oid('transaction'), value: 0 }
            );
        await generic.insertMany(docs);
    };
    const request = async (name, code, flags = {}, who = 'owner') => {
        const response = await fetch(`${base}/platform/${name}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(who ? { authorization: 'Bearer ' + token(who) } : {}) },
            body: JSON.stringify({ code, ...flags }),
            signal: AbortSignal.timeout(40000)
        });
        const text = await response.text();
        return { status: response.status, body: response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
    };
    const snapshot = async () =>
        Object.fromEntries(
            await Promise.all(
                ['users', 'members', 'accounts', 'transactions', 'events', 'e07_generic_domain'].map(async (name) => [name, (await db.collection(name).find().sort({ _id: 1 }).toArray()).map((row) => BSON.serialize(row).toString('hex'))])
            )
        );
    const finance = async () => (await db.collection('transactions').find().sort({ _id: 1 }).toArray()).map((row) => BSON.serialize(row).toString('hex'));
    const originalFinance = await finance();
    const count = () => db.collection('events').countDocuments();
    await t.test('EIT25–28 PLATFORM: all twelve codes have exact commits, actor/subject/relations and finance invariance', async () => {
        for (const [n, code] of RECURRENCE_ACTIVITY_CODES.entries()) {
            const name = `matrix-${n}`;
            await seed(name, code);
            const before = await count();
            const revisions = await generic.find({ kind: 'revision' }).sort({ _id: 1 }).toArray();
            const result = await request(name, code, { existingSession: n % 2 === 0, upperIds: n % 2 === 1 });
            assert.equal(result.status, 201, `${code}: ${JSON.stringify(result.body)} ${output.slice(-1200)}`);
            assert.equal(result.body.outcome, 'applied');
            assert.equal(await count(), before + 1, code + ' exactly one event');
            const stored = await db.collection('events').findOne({ _id: new ObjectId(result.body.eventIds[0]) });
            const raw = Object.fromEntries(Object.entries(stored).filter(([key]) => !['_id', 'createdAt', 'updatedAt', '__v'].includes(key)));
            ActivityWriteEventSchema.parse({ ...raw, accountId: String(raw.accountId) });
            assert.equal(stored.actor.userId, info.ownerId);
            assert.equal(stored.createdByMemberId, null);
            assert.equal(stored.trigger.kind, 'user_action');
            assert.equal(stored.code, code);
            assert.equal(stored.subject.kind, code.startsWith('recurrence.') ? 'recurrence' : 'occurrence');
            if (['recurrence.activated', 'recurrence.deactivated'].includes(code)) {
                assert.deepEqual(await generic.find({ kind: 'revision' }).sort({ _id: 1 }).toArray(), revisions, 'no generic revision write by lifecycle');
                assert.equal('revisionId' in stored.params, false);
            }
            const beforeReplay = await snapshot();
            const replay = await request(name, code);
            assert.equal(replay.status, 200);
            assert.equal(replay.body.outcome, 'replayed');
            assert.deepEqual(await snapshot(), beforeReplay, 'retry preserves dates, correlations and every BSON value');
            assert.deepEqual(await finance(), originalFinance);
        }
        assert.equal(await db.collection('transactions').countDocuments(), 4, 'generic probes created no real pending/recurrence transactions');
        assert.equal(
            (await db.collection('transactions').find({ parentTransactionId: null }).toArray()).reduce((sum, row) => sum + row.amountMinor, 0),
            77777
        );
    });
    await t.test('EIT27 PLATFORM: real system capability, trusted batch, same-session wire evidence; no release duplication', async () => {
        for (const name of ['system-a', 'system-b']) {
            await seed(name, 'occurrence.generated');
            const result = await request(name, 'occurrence.generated', { system: true, batch: true });
            assert.equal(result.status, 201, JSON.stringify(result.body));
        }
        const rows = await db.collection('events').find({ 'actor.kind': 'system' }).toArray();
        assert.equal(rows.length, 2);
        assert.equal(new Set(rows.map((row) => row.batchId)).size, 1);
        assert.equal(new Set(rows.map((row) => row.commandId)).size, 2);
        for (const row of rows) {
            assert.deepEqual(row.actor, { kind: 'system' });
            assert.deepEqual(row.trigger, { kind: 'account_open', initiatedByUserId: info.ownerId });
        }
        const name = 'session-wire';
        await seed(name, 'recurrence.activated');
        const startWire = wire.length;
        assert.equal((await request(name, 'recurrence.activated', { existingSession: true })).status, 201);
        const writes = wire.slice(startWire).filter((message) => ['insert', 'update', 'delete'].includes(message.command));
        assert.ok(writes.some((message) => message.collection === 'e07_generic_domain'));
        assert.ok(writes.some((message) => message.collection === 'events'));
        assert.equal(new Set(writes.map((message) => message.lsid + ':' + message.transaction)).size, 1, 'domain, authority fences and event share the actual driver session');
        const releaseName = 'release';
        await seed(releaseName, 'occurrence.unskipped');
        const before = await count();
        assert.equal((await request(releaseName, 'occurrence.unskipped')).status, 201);
        assert.equal(await count(), before + 1);
        assert.equal(await db.collection('events').countDocuments({ commandId: createHash('sha256').update(`e07:${info.accountId}:${releaseName}:occurrence.unskipped:v1`).digest('hex'), code: 'occurrence.generated' }), 0);
        const fanout = 'unlink-and-generate';
        await seed(fanout, 'occurrence.unlinked');
        const countBefore = await count();
        const result = await request(fanout, 'occurrence.unlinked', { params: { choice: 'generate' }, unlinkAndGenerate: true });
        assert.equal(result.status, 201, JSON.stringify(result.body));
        assert.equal(result.body.eventIds.length, 2);
        assert.equal(await count(), countBefore + 2);
        const events = await db
            .collection('events')
            .find({ _id: { $in: result.body.eventIds.map((value) => new ObjectId(value)) } })
            .toArray();
        assert.deepEqual(events.map((row) => row.code).sort(), ['occurrence.generated', 'occurrence.unlinked']);
        assert.equal(new Set(events.map((row) => row.correlationId)).size, 1);
        assert.equal(String((await generic.findOne({ _id: oid(fanout + ':occurrence') })).transactionId), id('new-transaction'));
        assert.deepEqual(await finance(), originalFinance);
    });
    await t.test('EIT25–28 PLATFORM real registered member positives and all eleven user-only system negatives', async () => {
        for (const [n, code] of RECURRENCE_ACTIVITY_CODES.entries()) {
            if (!['recurrence.deleted', 'recurrence.revision.discarded'].includes(code)) {
                const name = 'member-positive-' + n;
                await seed(name, code);
                const before = await count();
                const result = await request(name, code, {}, 'member');
                assert.equal(result.status, 201, code + ': ' + JSON.stringify(result.body));
                assert.equal(await count(), before + 1);
                assert.equal((await db.collection('events').findOne({ _id: new ObjectId(result.body.eventIds[0]) })).actor.userId, info.memberId);
            }
            if (code !== 'occurrence.generated') {
                const name = 'system-negative-' + n;
                await seed(name, code);
                const before = await snapshot();
                assert.equal((await request(name, code, { system: true })).status, 422, code);
                assert.deepEqual(await snapshot(), before);
            }
        }
    });
    await t.test('EIT25/26/28/30 PLATFORM: owner/actor/foreign relation/forged port/session/no-op/reject failures are write-free', async () => {
        const name = 'negatives';
        await seed(name, 'recurrence.activated');
        for (const [flags, who, status] of [
            [{}, null, 401],
            [{}, 'outsider', 404],
            [{ forgedActor: true }, 'owner', 403],
            [{ missingScope: true }, 'owner', 422],
            [{ forgedScope: true }, 'owner', 422],
            [{ copiedWitness: true }, 'owner', 422],
            [{ cachedWitness: true }, 'owner', 422],
            [{ reuseSession: true }, 'owner', 422],
            [{ forgedBatch: true }, 'owner', 422],
            [{ system: true }, 'owner', 422],
            [{ scopeThrows: true }, 'owner', 500],
            [{ scopeThrowsAfterMutation: true }, 'owner', 500],
            [{ reject: true }, 'owner', 409],
            [{ noop: true }, 'owner', 200],
            [{ afterWriteFault: true }, 'owner', 500]
        ]) {
            const before = await snapshot();
            const result = await request(name, 'recurrence.activated', flags, who);
            assert.equal(result.status, status, `${JSON.stringify(flags)}: ${JSON.stringify(result.body)}`);
            assert.deepEqual(await snapshot(), before);
        }
        for (const code of ['recurrence.deleted', 'recurrence.revision.discarded']) {
            const n = 'owner-' + code;
            await seed(n, code);
            const before = await snapshot();
            assert.equal((await request(n, code, {}, 'member')).status, 403);
            assert.deepEqual(await snapshot(), before);
        }
        const wrongWitnessBefore = await snapshot();
        assert.equal((await request(name, 'recurrence.activated', { wrongTenantWitness: true })).status, 422);
        assert.deepEqual(await snapshot(), wrongWitnessBefore, 'even a genuine lookup proof cannot attest another tenant');
        const foreignId = new ObjectId();
        await generic.insertOne({ _id: foreignId, kind: 'recurrence', accountId: new ObjectId(info.foreignAccountId) });
        const beforeForeign = await snapshot();
        assert.equal((await request(name, 'recurrence.activated', { subject: { kind: 'recurrence', id: String(foreignId) }, params: { recurrenceId: String(foreignId) } })).status, 422);
        assert.deepEqual(await snapshot(), beforeForeign);
        for (const [label, code, params] of [
            ['foreign-parent', 'occurrence.linked', { transactionId: id('foreign-transaction') }],
            ['child-parent', 'occurrence.linked', { transactionId: id('child-transaction') }],
            ['bad-month', 'occurrence.linked', { occurrenceKey: '2026-12' }],
            ['wrong-revision', 'occurrence.generated', { revisionId: id('matrix-1:previousRevision') }],
            ['wrong-source-key', 'occurrence.reassigned', { previousOccurrenceKey: '2026-09' }],
            ['foreign-source', 'occurrence.reassigned', { previousRecurrenceId: String(foreignId) }]
        ]) {
            await seed(label, code);
            const before = await snapshot();
            const result = await request(label, code, { params });
            assert.equal(result.status, 422, label + ': ' + JSON.stringify(result.body));
            assert.deepEqual(await snapshot(), before);
        }
        const release = 'bad-release';
        await seed(release, 'occurrence.unskipped');
        const prior = await snapshot();
        assert.equal((await request(release, 'occurrence.unskipped', { releaseAndGenerate: true })).status, 422);
        assert.deepEqual(await snapshot(), prior);
    });
    await t.test('EIT29/30 PLATFORM: retained events and atomic minimal delete, generic block and real event-insert failpoint', async () => {
        const name = 'retained';
        assert.equal((await request(name, 'recurrence.created')).status, 201);
        assert.equal((await request(name, 'recurrence.activated')).status, 201);
        const historical = await db
            .collection('events')
            .find({ 'subject.id': id(name + ':recurrence') })
            .sort({ _id: 1 })
            .toArray();
        let before = await snapshot();
        assert.equal((await request(name, 'recurrence.deleted', { reject: true })).status, 409);
        assert.deepEqual(await snapshot(), before);
        before = await snapshot();
        await client.db('admin').command({ configureFailPoint: 'failCommand', mode: { times: 1 }, data: { failCommands: ['insert'], errorCode: 121, appName: 'e07-platform' } });
        try {
            assert.equal((await request(name, 'recurrence.deleted')).status, 500);
        } finally {
            await off();
        }
        assert.deepEqual(await snapshot(), before, 'actual Event insert failure rolls back the generic delete and authority revisions');
        const result = await request(name, 'recurrence.deleted');
        assert.equal(result.status, 201);
        assert.equal(await generic.countDocuments({ _id: oid(name + ':recurrence') }), 0);
        const rows = await db
            .collection('events')
            .find({ 'subject.id': id(name + ':recurrence') })
            .sort({ _id: 1 })
            .toArray();
        const deleted = rows.filter((row) => row.code === 'recurrence.deleted');
        assert.equal(deleted.length, 1);
        assert.deepEqual(deleted[0].params, { recurrenceId: id(name + ':recurrence') });
        assert.deepEqual(
            rows.filter((row) => row.code !== 'recurrence.deleted').map((row) => BSON.serialize(row)),
            historical.map((row) => BSON.serialize(row))
        );
        assert.equal(rows.length, historical.length + 1);
        before = await snapshot();
        assert.equal((await request(name, 'recurrence.deleted')).body.outcome, 'replayed');
        assert.deepEqual(await snapshot(), before);
    });
    await t.test('EIT27/29 PLATFORM: parallel duplicate commands, actual lost HTTP reply/restart and lost Mongo commit reply', async () => {
        const name = 'parallel';
        await seed(name, 'recurrence.activated');
        const before = await count();
        const parallel = await Promise.all(Array.from({ length: 4 }, () => request(name, 'recurrence.activated')));
        assert.equal(parallel.filter((result) => result.body.outcome === 'applied').length, 1);
        assert.ok(parallel.every((result) => [200, 201].includes(result.status)));
        assert.equal(await count(), before + 1);
        assert.equal((await generic.findOne({ _id: oid(name + ':recurrence') })).value, 1, 'one effective domain mutation under parallel replay');
        const lost = 'lost-delete';
        await seed(lost, 'recurrence.deleted');
        await assert.rejects(request(lost, 'recurrence.deleted', { lostReply: true }));
        const committed = await snapshot();
        await stop();
        await start();
        assert.equal((await request(lost, 'recurrence.deleted')).body.outcome, 'replayed');
        assert.deepEqual(await snapshot(), committed, 'no resurrected generic subject or new delete event');
        const unknown = 'unknown-delete';
        await seed(unknown, 'recurrence.deleted');
        const countBefore = await count();
        proxy.arm();
        const result = await request(unknown, 'recurrence.deleted');
        assert.ok([200, 201].includes(result.status), JSON.stringify(result.body));
        assert.equal(proxy.dropped(), 1, 'proxy lost a genuinely successful commit response');
        assert.equal(await count(), countBefore + 1);
        assert.equal(await generic.countDocuments({ _id: oid(unknown + ':recurrence') }), 0);
        const exact = await snapshot();
        assert.equal((await request(unknown, 'recurrence.deleted')).body.outcome, 'replayed');
        assert.deepEqual(await snapshot(), exact);
    });
    await t.test('E07 PLATFORM read remains authorized/minimal/link-free and never aliases live legacy subjects', async () => {
        const before = await snapshot();
        const response = await fetch(base + '/read?limit=100', { headers: { authorization: 'Bearer ' + token('owner') } });
        assert.equal(response.status, 200);
        const page = ActivityPageSchema.parse(await response.json());
        assert.ok(page.items.length >= 12);
        for (const item of page.items) {
            assert.equal(item.params, null);
            assert.equal(item.subject, null);
            assert.equal(item.detailsUnavailable, true);
        }
        const system = page.items.filter((item) => item.actor.kind === 'system');
        assert.equal(system.length, 2);
        assert.equal(system[0].group.key, system[1].group.key);
        assert.equal((await fetch(base + '/read', { headers: { authorization: 'Bearer ' + token('outsider') } })).status, 404);
        assert.equal((await fetch(base + '/read')).status, 401);
        assert.equal((await fetch(base + '/preview', { headers: { authorization: 'Bearer ' + token('owner') } })).status, 200);
        assert.deepEqual(await snapshot(), before);
        assert.deepEqual(await finance(), originalFinance);
    });
});
