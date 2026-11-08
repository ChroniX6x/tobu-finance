import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import mongoose from 'mongoose';
import { MongoClient, ObjectId, BSON, Decimal128, Long } from 'mongodb';
import { ACTIVITY_CODES, ActivityWriteEventSchema, decodeStoredEvent, isRecurrenceActivityCode } from '@tobu/contracts/activity';
import Event from '../../dist/src/models/Event.js';
import { initializeBaseline } from '../../dist/src/database/baseline.js';
import { MigrationRunner } from '../../dist/src/database/migration-runner.js';
import { ToolsBackup, inventory } from '../../dist/src/database/migration-backup.js';
import { preparationEntry, before, index } from '../fixtures/e03-event-preparation.mjs';
import { MemoryBackup } from '../fixtures/structural-fixture.mjs';
import { activitySamples } from '../fixtures/activity-samples.mjs';

test('E03 catalogued event migration on isolated fresh/legacy databases', { timeout: 300000 }, async (t) => {
    assert.ok(process.env.TEST_MONGODB_URI);
    const url = new URL(process.env.TEST_MONGODB_URI);
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
    url.pathname = `/tobu_test_e03_${randomUUID().replaceAll('-', '')}`;
    const uri = url.toString();
    const client = await new MongoClient(uri).connect();
    const db = client.db();
    await mongoose.connect(uri, { autoCreate: false, autoIndex: false });
    const backupRoot = resolve(process.cwd(), '../../backups');
    await mkdir(backupRoot, { recursive: true });
    const scratch = await mkdtemp(resolve(backupRoot, 'e03-'));
    t.after(async () => {
        await db.dropDatabase();
        await mongoose.disconnect();
        await client.close();
        assert.equal(dirname(scratch), backupRoot);
        await rm(scratch, { recursive: true, force: true });
    });
    const accountId = new ObjectId(),
        userId = new ObjectId().toHexString(),
        transactionId = new ObjectId().toHexString();
    const valid = () => ({
        accountId,
        date: new Date('2026-10-31T23:59:59.999Z'),
        schemaVersion: 1,
        code: 'transaction.created',
        params: { transactionId, type: 'expense', amountMinor: 1234 },
        actor: { kind: 'user', userId },
        trigger: { kind: 'user_action' },
        subject: { kind: 'transaction', id: transactionId },
        correlationId: 'request-0001'
    });
    const execute = async (runner, direction = 'up') => runner.run(direction, (await runner.plan(direction)).confirmation, true);
    const runner = (entry, backup) => new MigrationRunner(client, db, uri, 'test', [entry], { backup });
    const reset = async () => {
        await db.dropDatabase();
        await initializeBaseline();
    };
    const documents = async () => (await db.collection('events').find().sort({ _id: 1 }).toArray()).map((doc) => BSON.serialize(doc).toString('hex'));
    const recover = async (r, action) => {
        const plan = await r.plan();
        return r.recover(plan.confirmation, plan.recovery.runId, true, action);
    };

    await t.test('real baseline readback, fresh expansion, validator negatives and stable index plan', async () => {
        await reset();
        assert.deepEqual((await db.listCollections({ name: 'events' }).next()).options.validator, before.validator);
        const entry = preparationEntry(),
            r = runner(entry, new MemoryBackup(db));
        await execute(r);
        assert.deepEqual((await db.collection('events').listIndexes().toArray()).find((item) => item.name === index.name).key, index.key);
        const event = valid();
        await new Event(event).validate();
        const forged = new Event({ ...valid(), actor: { kind: 'system' } });
        await assert.rejects(forged.validate());
        const result = await Event.create(event);
        const stored = await db.collection('events').findOne({ _id: result._id });
        assert.equal(typeof stored.actor.userId, 'string');
        assert.equal(typeof stored.subject.id, 'string');
        assert.equal(stored.date.getTime(), event.date.getTime());
        assert.equal(decodeStoredEvent(stored).item.actor.kind, 'user');
        const negatives = [
            (e) => {
                delete e.accountId;
            },
            (e) => {
                e.code = 'unapproved.code';
            },
            (e) => {
                e.params.notes = 'private';
            },
            (e) => {
                e.params.amountMinor = 1.5;
            },
            (e) => {
                e.params.amountMinor = Decimal128.fromString('1234');
            },
            (e) => {
                e.params.amountMinor = Long.fromString('9007199254740999');
            },
            (e) => {
                e.actor = { kind: 'system' };
            },
            (e) => {
                e.actor = { kind: 'legacy_unknown' };
            },
            (e) => {
                delete e.actor.userId;
            },
            (e) => {
                e.trigger.initiatedByUserId = userId;
            },
            (e) => {
                e.subject.kind = 'account';
            },
            (e) => {
                e.subject.id = new ObjectId().toHexString();
            },
            (e) => {
                e.subject.id = new ObjectId();
            },
            (e) => {
                e.schemaVersion = 2;
            },
            (e) => {
                e.createdByMemberId = new ObjectId();
            },
            (e) => {
                e.commandId = 'bad';
            },
            (e) => {
                e.date = '2026-11-05';
            },
            (e) => {
                e.actor.secret = 'private';
            }
        ];
        for (const mutate of negatives) {
            const invalid = valid();
            mutate(invalid);
            await assert.rejects(db.collection('events').insertOne(invalid), (error) => error.code === 121);
        }
        await db.collection('events').insertOne({ ...valid(), actor: { kind: 'system' }, trigger: { kind: 'automation', initiatedByUserId: userId } });
        const plan = await db.collection('events').find({ accountId }).sort({ date: -1, _id: -1 }).hint(index.name).explain('executionStats');
        assert.match(JSON.stringify(plan.queryPlanner.winningPlan), /IXSCAN/);
        assert.doesNotMatch(JSON.stringify(plan.queryPlanner.winningPlan), /"stage":"SORT"/);
        const session = client.startSession();
        const count = await db.collection('events').countDocuments();
        try {
            await assert.rejects(
                session.withTransaction(async () => {
                    await db.collection('events').insertOne(valid(), { session });
                    throw new Error('rollback E03');
                }),
                /rollback E03/
            );
        } finally {
            await session.endSession();
        }
        assert.equal(await db.collection('events').countDocuments(), count);
        const saved = await documents();
        await execute(r, 'down');
        assert.deepEqual(await documents(), saved, 'down preserves newly created data and BSON types');
        await execute(r);
        assert.deepEqual(await documents(), saved);
        assert.deepEqual(await execute(r), { applied: [], pending: [] });
    });

    await t.test('all 31 catalog codes survive real Mongo roundtrip; every code rejects unapproved params', async () => {
        await reset();
        await execute(runner(preparationEntry(), new MemoryBackup(db)));
        const samples = activitySamples({
            account: accountId.toHexString(),
            transaction: transactionId,
            ...Object.fromEntries(['other', 'category', 'member', 'rule', 'income', 'budget', 'carry', 'balance', 'recurrence'].map((name) => [name, new ObjectId().toHexString()]))
        });
        assert.deepEqual(Object.keys(samples).sort(), ACTIVITY_CODES.filter((code) => code !== 'member.updated' && !isRecurrenceActivityCode(code)).sort(), 'E03 stays frozen at 31 codes; later codes require separate immutable migrations');
        for (const [code, [kind, id, params]] of Object.entries(samples)) {
            const event = { ...valid(), code, subject: { kind, id }, params };
            assert.equal(ActivityWriteEventSchema.safeParse({ ...event, accountId: String(accountId) }).success, true, `${code}: independent sample must satisfy E01`);
            const result = await db.collection('events').insertOne(event);
            const stored = await db.collection('events').findOne({ _id: result.insertedId });
            const decoded = decodeStoredEvent(stored);
            assert.equal(decoded.ok, true, code);
            assert.equal(decoded.item.code, code);
            assert.deepEqual(decoded.item.params, params);
            assert.equal(decoded.item.actor.kind, 'user');
            assert.equal(decoded.item.subject.id, id);
            assert.equal(decoded.item.occurredAt, event.date.toISOString());
            await assert.rejects(db.collection('events').insertOne({ ...valid(), code, subject: { kind, id }, params: { ...params, privateSnapshot: 'forbidden' } }), (error) => error.code === 121, `${code}: extra params must be rejected by Mongo`);
        }
        assert.equal(await db.collection('events').countDocuments(), ACTIVITY_CODES.filter((code) => code !== 'member.updated' && !isRecurrenceActivityCode(code)).length);
    });

    await t.test('legacy BSON unchanged through real Tools backup, up/down and verified restore', async () => {
        await reset();
        const legacy = {
            _id: new ObjectId(),
            accountId,
            date: new Date('2024-03-31T00:30:12.345Z'),
            code: 'transaction.created',
            params: { transactionId: new ObjectId(), type: 'expense', amountMinor: 9876, notes: 'legacy-only', oldReference: new ObjectId() },
            subject: { id: new ObjectId() },
            createdByMemberId: new ObjectId()
        };
        const unknown = { ...legacy, _id: new ObjectId(), code: 'historic.unrecognized' };
        await db.collection('events').insertMany([legacy, unknown]);
        let original = await documents();
        for (const doc of [legacy, unknown]) {
            const decoded = decodeStoredEvent(doc);
            assert.equal(decoded.ok, true);
            assert.equal(decoded.item.actor.kind, 'unknown');
            assert.deepEqual(decoded.refs, {});
            assert.equal(decoded.item.occurredAt, doc.date.toISOString());
        }
        const tools = new ToolsBackup(client, db, uri, scratch, 'docker-local');
        const r = runner(preparationEntry(), tools);
        await execute(r);
        assert.deepEqual(await documents(), original);
        await db.collection('events').insertOne({ ...legacy, _id: new ObjectId() });
        const withNewLegacy = await documents();
        assert.deepEqual(withNewLegacy.slice(0, original.length), original);
        original = withNewLegacy;
        await execute(r, 'down');
        assert.deepEqual(await documents(), original);
        // Actual failed preparation, restore the immediately preceding verified backup only.
        const entry = preparationEntry();
        const apply = entry.migration.up[0].apply;
        entry.migration.up[0].apply = async (context) => {
            await apply(context);
            throw new Error('E03 after validator');
        };
        const interrupted = runner(entry, tools);
        const beforeFailure = (await inventory(db)).filter((item) => item.name !== '_tobu_migrations');
        await assert.rejects(execute(interrupted), /E03 after validator/);
        assert.ok((await interrupted.plan()).recovery);
        await recover(interrupted, 'restore');
        assert.deepEqual(
            (await inventory(db)).filter((item) => item.name !== '_tobu_migrations'),
            beforeFailure
        );
        assert.deepEqual(await documents(), original);
    });

    await t.test('interrupted expand resumes by exact state; drift is ambiguous and restore remains explicit', async () => {
        await reset();
        const entry = preparationEntry(),
            backup = new MemoryBackup(db);
        const apply = entry.migration.up[0].apply;
        let calls = 0;
        entry.migration.up[0].apply = async (context) => {
            calls++;
            await apply(context);
            throw new Error('E03 lost DDL reply');
        };
        const r = runner(entry, backup);
        await assert.rejects(execute(r), /E03 lost DDL reply/);
        await recover(r, 'resume');
        assert.equal(calls, 1);
        await execute(r, 'down');
        await assert.rejects(execute(r), /E03 lost DDL reply/);
        await db.collection('events').createIndex({ _id: -1, date: -1, accountId: 1 }, { name: index.name, background: true });
        await assert.rejects(recover(r, 'resume'), /Ambiguous/);
        backup.interruptRestore = true;
        await assert.rejects(recover(r, 'restore'), /restore interrupted/);
        assert.equal((await r.plan()).progress.stage, 'restoring');
        await assert.rejects(recover(r, 'resume'), /restore must finish/);
        await recover(r, 'restore');
        assert.equal((await r.plan()).recovery, null);
    });

    await t.test('failed Down retains maintenance and restores the latest successful Up including new events', async () => {
        await reset();
        const entry = preparationEntry(),
            backup = new MemoryBackup(db),
            r = runner(entry, backup);
        await execute(r);
        await Event.create(valid());
        const saved = await documents();
        const apply = entry.migration.down[0].apply;
        entry.migration.down[0].apply = async (context) => {
            await apply(context);
            throw new Error('E03 interrupted down');
        };
        await assert.rejects(execute(r, 'down'), /interrupted down/);
        assert.equal((await r.plan()).recovery.direction, 'down');
        await recover(r, 'restore');
        assert.equal((await r.plan()).applied.length, 1);
        assert.deepEqual(await documents(), saved);
        assert.deepEqual((await db.collection('events').listIndexes().toArray()).find((item) => item.name === index.name).key, index.key);
    });

    await t.test('actual process kill after event validator DDL resumes with the original archive and catalog checksum', { timeout: 120000 }, async (caseT) => {
        await reset();
        await db.collection('events').insertOne({ accountId, date: new Date('2024-01-01T12:30:00.123Z'), code: 'historic.unknown', params: { keep: 1234 }, createdByMemberId: new ObjectId() });
        const saved = await documents();
        const child = fork(new URL('../fixtures/event-migration-child.mjs', import.meta.url), [], {
            env: { ...process.env, NODE_ENV: 'test', TEST_MONGODB_URI: uri, TEST_BACKUP_ROOT: scratch },
            windowsHide: true,
            stdio: ['ignore', 'inherit', 'inherit', 'ipc']
        });
        try {
            const message = await Promise.race([
                once(child, 'message', { signal: caseT.signal }),
                once(child, 'exit', { signal: caseT.signal }).then(() => {
                    throw new Error('E03 child exited before DDL checkpoint');
                })
            ]);
            assert.equal(message[0].checkpoint, 'validator-applied-tools-stopped');
        } finally {
            if (child.exitCode === null && child.signalCode === null) {
                const exited = once(child, 'exit');
                child.kill('SIGKILL');
                await exited;
            }
        }
        const r = runner(preparationEntry(), new ToolsBackup(client, db, uri, scratch, 'docker-local'));
        assert.equal((await r.plan()).progress.steps['expand-validator'], 'started');
        await recover(r, 'resume');
        assert.deepEqual(await documents(), saved);
        await execute(r, 'down');
        assert.deepEqual(await documents(), saved);
    });
});
