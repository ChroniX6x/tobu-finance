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
const anchor = (key) => `${key}-01T00:00:00.000Z`;

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

test('month intervals, UTC semantics and frozen clock across server time zones (real MongoDB, three API processes)', { timeout: 300000 }, async (t) => {
    const endpoint = process.env.TEST_MONGODB_URI;
    assert.ok(endpoint, 'Provide TEST_MONGODB_URI (npm run test:integration)');
    const parsed = new URL(endpoint);
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname), 'Only local test servers are accepted');
    const dbName = `tobu_test_${randomUUID().replaceAll('-', '')}`;
    parsed.pathname = `/${dbName}`;
    const uri = parsed.toString();
    const scratch = await mkdtemp(join(resolve(tmpdir()), 'tobu-h03-test-'));
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
    const children = [];
    t.after(async () => {
        for (const child of children) await stop(child);
        await client
            .db(dbName)
            .dropDatabase()
            .catch(() => {});
        await client.close();
        if (dirname(resolve(scratch)) !== resolve(tmpdir())) throw new Error('Unexpected scratch path');
        await rm(scratch, { recursive: true, force: true });
    });
    await client.connect();
    const db = client.db(dbName);

    const init = spawn(process.execPath, [join(root, 'dist/src/database/cli.js'), 'init'], { cwd: scratch, env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: uri }, windowsHide: true, stdio: 'inherit' });
    assert.equal((await once(init, 'exit'))[0], 0, 'Baseline initialization');

    const keyEnv = {};
    for (const kind of ['ACCESS', 'REFRESH']) {
        const keys = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
        keyEnv[`JWT_${kind}_PRIVATE_KEY_PEM`] = keys.privateKey;
        keyEnv[`JWT_${kind}_PUBLIC_KEY_PEM`] = keys.publicKey;
    }
    let token;
    async function startApi(label, { tz, frozenNow }) {
        const port = await freePort();
        let output = '';
        const child = spawn(process.execPath, [join(root, 'dist/src/server.js')], {
            cwd: scratch,
            env: { ...process.env, ...keyEnv, NODE_ENV: 'test', MONGODB_URI: uri, PORT: String(port), CORS_ORIGIN: 'http://localhost:4200', TZ: tz, TOBU_TEST_NOW: frozenNow },
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        child.stdout.on('data', (d) => (output += d));
        child.stderr.on('data', (d) => (output += d));
        children.push(child);
        const base = `http://127.0.0.1:${port}`;
        for (let attempt = 0; attempt < 250; attempt++) {
            assert.equal(child.exitCode, null, `${label} exited: ${output}`);
            try {
                if ((await fetch(`${base}/ready`, { signal: AbortSignal.timeout(500) })).ok) break;
            } catch {
                /* wait */
            }
            await delay(200);
        }
        const call = async (method, path, body) => {
            const response = await fetch(base + path, {
                method,
                signal: AbortSignal.timeout(15000),
                headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
                ...(body ? { body: JSON.stringify(body) } : {})
            });
            const text = await response.text();
            return { status: response.status, json: text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
        };
        const zone = await call('GET', '/health');
        assert.equal(zone.status, 200);
        return { label, tz, call };
    }
    // Tokyo is already in December locally while it is still Nov 30 in UTC; Los Angeles is still Nov 30 locally at Dec 1 00:00 UTC.
    const tokyo = await startApi('tokyo', { tz: 'Asia/Tokyo', frozenNow: '2026-11-30T23:59:59.999Z' });
    const la = await startApi('la', { tz: 'America/Los_Angeles', frozenNow: '2026-12-01T00:00:00.000Z' });
    const utc = await startApi('utc', { tz: 'UTC', frozenNow: '2026-11-15T10:30:00.000Z' });

    const reg = await utc.call('POST', '/api/auth/register', { email: 'h03@example.test', password: 'H03-test-password', name: 'H03' });
    assert.equal(reg.status, 201);
    token = reg.json.accessToken;
    const member = (await utc.call('POST', '/api/members', { name: 'H03', email: 'h03@example.test', userId: reg.json.user.id })).json;
    const member2 = (await utc.call('POST', '/api/members', { name: 'Second' })).json;
    const accountId = (
        await utc.call('POST', '/api/accounts', {
            name: 'Acc',
            members: [
                { memberId: member._id, role: 'owner' },
                { memberId: member2._id, role: 'member' }
            ]
        })
    ).json._id;
    const emptyAccountId = (await utc.call('POST', '/api/accounts', { name: 'Empty', members: [{ memberId: member._id, role: 'owner' }] })).json._id;
    const category = async (name) => (await utc.call('POST', '/api/categories', { accountId, name })).json._id;
    const stored = (collection, id) => db.collection(collection).findOne({ _id: new ObjectId(id) });
    const iso = (d) => (d ? d.toISOString() : null);

    await t.test('CAL-14: balances and carryovers: YYYY-MM in, ISO anchor out, one record per month, inclusive filters, ISO input rejected', async () => {
        const put = async (path, extra) => utc.call('PUT', path, { accountId, month: '2026-11', ...extra });
        const first = await put('/api/account-balances', { closingBalanceMinor: 1234 });
        assert.ok([200, 201].includes(first.status));
        assert.equal(first.json.month, anchor('2026-11'));
        assert.equal((await put('/api/account-balances', { closingBalanceMinor: 99 })).status, 200);
        assert.equal(await db.collection('account_balances').countDocuments({ accountId: new ObjectId(accountId) }), 1, 'upsert keeps a single record per account and month');
        assert.equal(iso((await db.collection('account_balances').findOne({ accountId: new ObjectId(accountId) })).month), anchor('2026-11'));
        await put('/api/account-balances', { month: '2026-12', closingBalanceMinor: 5 });
        const inclusive = (await utc.call('GET', `/api/account-balances?accountId=${accountId}&from=2026-11&to=2026-11`)).json;
        assert.deepEqual(
            inclusive.map((b) => b.month),
            [anchor('2026-11')]
        );
        assert.equal((await utc.call('GET', `/api/account-balances?accountId=${accountId}&from=2026-11&to=2026-12`)).json.length, 2);
        assert.equal((await put('/api/account-balances', { month: anchor('2026-11'), closingBalanceMinor: 1 })).status, 400, 'a full ISO instant is not a Month');
        const carry = await utc.call('PUT', '/api/carryovers', { accountId, memberId: member._id, month: '2026-11', amountMinor: -250 });
        assert.ok([200, 201].includes(carry.status));
        assert.deepEqual([carry.json.month, carry.json.amountMinor], [anchor('2026-11'), -250]);
        assert.equal((await utc.call('GET', `/api/carryovers?accountId=${accountId}&from=2026-11&to=2026-11`)).json.length, 1);
    });

    await t.test('CAL-15..17: budgets, incomes and rules accept YYYY-MM and the exact anchor, store BSON anchors, answer ISO, reject everything else', async () => {
        const cases = [
            ['/api/category-budgets', 'category_budgets', (n) => ({ accountId, categoryId: n.category, amountMinor: 1000 })],
            ['/api/member-incomes', 'member_incomes', (n) => ({ accountId, memberId: n.member, amountMinor: 1000 })],
            ['/api/contribution-rules', 'contribution_rules', () => ({ accountId, type: 'additional', recurring: true, amountMinor: 1000, distribution: { mode: 'proRataIncome' } })]
        ];
        for (const [path, collection, body] of cases) {
            const subject = { category: await category(`c-${collection}`), member: collection === 'member_incomes' ? (await utc.call('POST', '/api/members', { name: `m-${collection}` })).json._id : member._id };
            if (collection === 'member_incomes') await utc.call('POST', `/api/accounts/${accountId}/members`, { memberId: subject.member, role: 'member' });
            const created = await utc.call('POST', path, { ...body(subject), fromMonth: '2027-03', toMonth: null });
            assert.equal(created.status, 201, `${path}: ${JSON.stringify(created.json)}`);
            assert.equal(created.json.fromMonth, anchor('2027-03'));
            assert.equal(created.json.toMonth, null);
            const doc = await stored(collection, created.json._id);
            assert.equal(iso(doc.fromMonth), anchor('2027-03'), 'BSON Date on the UTC anchor');
            const viaAnchor = await utc.call('PATCH', `${path}/${created.json._id}`, { fromMonth: anchor('2027-04'), toMonth: '2027-06' });
            assert.equal(viaAnchor.status, 200, `${path}: ${JSON.stringify(viaAnchor.json)}`);
            assert.deepEqual([viaAnchor.json.fromMonth, viaAnchor.json.toMonth], [anchor('2027-04'), anchor('2027-06')]);
            assert.equal((await utc.call('PATCH', `${path}/${created.json._id}`, { toMonth: null })).json.toMonth, null, 'explicit null opens the range');
            for (const bad of ['2027-04-02T00:00:00.000Z', '2027-04-01T00:00:00Z', '2027-13', '2027-04-01T01:00:00.000+01:00']) {
                const before = await stored(collection, created.json._id);
                assert.equal((await utc.call('PATCH', `${path}/${created.json._id}`, { fromMonth: bad })).status, 400, bad);
                assert.deepEqual(await stored(collection, created.json._id), before, 'rejected input writes nothing');
            }
        }
    });

    // Transition at the month change: budget/income end in 2026-11, the follow-up starts in 2026-12.
    const transitionCategory = await category('transition');
    const budget = async (extra) => (await utc.call('POST', '/api/category-budgets', { accountId, categoryId: transitionCategory, ...extra })).json;
    const incomeOf = async (extra) => (await utc.call('POST', '/api/member-incomes', { accountId, memberId: member._id, ...extra })).json;
    const oldBudget = await budget({ amountMinor: 11100, fromMonth: '2026-01', toMonth: '2026-11' });
    const newBudget = await budget({ amountMinor: 22200, fromMonth: '2026-12', toMonth: null });
    const oldIncome = await incomeOf({ amountMinor: 100000, fromMonth: '2026-01', toMonth: '2026-11' });
    const newIncome = await incomeOf({ amountMinor: 200000, fromMonth: '2026-12', toMonth: null });
    assert.ok(oldBudget._id && newBudget._id && oldIncome._id && newIncome._id, 'transition fixtures were created');

    await t.test('CAL-18/20: a range ending in Nov is active in Nov and not in Dec; one starting in Dec is not active in Nov. Planning, month view and expanded agree', async () => {
        for (const [month, activeBudget, inactiveBudget, activeIncome, inactiveIncome, budgetMinor] of [
            ['2026-11', oldBudget, newBudget, oldIncome, newIncome, 11100],
            ['2026-12', newBudget, oldBudget, newIncome, oldIncome, 22200]
        ]) {
            const planning = (await utc.call('GET', `/api/accounts/${accountId}/planning?month=${month}`)).json;
            const flag = (id) => planning.budgets.find((b) => b.budgetId === id)?.isActiveInReferenceMonth;
            assert.deepEqual([flag(activeBudget._id), flag(inactiveBudget._id)], [true, false], `planning budgets ${month}`);
            const incomes = planning.incomes.find((i) => i.memberId === member._id);
            assert.equal(incomes.activeIncome?.incomeId, activeIncome._id, `planning income ${month}`);
            assert.ok(incomes.history.some((h) => h.incomeId === inactiveIncome._id));
            const monthView = (await utc.call('GET', `/api/accounts/${accountId}/month-view?month=${month}`)).json;
            assert.equal(monthView.categories.find((c) => c.id === transitionCategory).budgetMinor, budgetMinor, `month view budget ${month}`);
            const expanded = (await utc.call('GET', `/api/accounts/${accountId}/expanded?include=memberIncomes,categoryBudgets&from=${month}&to=${month}`)).json;
            assert.deepEqual(
                expanded.categoryBudgets.map((b) => String(b._id)).filter((id) => [oldBudget._id, newBudget._id].includes(id)),
                [activeBudget._id],
                `expanded budgets ${month}`
            );
            assert.deepEqual(
                expanded.memberIncomes.map((i) => String(i._id)).filter((id) => [oldIncome._id, newIncome._id].includes(id)),
                [activeIncome._id],
                `expanded incomes ${month}`
            );
        }
    });

    await t.test('CAL-19: category history is identical for server time zones UTC, Tokyo and Los Angeles', async () => {
        const cat = await category('history');
        const insert = (month, amountMinor) =>
            db.collection('transactions').insertOne({
                accountId: new ObjectId(accountId),
                categoryId: new ObjectId(cat),
                title: `t-${month}`,
                type: 'expense',
                status: 'booked',
                amountMinor,
                month: new Date(anchor(month)),
                bookDate: new Date(anchor(month)),
                isFromSharedAccount: true,
                paidByMemberId: null,
                parentTransactionId: null
            });
        for (const [month, amount] of [
            ['2026-08', 100],
            ['2026-12', 701],
            ['2026-12', 2],
            ['2027-01', 33]
        ])
            await insert(month, amount);
        const views = [];
        for (const server of [utc, tokyo, la]) views.push((await server.call('GET', `/api/accounts/${accountId}/month-view?month=2027-01`)).json);
        const history = (view) => view.categoryHistory.map((h) => [h.month, h.spentByCategoryId[cat] ?? 0]);
        assert.deepEqual(history(views[0]), [
            ['2026-08', 100],
            ['2026-09', 0],
            ['2026-10', 0],
            ['2026-11', 0],
            ['2026-12', 703],
            ['2027-01', 33]
        ]);
        assert.deepEqual(history(views[1]), history(views[0]), 'Tokyo');
        assert.deepEqual(history(views[2]), history(views[0]), 'Los Angeles');
        assert.deepEqual(views[1].categories, views[0].categories);
    });

    await t.test('CAL-21: summary and overview type the current month as an anchor, separately from the last reliable snapshot', async () => {
        const rows = (await utc.call('GET', '/api/accounts/summary?months=3')).json;
        const empty = rows.find((r) => r.id === emptyAccountId);
        assert.equal(empty.currentMonth, anchor('2026-11'), 'no snapshot: the current month anchor, never a full instant');
        assert.ok(!empty.currentMonth.includes('10:30'), 'the frozen instant must not leak');
        assert.deepEqual([empty.isStale, empty.stalenessDays <= 0], [false, true], 'no snapshot is not stale (same staleness as before the anchor fix)');
        // A snapshot from September while the calendar month is November: the field reports the last reliable snapshot month.
        const staleAccountId = (await utc.call('POST', '/api/accounts', { name: 'Stale', members: [{ memberId: member._id, role: 'owner' }] })).json._id;
        await utc.call('PUT', '/api/account-balances', { accountId: staleAccountId, month: '2026-09', closingBalanceMinor: 777 });
        const stale = (await utc.call('GET', '/api/accounts/summary?months=3')).json.find((r) => r.id === staleAccountId);
        assert.deepEqual([stale.currentMonth, stale.currentBalanceMinor], [anchor('2026-09'), 777]);
        const overview = (await utc.call('GET', `/api/accounts/${emptyAccountId}/overview`)).json;
        assert.equal(overview.account.currentMonth, anchor('2026-11'));
        const staleOverview = (await utc.call('GET', `/api/accounts/${staleAccountId}/overview`)).json;
        assert.equal(staleOverview.account.currentMonth, anchor('2026-09'), 'separate from the calendar month, which month-view reports');
        assert.equal((await utc.call('GET', `/api/accounts/${staleAccountId}/month-view`)).json.account.monthIso, '2026-11');
    });

    await t.test('CAL-23: month view, planning and overview use the same UTC month independent of the process zone and the local calendar', async () => {
        for (const [server, expected] of [
            [tokyo, '2026-11'],
            [la, '2026-12'],
            [utc, '2026-11']
        ]) {
            const monthView = (await server.call('GET', `/api/accounts/${emptyAccountId}/month-view`)).json;
            const planning = (await server.call('GET', `/api/accounts/${emptyAccountId}/planning`)).json;
            const overview = (await server.call('GET', `/api/accounts/${emptyAccountId}/overview`)).json;
            assert.equal(monthView.account.monthIso, expected, `${server.label} month view`);
            assert.equal(planning.referenceMonth, expected, `${server.label} planning`);
            assert.equal(String(overview.account.currentMonth).slice(0, 7), expected, `${server.label} overview`);
        }
    });

    await t.test('CAL-18 overview and rules: a rule starting in December is not counted in November, one ending in November is not counted in December', async () => {
        const ruleAccountId = (await utc.call('POST', '/api/accounts', { name: 'Rules', members: [{ memberId: member._id, role: 'owner' }] })).json._id;
        const rule = (extra) => utc.call('POST', '/api/contribution-rules', { accountId: ruleAccountId, type: 'additional', recurring: true, distribution: { mode: 'proRataIncome' }, ...extra });
        assert.equal((await rule({ amountMinor: 700, fromMonth: '2026-01', toMonth: '2026-11' })).status, 201);
        assert.equal((await rule({ amountMinor: 5000, fromMonth: '2026-12', toMonth: null })).status, 201);
        const find = (value, key) =>
            value && typeof value === 'object'
                ? key in value
                    ? value[key]
                    : Object.values(value)
                          .map((v) => find(v, key))
                          .find((v) => v !== undefined)
                : undefined;
        for (const [server, expected] of [
            [utc, 700],
            [la, 5000]
        ]) {
            const overview = (await server.call('GET', `/api/accounts/${ruleAccountId}/overview`)).json;
            assert.equal(find(overview, 'extraContributionsSumMinor'), expected, `${server.label} overview extra contributions`);
            const planning = (await server.call('GET', `/api/accounts/${ruleAccountId}/planning`)).json;
            const monthRules = JSON.stringify(planning).match(/"amountMinor":(700|5000)\b/g) ?? [];
            assert.ok(
                monthRules.some((m) => m.endsWith(String(expected))),
                `${server.label} planning lists the active rule`
            );
            assert.ok(!monthRules.some((m) => m.endsWith(String(expected === 700 ? 5000 : 700))), `${server.label} planning hides the inactive rule`);
        }
    });

    await t.test('CAL-20 generator: the base rule counts only budgets that are active in the (frozen) current month', async () => {
        for (const [server, expectedBase] of [
            [tokyo, 11100],
            [la, 22200]
        ]) {
            const genAccountId = (await utc.call('POST', '/api/accounts', { name: `Gen ${server.label}`, members: [{ memberId: member._id, role: 'owner' }] })).json._id;
            const genCategory = (await utc.call('POST', '/api/categories', { accountId: genAccountId, name: 'g' })).json._id;
            for (const extra of [
                { amountMinor: 11100, fromMonth: '2026-01', toMonth: '2026-11' },
                { amountMinor: 22200, fromMonth: '2026-12', toMonth: null }
            ]) {
                assert.equal((await server.call('POST', '/api/category-budgets', { accountId: genAccountId, categoryId: genCategory, ...extra })).status, 201);
            }
            const base = await db
                .collection('contribution_rules')
                .find({ accountId: new ObjectId(genAccountId), type: 'base' })
                .toArray();
            assert.deepEqual(
                base.map((b) => b.amountMinor),
                [expectedBase],
                `${server.label}`
            );
        }
    });

    await t.test('invalid month filters are answered with 400 and nothing leaks as a server error', async () => {
        for (const path of [
            `/api/account-balances?accountId=${accountId}&from=${anchor('2026-11')}`,
            `/api/carryovers?accountId=${accountId}&to=2026-13`,
            `/api/accounts/${accountId}/expanded?include=memberIncomes&from=2026-13&to=2026-13`,
            `/api/accounts/${accountId}/month-view?month=2026-11-01`,
            `/api/accounts/${accountId}/planning?month=garbage`
        ]) {
            assert.equal((await utc.call('GET', path)).status, 400, path);
        }
    });

    await t.test('CAL-26: insight links carry the month as YYYY-MM', async () => {
        await db.collection('carryovers').insertOne({ accountId: new ObjectId(emptyAccountId), memberId: new ObjectId(member._id), month: new Date(anchor('2026-11')), amountMinor: 10_000_000, reason: 'large' });
        const overview = (await utc.call('GET', `/api/accounts/${emptyAccountId}/overview`)).json;
        const routes = overview.insights.flatMap((insight) => (insight.actions ?? []).map((action) => action.route)).filter((route) => route?.includes('month='));
        assert.ok(routes.length > 0, 'at least one insight links to a month');
        for (const route of routes) assert.match(route, /[?&]month=\d{4}-\d{2}(&|$)/, route);
        for (const insight of overview.insights.filter((i) => i.month)) assert.equal(insight.month, anchor('2026-11'), 'the insight month itself stays the ISO anchor');
    });
});
