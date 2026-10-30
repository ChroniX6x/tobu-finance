import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { MongoClient, ObjectId } from 'mongodb';

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
const NOV = '2026-11-01T00:00:00.000Z';
const DEC = '2026-12-01T00:00:00.000Z';

test('transaction dates: BankDate/month rules and atomic parent/child/event writes (real replica set, failpoints)', { timeout: 300000 }, async (t) => {
    const endpoint = process.env.TEST_MONGODB_URI;
    assert.ok(endpoint, 'Provide TEST_MONGODB_URI for a dedicated replica-set test server (npm run test:integration)');
    const parsed = new URL(endpoint);
    assert.equal(parsed.protocol, 'mongodb:');
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname), 'Only local test servers are accepted');
    const dbName = `tobu_test_${randomUUID().replaceAll('-', '')}`;
    // A unique appName lets failpoints hit only this API instance, never the other integration files.
    const apiAppName = `tobu-h02-api-${randomUUID()}`;
    parsed.pathname = `/${dbName}`;
    const adminUri = parsed.toString();
    parsed.searchParams.set('appName', apiAppName);
    const apiUri = parsed.toString();
    const scratch = await mkdtemp(join(resolve(tmpdir()), 'tobu-h02-test-'));
    const client = new MongoClient(adminUri, { serverSelectionTimeoutMS: 3000 });
    let api;
    let apiOutput = '';
    t.after(async () => {
        try {
            await client
                .db('admin')
                .command({ configureFailPoint: 'failCommand', mode: 'off' })
                .catch(() => {});
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
    });
    await client.connect();
    const helloReplica = await client.db('admin').command({ hello: 1 });
    assert.ok(helloReplica.setName, 'Transactions need a replica set');

    const init = spawn(process.execPath, [join(root, 'dist/src/database/cli.js'), 'init'], { cwd: scratch, env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: apiUri }, windowsHide: true, stdio: 'inherit' });
    assert.equal((await once(init, 'exit'))[0], 0, 'Baseline initialization');
    const env = { ...process.env, NODE_ENV: 'test', MONGODB_URI: apiUri, PORT: String(await freePort()), CORS_ORIGIN: 'http://localhost:4200' };
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

    let token;
    const request = async (method, path, body) => {
        const response = await fetch(base + path, {
            method,
            signal: AbortSignal.timeout(15000),
            headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        const text = await response.text();
        return { status: response.status, json: text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
    };
    const reg = await request('POST', '/api/auth/register', { email: 'h02@example.test', password: 'H02-test-password', name: 'H02' });
    assert.equal(reg.status, 201);
    token = reg.json.accessToken;
    const member = (await request('POST', '/api/members', { name: 'H02', email: 'h02@example.test', userId: reg.json.user.id })).json;
    const accountId = (await request('POST', '/api/accounts', { name: 'A', members: [{ memberId: member._id, role: 'owner' }] })).json._id;
    const otherAccountId = (await request('POST', '/api/accounts', { name: 'B', members: [{ memberId: member._id, role: 'owner' }] })).json._id;

    const tx = client.db(dbName).collection('transactions');
    const events = client.db(dbName).collection('events');
    const base1 = { accountId, title: 'Rent', type: 'expense', amountMinor: 1000, isFromSharedAccount: true };
    const create = (extra) => request('POST', '/api/transactions', { ...base1, ...extra });
    const snapshot = async () => ({ tx: (await tx.find({}).sort({ _id: 1 }).toArray()).map((d) => ({ ...d })), events: await events.countDocuments({}) });
    const row = async (id) => tx.findOne({ _id: new ObjectId(id) });
    const iso = (d) => d?.toISOString() ?? null;

    await t.test('CAL-10: booked bookDate Nov 1 stores the UTC carrier and the November anchor; children inherit; cents unchanged', async () => {
        const parent = await create({ status: 'booked', bookDate: NOV });
        assert.equal(parent.status, 201);
        const stored = await row(parent.json._id);
        assert.deepEqual([iso(stored.bookDate), iso(stored.month), stored.amountMinor], [NOV, NOV, 1000]);
        const child = await create({ title: 'Split', amountMinor: 333, status: 'booked', bookDate: NOV, parentTransactionId: parent.json._id });
        assert.equal(child.status, 201);
        const storedChild = await row(child.json._id);
        assert.deepEqual([iso(storedChild.bookDate), iso(storedChild.month), storedChild.amountMinor], [NOV, NOV, 333]);
        const listed = (await request('GET', `/api/transactions?accountId=${accountId}&month=2026-11`)).json;
        assert.ok(listed.items.some((item) => item._id === parent.json._id));
    });

    await t.test('CAL-11: contradicting month and bookDate is rejected without any write; a consistent pair is accepted', async () => {
        const before = await snapshot();
        const bad = await create({ status: 'booked', bookDate: NOV, month: '2026-10' });
        assert.equal(bad.status, 422);
        assert.equal(bad.json.error, 'MONTH_BOOKDATE_MISMATCH');
        assert.deepEqual(await snapshot(), before, '0 new records and 0 new events');
        assert.equal((await create({ status: 'booked', bookDate: NOV, month: '2026-11' })).status, 201);
        const child = await create({ title: 'Wrong', amountMinor: 1, bookDate: DEC, parentTransactionId: (await tx.findOne({ bookDate: new Date(NOV), parentTransactionId: null }))._id.toString() });
        assert.equal(child.status, 422, 'a child cannot carry other dates than its parent');
        assert.equal(child.json.error, 'CHILD_DATES_MUST_MATCH_PARENT');
    });

    await t.test('CAL-13: pending needs an explicit month without a bookDate; booked needs a bookDate', async () => {
        const jan = await create({ month: '2027-01' });
        assert.equal(jan.status, 201);
        assert.equal(iso((await row(jan.json._id)).month), '2027-01-01T00:00:00.000Z');
        assert.equal((await row(jan.json._id)).bookDate, null);
        assert.ok([400, 422].includes((await create({})).status));
        assert.ok([400, 422].includes((await create({ status: 'booked', month: '2027-01' })).status));
    });

    await t.test('child of another account is treated like a missing parent and nothing is written', async () => {
        const parent = await create({ month: '2027-02' });
        const before = await snapshot();
        const response = await request('POST', '/api/transactions', { ...base1, accountId: otherAccountId, title: 'Foreign child', amountMinor: 10, month: '2027-02', parentTransactionId: parent.json._id });
        assert.equal(response.status, 422);
        assert.equal(response.json.error, 'PARENT_NOT_FOUND');
        assert.deepEqual(await snapshot(), before);
    });

    await t.test('CAL-12: PATCH with only a different month on a booked transaction is rejected; same month is a no-op; a new bookDate moves parent and children', async () => {
        const parent = await create({ status: 'booked', bookDate: NOV, title: 'Move me' });
        const child = await create({ title: 'Kid', amountMinor: 100, status: 'booked', bookDate: NOV, parentTransactionId: parent.json._id });
        const before = await snapshot();
        assert.equal((await request('PATCH', `/api/transactions/${parent.json._id}`, { month: '2026-10' })).status, 422);
        assert.deepEqual(await snapshot(), before);
        assert.equal((await request('PATCH', `/api/transactions/${parent.json._id}`, { month: '2026-11' })).status, 200);
        assert.deepEqual(await snapshot(), before, 'same month changes nothing');
        assert.equal((await request('PATCH', `/api/transactions/${child.json._id}`, { bookDate: DEC })).status, 422, 'a child cannot change its own date');
        const moved = await request('PATCH', `/api/transactions/${parent.json._id}`, { bookDate: '2026-12-05T00:00:00.000Z' });
        assert.equal(moved.status, 200);
        for (const id of [parent.json._id, child.json._id]) {
            const stored = await row(id);
            assert.deepEqual([iso(stored.bookDate), iso(stored.month)], ['2026-12-05T00:00:00.000Z', DEC]);
        }
        assert.equal((await request('PATCH', `/api/transactions/${parent.json._id}`, { bookDate: '2026-12-06T00:00:00.000Z', month: '2026-11' })).status, 422);
    });

    await t.test('legacy rows are never re-derived by unchanged or unrelated patches', async () => {
        const id = new ObjectId();
        await tx.insertOne({
            _id: id,
            accountId: new ObjectId(accountId),
            title: 'Legacy',
            type: 'expense',
            amountMinor: 500,
            month: new Date(NOV),
            bookDate: new Date('2026-10-31T23:00:00.000Z'),
            status: 'booked',
            isFromSharedAccount: true,
            paidByMemberId: null,
            parentTransactionId: null
        });
        const legacy = async () => {
            const { month, bookDate } = await row(id);
            return [iso(month), iso(bookDate)];
        };
        const original = [NOV, '2026-10-31T23:00:00.000Z'];
        assert.equal((await request('PATCH', `/api/transactions/${id}`, { title: 'Renamed' })).status, 200);
        assert.deepEqual(await legacy(), original);
        assert.equal((await request('PATCH', `/api/transactions/${id}`, { bookDate: '2026-10-31T23:00:00.000Z' })).status, 200);
        assert.deepEqual(await legacy(), original, 'resending the identical bookDate does not re-derive the month');
        assert.equal((await request('PATCH', `/api/transactions/${id}`, { month: '2026-11' })).status, 200);
        assert.deepEqual(await legacy(), original, 'month equal to the stored one is a no-op');
    });

    // mode {skip: n} lets n matching commands pass and fails every later one until the failpoint is switched off.
    const failpoint = (failCommands, skip = 0) => client.db('admin').command({ configureFailPoint: 'failCommand', mode: skip ? { skip } : { times: 1 }, data: { failCommands, errorCode: 8, appName: apiAppName } });
    const failpointOff = () => client.db('admin').command({ configureFailPoint: 'failCommand', mode: 'off' });
    const makePair = async () => {
        const parent = await create({ month: '2026-11', title: 'Atomic' });
        const child = await create({ title: 'Atomic child', amountMinor: 400, month: '2026-11', parentTransactionId: parent.json._id });
        return [parent.json._id, child.json._id];
    };
    const bookedEvents = (id) => events.countDocuments({ code: 'transaction.booked', 'params.transactionId': id });
    const body = { status: 'booked', bookDate: '2026-12-02T00:00:00.000Z' };
    for (const [label, commands] of [
        ['after nothing was written yet (parent write fails)', ['findAndModify']],
        ['after the parent write (child cascade fails)', ['update']],
        ['after parent and children (event write fails)', ['insert']],
        ['right before commit', ['commitTransaction']]
    ]) {
        await t.test(`CAL-12 failpoint ${label}: 0 partial changes, retry succeeds consistently`, async () => {
            const [parentId, childId] = await makePair();
            const before = await snapshot();
            await failpoint(commands);
            const failed = await request('PATCH', `/api/transactions/${parentId}`, body);
            await failpointOff();
            assert.ok(failed.status >= 500, `expected a server error, got ${failed.status}`);
            assert.deepEqual(await snapshot(), before, 'parent, child and events are exactly as before');
            assert.equal(await bookedEvents(parentId), 0);
            const retried = await request('PATCH', `/api/transactions/${parentId}`, body);
            assert.equal(retried.status, 200);
            for (const id of [parentId, childId]) {
                const stored = await row(id);
                assert.deepEqual([stored.status, iso(stored.bookDate), iso(stored.month)], ['booked', '2026-12-02T00:00:00.000Z', DEC]);
            }
            assert.equal(await bookedEvents(parentId), 1);
        });
    }

    await t.test('CAL-12 create: a failing event write leaves no transaction behind (the failpoint provably hits the 2nd insert)', async () => {
        const before = await snapshot();
        // A create performs exactly two inserts (transaction, event): skipping two lets it pass, so skip:1 can only hit the event.
        await failpoint(['insert'], 2);
        const passes = await create({ month: '2027-03', title: 'Two inserts only' });
        await failpointOff();
        assert.equal(passes.status, 201);
        const afterPass = await snapshot();
        assert.equal(afterPass.tx.length, before.tx.length + 1);
        await failpoint(['insert'], 1);
        const failed = await create({ month: '2027-03', title: 'No orphan' });
        await failpointOff();
        assert.ok(failed.status >= 500);
        assert.deepEqual(await snapshot(), afterPass);
    });

    await t.test('CAL-12 concurrent date changes never leave parent and children apart', async () => {
        const [parentId, childId] = await makePair();
        const dates = ['2027-01-05T00:00:00.000Z', '2027-02-05T00:00:00.000Z', '2027-03-05T00:00:00.000Z'];
        const results = await Promise.all(dates.map((bookDate) => request('PATCH', `/api/transactions/${parentId}`, { bookDate })));
        const winners = results.filter((r) => r.status === 200);
        assert.ok(winners.length >= 1, `at least one change wins: ${results.map((r) => r.status)}`);
        for (const r of results) assert.ok([200, 500].includes(r.status));
        const [parent, child] = [await row(parentId), await row(childId)];
        assert.deepEqual([iso(child.bookDate), iso(child.month)], [iso(parent.bookDate), iso(parent.month)]);
        assert.ok(dates.includes(iso(parent.bookDate)), 'the final value is one that was actually requested');
    });

    await t.test('CAL-12 a child created while the parent date changes never keeps the old date (write skew)', async () => {
        for (let round = 0; round < 6; round++) {
            const parent = await create({ month: '2026-11', title: `Skew ${round}` });
            const results = await Promise.all([
                request('PATCH', `/api/transactions/${parent.json._id}`, { bookDate: '2027-04-05T00:00:00.000Z' }),
                create({ title: 'Late child', amountMinor: 100, month: '2026-11', parentTransactionId: parent.json._id })
            ]);
            assert.equal(results[0].status, 200);
            const children = await tx.find({ parentTransactionId: new ObjectId(parent.json._id) }).toArray();
            const stored = await row(parent.json._id);
            for (const child of children) assert.deepEqual([iso(child.bookDate), iso(child.month)], [iso(stored.bookDate), iso(stored.month)], `round ${round}: child ${child._id} differs from its parent`);
            // The child either saw the old parent (and was then moved by the cascade) or the new one (and was rejected as stale).
            assert.ok([201, 422].includes(results[1].status), `child status ${results[1].status}`);
        }
    });

    await t.test('split sum: two parallel children can never exceed the parent amount', async () => {
        const parent = await create({ month: '2026-11', title: 'Boundary' });
        const results = await Promise.all([1, 2].map((n) => create({ title: `Half ${n}`, amountMinor: 600, month: '2026-11', parentTransactionId: parent.json._id })));
        assert.deepEqual(results.map((r) => r.status).sort(), [201, 422]);
        const sum = (await tx.find({ parentTransactionId: new ObjectId(parent.json._id) }).toArray()).reduce((total, child) => total + child.amountMinor, 0);
        assert.equal(sum, 600);
    });

    await t.test('private payer, income type and cents survive create, split and date change', async () => {
        const parent = await create({ title: 'Private', type: 'income', amountMinor: 1999, isFromSharedAccount: false, paidByMemberId: member._id, status: 'booked', bookDate: NOV });
        assert.equal(parent.status, 201);
        const child = await create({ title: 'Part', amountMinor: 999, status: 'booked', bookDate: NOV, parentTransactionId: parent.json._id, isFromSharedAccount: false, paidByMemberId: member._id });
        assert.equal(child.status, 201);
        assert.equal((await request('PATCH', `/api/transactions/${parent.json._id}`, { bookDate: '2026-12-31T00:00:00.000Z' })).status, 200);
        for (const id of [parent.json._id, child.json._id]) {
            const stored = await row(id);
            assert.deepEqual([stored.type, stored.isFromSharedAccount, String(stored.paidByMemberId), iso(stored.month)], ['income', false, member._id, DEC]);
        }
        assert.deepEqual([(await row(parent.json._id)).amountMinor, (await row(child.json._id)).amountMinor], [1999, 999]);
        assert.equal(
            (
                await request('POST', '/api/transactions', {
                    ...base1,
                    title: 'Too much',
                    amountMinor: 1001,
                    status: 'booked',
                    bookDate: '2026-12-31T00:00:00.000Z',
                    isFromSharedAccount: false,
                    paidByMemberId: member._id,
                    parentTransactionId: parent.json._id
                })
            ).status,
            422,
            'split constraint still holds'
        );
    });
});
