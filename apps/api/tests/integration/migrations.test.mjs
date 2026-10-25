import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import mongoose from 'mongoose';
import { MongoClient, MongoError } from 'mongodb';
import { initializeBaseline } from '../../dist/src/database/baseline.js';
import { MigrationRunner } from '../../dist/src/database/migration-runner.js';
import { entry } from '../fixtures/migration-fixture.mjs';

test('transactional migration safety against a real isolated replica set', { timeout: 180000 }, async (t) => {
    assert.ok(process.env.TEST_MONGODB_URI, 'Explicit isolated database required');
    const uri = new URL(process.env.TEST_MONGODB_URI);
    assert.equal(uri.protocol, 'mongodb:');
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname));
    uri.pathname = `/tobu_test_migrations_${randomUUID().replaceAll('-', '')}`;
    const connection = uri.toString();
    await mongoose.connect(connection, { autoCreate: false, autoIndex: false });
    await initializeBaseline();
    const client = new MongoClient(connection);
    await client.connect();
    const db = client.db();
    await db.collection('migration_test').insertMany([
        { _id: 'a', amountMinor: 123 },
        { _id: 'b', amountMinor: 456 }
    ]);
    t.after(async () => {
        await db.dropDatabase();
        await client.close();
        await mongoose.disconnect();
    });
    const runner = (options) => new MigrationRunner(client, db, connection, 'test', [entry(options)]);
    const execute = async (r, direction = 'up') => r.run(direction, (await r.plan(direction)).confirmation, true);
    const recover = async (r) => {
        const plan = await r.plan();
        return r.recover(plan.confirmation, plan.recovery.runId, true);
    };
    const documents = () => db.collection('migration_test').find().sort({ _id: 1 }).toArray();
    const original = await documents();

    await t.test('missing namespaces and stale confirmations are rejected without acquiring a lock', async () => {
        const migration = entry();
        migration.migration.namespaces.push('missing_collection');
        const r = new MigrationRunner(client, db, connection, 'test', [migration]);
        await assert.rejects(r.plan(), /Missing collection missing_collection/);
        await assert.rejects(r.run('up', 'obsolete', true), /Missing collection/);
        assert.equal(await db.collection('_tobu_migration_control').countDocuments(), 0);
        const valid = runner();
        await assert.rejects(valid.run('up', 'obsolete', true), /confirmation/);
        assert.equal(await db.collection('_tobu_migration_control').countDocuments(), 0);
        assert.deepEqual(await documents(), original);
    });

    await t.test('target confirmation and immutable history, up/down and repeat', async () => {
        const r = runner();
        await assert.rejects(r.run('up', 'wrong', true), /confirmation/);
        assert.equal(await db.collection('_tobu_migration_control').countDocuments(), 0);
        await execute(r);
        assert.equal((await r.plan()).applied.length, 1);
        assert.deepEqual(await execute(r), { applied: [], pending: [] });
        const changed = entry();
        changed.checksum = 'b'.repeat(64);
        await assert.rejects(new MigrationRunner(client, db, connection, 'test', [changed]).plan(), /modified/);
        await execute(r, 'down');
        assert.deepEqual(await documents(), original);
        await assert.rejects(new MigrationRunner(client, db, connection, 'test', [changed]).plan(), /modified/);
    });
    await t.test('failure after writes and inside down leaves no partial state', async () => {
        const r = runner({ failUp: true });
        await assert.rejects(execute(r), /recovery required/);
        assert.deepEqual(await documents(), original);
        await assert.rejects(execute(r), /locked/);
        assert.equal((await recover(r)).outcome, 'not-committed');
        const down = runner({ failDown: true });
        await execute(down);
        const before = await documents();
        await assert.rejects(execute(down, 'down'), /recovery required/);
        assert.deepEqual(await documents(), before);
        assert.equal((await recover(down)).outcome, 'not-committed');
        await execute(runner(), 'down');
    });
    await t.test('history write failure rolls data back too', async () => {
        await db.command({ collMod: '_tobu_migrations', validator: { forbidden: { $exists: true } }, validationLevel: 'strict' });
        const r = runner();
        await assert.rejects(execute(r), /recovery required/);
        assert.deepEqual(await documents(), original);
        await db.command({ collMod: '_tobu_migrations', validator: {} });
        await recover(r);
    });
    await t.test('transient transaction failure retries the complete uncommitted migration', async () => {
        const migration = entry();
        const up = migration.migration.up;
        let attempts = 0;
        migration.migration.up = async (context) => {
            await up(context);
            if (++attempts === 1) {
                const error = new MongoError('simulated transient failure after writes');
                error.addErrorLabel('TransientTransactionError');
                throw error;
            }
        };
        const r = new MigrationRunner(client, db, connection, 'test', [migration]);
        await execute(r);
        assert.equal(attempts, 2);
        await execute(r, 'down');
        assert.deepEqual(await documents(), original);
    });
    await t.test('failure in a later migration preserves the previously committed step', async () => {
        const first = entry(),
            second = entry();
        second.id = '20261024000000001-second';
        second.checksum = 'b'.repeat(64);
        second.migration.predecessor = first.id;
        second.migration.preUp = async (context) => {
            assert.equal(await context.count('migration_test', { revision: 1 }), 2);
        };
        second.migration.up = async (context) => {
            await context.updateMany('migration_test', {}, { $set: { second: true } });
            throw new Error('second migration failed');
        };
        const r = new MigrationRunner(client, db, connection, 'test', [first, second]);
        await assert.rejects(execute(r), /recovery required/);
        assert.deepEqual((await r.plan()).applied, [first.id]);
        assert.equal(await db.collection('migration_test').countDocuments({ second: true }), 0);
        await recover(r);
        await execute(r, 'down');
        assert.deepEqual(await documents(), original);
    });
    await t.test('unknown commit response is retried without applying data twice', async () => {
        const start = client.startSession.bind(client);
        let injected = false;
        client.startSession = (...args) => {
            const session = start(...args),
                commit = session.commitTransaction.bind(session);
            session.commitTransaction = async (...options) => {
                await commit(...options);
                if (!injected) {
                    injected = true;
                    const error = new MongoError('simulated lost commit acknowledgement');
                    error.addErrorLabel('UnknownTransactionCommitResult');
                    throw error;
                }
            };
            return session;
        };
        try {
            await execute(runner());
            assert.equal(injected, true);
        } finally {
            client.startSession = start;
        }
        assert.equal((await runner().plan()).applied.length, 1);
        await execute(runner(), 'down');
    });
    await t.test('concurrent runner is refused; killed process requires explicit fenced recovery', { timeout: 100000 }, async () => {
        const child = fork(new URL('../fixtures/migration-child.mjs', import.meta.url), [], { env: { ...process.env, TEST_MONGODB_URI: connection }, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
        try {
            const [message] = await Promise.race([
                once(child, 'message'),
                once(child, 'exit').then(() => {
                    throw new Error('Child exited before transaction');
                })
            ]);
            assert.equal(message, 'inside-transaction');
            await assert.rejects(execute(runner()), /locked/);
            assert.deepEqual(await documents(), original, 'Uncommitted writes must not be visible');
        } finally {
            if (child.exitCode === null) {
                const exited = once(child, 'exit');
                child.kill('SIGKILL');
                await exited;
            }
        }
        assert.equal((await recover(runner())).outcome, 'not-committed');
        assert.deepEqual(await documents(), original);
        await execute(runner());
        await execute(runner(), 'down');
    });
    await t.test('unresolved response after actual commit is reconciled, never compensated with down', async () => {
        const start = client.startSession.bind(client);
        client.startSession = (...args) => {
            const session = start(...args),
                commit = session.commitTransaction.bind(session);
            session.commitTransaction = async (...options) => {
                await commit(...options);
                throw new Error('connection lost after commit; retry budget exhausted');
            };
            return session;
        };
        try {
            await assert.rejects(execute(runner()), /recovery required/);
        } finally {
            client.startSession = start;
        }
        assert.equal((await recover(runner())).outcome, 'committed');
        assert.equal((await runner().plan()).applied.length, 1);
        await execute(runner(), 'down');
        assert.deepEqual(await documents(), original);
    });
});
