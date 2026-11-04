import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
    ACTIVITY_TITLE_MAX,
    clipActivityText,
    ACTIVITY_CODES,
    ACTIVITY_NO_EVENT_CASES,
    ACTIVITY_RESERVED_CODE_PREFIXES,
    ACTIVITY_SCHEMA_VERSION,
    LEGACY_ACTIVITY_CODES,
    LEGACY_UNKNOWN_CODE,
    ActivityCursorPayloadSchema,
    ActivityItemSchema,
    ActivityPageSchema,
    ActivityQuerySchema,
    ActivityWriteEventSchema,
    activityCatalog,
    activityLabels,
    activityOpenApiSchemas,
    decodeStoredEvent,
    formatMinor,
    isReservedActivityCode,
    renderActivityActor,
    renderActivityText
} from '../dist/activity.js';
import { endpoints } from '../dist/endpoints.js';

const hex = (n) => String(n).padStart(24, '0');
const ACCOUNT = hex(1),
    USER = hex(2),
    TX = hex(3),
    MEMBER = hex(4),
    CAT = hex(5),
    RULE = hex(6),
    OTHER = hex(7);

// One valid param set per catalog code. A new code without a sample fails the completeness test below.
const samples = {
    'transaction.created': { transactionId: TX, type: 'expense', amountMinor: 1234, title: 'Miete', categoryId: CAT },
    'transaction.splitChildCreated': { transactionId: TX, parentTransactionId: OTHER, type: 'expense', amountMinor: 500 },
    'transaction.booked': { transactionId: TX, type: 'income', amountMinor: 100000, title: 'Gehalt' },
    'transaction.statusChanged': { transactionId: TX, from: 'pending', to: 'booked' },
    'transaction.updated': { transactionId: TX, changedFields: ['amountMinor', 'notes'], amountMinor: { from: 100, to: 250 } },
    'transaction.deleted': { transactionId: TX, type: 'expense', amountMinor: 1000, childCount: 2 },
    'transaction.splitChildDeleted': { transactionId: TX, parentTransactionId: OTHER },
    'category.created': { categoryId: CAT, name: 'Lebensmittel' },
    'category.updated': { categoryId: CAT, changedFields: ['customSplit'] },
    'category.deleted': { categoryId: CAT, name: null },
    'account.created': { currency: 'EUR' },
    'account.settings.updated': { changedFields: ['settings'] },
    'account.member.added': { memberId: MEMBER, role: 'member' },
    'account.member.removed': { memberId: MEMBER },
    'account.member.roleChanged': { memberId: MEMBER, from: 'member', to: 'owner' },
    'memberIncome.added': { memberId: MEMBER, amountMinor: 250000 },
    'memberIncome.updated': { memberId: MEMBER, amountMinor: 260000 },
    'memberIncome.removed': { memberId: MEMBER },
    'contributionRule.added': { ruleId: RULE, ruleType: 'additional', amountMinor: 5000 },
    'contributionRule.updated': { ruleId: RULE, ruleType: 'topup', amountMinor: 6000 },
    'contributionRule.removed': { ruleId: RULE, ruleType: 'topup' },
    'categoryBudget.added': { categoryId: CAT, amountMinor: 40000 },
    'categoryBudget.updated': { categoryId: CAT, amountMinor: 41000 },
    'categoryBudget.removed': { categoryId: CAT },
    'carryOver.set': { memberId: MEMBER, month: '2026-04', amountMinor: -1500 },
    'carryOver.removed': { memberId: MEMBER, month: null },
    'accountBalance.set': { month: '2026-04', closingBalanceMinor: -250 },
    'accountBalance.removed': { month: '2026-04' },
    'legacyRecurrence.created': { title: 'Netflix' },
    'legacyRecurrence.updated': {},
    'legacyRecurrence.deleted': { title: 'Netflix' }
};
const subjectIds = { transaction: TX, category: CAT, account: ACCOUNT, member: MEMBER, memberIncome: hex(8), contributionRule: RULE, categoryBudget: hex(9), carryOver: hex(10), accountBalance: hex(11), legacyRecurrence: hex(12) };
const userActor = { actor: { kind: 'user', userId: USER }, trigger: { kind: 'user_action' } };
const writeEvent = (code, extra = {}) => {
    const entry = activityCatalog[code];
    const params = samples[code];
    const id = entry.subjectId === 'accountId' ? ACCOUNT : entry.subjectId ? params[entry.subjectId] : subjectIds[entry.subject];
    return { accountId: ACCOUNT, date: new Date('2026-11-04T01:30:00.000Z'), schemaVersion: 1, code, params, ...userActor, subject: { kind: entry.subject, id }, correlationId: 'req-0001-abcd', ...extra };
};
const stored = (event, extra = {}) => ({ _id: hex(100), createdAt: new Date(), updatedAt: new Date(), __v: 0, ...event, ...extra });

test('catalog: complete, labelled, typed subjects, no recurrence family, legacy codes are a subset', () => {
    assert.equal(ACTIVITY_CODES.length, 31);
    assert.deepEqual([...ACTIVITY_CODES].sort(), Object.keys(samples).sort(), 'every code needs a sample (and vice versa)');
    assert.deepEqual([...ACTIVITY_CODES].sort(), Object.keys(activityLabels).sort(), 'every code needs a label');
    for (const code of ACTIVITY_CODES) {
        assert.equal(isReservedActivityCode(code), false, code);
        assert.equal(typeof renderActivityText({ code, params: samples[code] }), 'string');
        assert.notEqual(renderActivityText({ code, params: samples[code] }), 'Aktivität', `${code} must not fall back to the generic label`);
    }
    for (const code of LEGACY_ACTIVITY_CODES) assert.ok(ACTIVITY_CODES.includes(code), code);
    assert.deepEqual([...ACTIVITY_RESERVED_CODE_PREFIXES], ['recurrence.', 'occurrence.']);
    assert.ok(ACTIVITY_NO_EVENT_CASES.length >= 8);
});

test('write schema: every code accepts a valid user event and a valid system event', () => {
    for (const code of ACTIVITY_CODES) {
        assert.equal(ActivityWriteEventSchema.safeParse(writeEvent(code)).success, true, code);
        const system = writeEvent(code, { actor: { kind: 'system' }, trigger: { kind: 'account_open', initiatedByUserId: USER } });
        assert.equal(ActivityWriteEventSchema.safeParse(system).success, true, `${code} system`);
        assert.equal(ActivityWriteEventSchema.safeParse(writeEvent(code, { date: '2026-11-04T01:30:00.000Z' })).success, true, `${code} ISO instant`);
    }
});

test('write schema: invalid inputs are rejected (envelope, actor/trigger, subject, params, keys)', () => {
    const base = writeEvent('transaction.created');
    const reject = (label, event) => assert.equal(ActivityWriteEventSchema.safeParse(event).success, false, label);
    const noAccount = { ...base };
    delete noAccount.accountId;
    reject('missing accountId', noAccount);
    reject('bad accountId', { ...base, accountId: 'nope' });
    reject('unknown code', { ...base, code: 'transaction.exploded' });
    reject('reserved recurrence code', { ...base, code: 'recurrence.deleted', params: {} });
    reject('reserved occurrence code', { ...base, code: 'occurrence.generated', params: {} });
    reject('wrong schemaVersion', { ...base, schemaVersion: 2 });
    reject('missing actor', { ...base, actor: undefined });
    reject('forged actor kind', { ...base, actor: { kind: 'admin', userId: USER } });
    reject('user actor without userId', { ...base, actor: { kind: 'user' } });
    reject('system actor with userId', { ...base, actor: { kind: 'system', userId: USER } });
    reject('user actor with automation trigger', { ...base, trigger: { kind: 'automation' } });
    reject('system actor with user_action trigger', { ...base, actor: { kind: 'system' } });
    reject('user actor with initiatedByUserId', { ...base, trigger: { kind: 'user_action', initiatedByUserId: USER } });
    reject('unknown trigger kind', { ...base, actor: { kind: 'system' }, trigger: { kind: 'cron' } });
    reject('legacy_unknown actor is never storable', { ...base, actor: { kind: 'legacy_unknown' }, trigger: { kind: 'legacy_unknown' } });
    reject('subject kind mismatch', { ...base, subject: { kind: 'category', id: TX } });
    reject('subject id mismatch', { ...base, subject: { kind: 'transaction', id: OTHER } });
    reject('account subject must be the account', writeEvent('account.created', { subject: { kind: 'account', id: OTHER } }));
    reject('missing subject', { ...base, subject: undefined });
    reject('unknown top-level key (forged field)', { ...base, role: 'owner' });
    reject('createdByMemberId must not carry an actor', { ...base, createdByMemberId: MEMBER });
    reject('unknown param key', { ...base, params: { ...base.params, notes: 'secret' } });
    reject('negative amount', { ...base, params: { ...base.params, amountMinor: -1 } });
    reject('fractional amount', { ...base, params: { ...base.params, amountMinor: 1.5 } });
    reject('title too long', { ...base, params: { ...base.params, title: 'x'.repeat(121) } });
    reject('empty changedFields', writeEvent('transaction.updated', { params: { transactionId: TX, changedFields: [] } }));
    reject('duplicate changedFields', writeEvent('transaction.updated', { params: { transactionId: TX, changedFields: ['title', 'title'] } }));
    reject('status is not an updated field', writeEvent('transaction.updated', { params: { transactionId: TX, changedFields: ['status'] } }));
    reject('invalid month', writeEvent('carryOver.set', { params: { memberId: MEMBER, month: '2026-13', amountMinor: 1 } }));
    reject('invalid role', writeEvent('account.member.roleChanged', { params: { memberId: MEMBER, from: 'admin', to: 'owner' } }));
    reject('bad command key', { ...base, commandId: 'short' });
    reject('bad correlation key with spaces', { ...base, correlationId: 'a b c d e f g h' });
    reject('invalid date string', { ...base, date: '2026-11-04' });
    reject('offset instant', { ...base, date: '2026-11-04T02:30:00+01:00' });
});

test('decoder: new events roundtrip as USER and SYSTEM; user ids stay internal', () => {
    for (const code of ACTIVITY_CODES) {
        const decoded = decodeStoredEvent(stored(writeEvent(code)));
        assert.equal(decoded.ok, true, code);
        assert.equal(decoded.item.code, code);
        assert.equal(decoded.item.schemaVersion, ACTIVITY_SCHEMA_VERSION);
        assert.equal(decoded.item.occurredAt, '2026-11-04T01:30:00.000Z');
        assert.equal(decoded.item.actor.kind, 'user');
        assert.deepEqual(decoded.refs, { actorUserId: USER });
        assert.equal(JSON.stringify(decoded.item).includes(USER), false, 'user id must not be projected');
        assert.deepEqual(decoded.item.params, samples[code]);
        const wire = JSON.parse(JSON.stringify(decoded.item));
        assert.deepEqual(ActivityItemSchema.parse(wire), wire, `${code} roundtrip`);
    }
    const system = decodeStoredEvent(stored(writeEvent('account.created', { actor: { kind: 'system' }, trigger: { kind: 'account_open', initiatedByUserId: OTHER } })));
    assert.equal(system.item.actor.kind, 'system');
    assert.equal(system.item.trigger.kind, 'account_open');
    assert.deepEqual(system.refs, { initiatedByUserId: OTHER });
    assert.equal(renderActivityActor(system.item.actor), 'System');
    assert.equal(renderActivityActor({ kind: 'user', memberId: null, displayName: 'Anna' }), 'Anna');
    assert.equal(renderActivityActor({ kind: 'user', memberId: null, displayName: null }), 'Benutzer');
    assert.equal(renderActivityActor({ kind: 'unknown' }), 'Unbekannt (Altbestand)');
});

test('decoder: legacy events (as written by the 15 existing writers) are unknown actor, unchanged data, no invented user', () => {
    const legacyDocs = {
        'transaction.created': { transactionId: TX, type: 'expense', amountMinor: 1234, title: 'Miete', categoryId: CAT },
        'transaction.splitChildCreated': { transactionId: TX, parentTransactionId: OTHER, type: 'expense', amountMinor: 5 },
        'transaction.booked': { transactionId: TX, type: 'income', amountMinor: 7, title: undefined },
        'transaction.statusChanged': { transactionId: TX, from: 'pending', to: 'booked' },
        'transaction.splitChildDeleted': { transactionId: TX, parentTransactionId: OTHER },
        'account.member.added': { memberId: MEMBER },
        'account.member.removed': { memberId: MEMBER },
        'memberIncome.added': { memberId: MEMBER, amountMinor: 9 },
        'memberIncome.updated': { memberId: MEMBER, amountMinor: 9 },
        'memberIncome.removed': { memberId: MEMBER },
        'contributionRule.added': { ruleId: RULE, ruleType: 'additional', amountMinor: 1 },
        'contributionRule.updated': { ruleId: RULE, ruleType: 'topup', amountMinor: 1 },
        'contributionRule.removed': { ruleId: RULE, ruleType: 'topup' },
        'categoryBudget.added': { categoryId: CAT, amountMinor: 3 },
        'categoryBudget.updated': { categoryId: CAT, amountMinor: 3 },
        'categoryBudget.removed': { categoryId: CAT }
    };
    assert.deepEqual(Object.keys(legacyDocs).sort(), [...LEGACY_ACTIVITY_CODES].sort());
    const objectIdLike = (value) => ({ toHexString: () => value });
    for (const [code, params] of Object.entries(legacyDocs)) {
        const doc = { _id: objectIdLike(hex(100)), accountId: objectIdLike(ACCOUNT), date: new Date('2026-04-02T10:00:00.000Z'), code, params, createdByMemberId: objectIdLike(MEMBER), createdAt: new Date(), __v: 0 };
        const decoded = decodeStoredEvent(doc);
        assert.equal(decoded.ok, true, code);
        assert.equal(decoded.item.code, code);
        assert.equal(decoded.item.schemaVersion, 0);
        assert.deepEqual(decoded.item.actor, { kind: 'unknown' });
        assert.deepEqual(decoded.item.trigger, { kind: 'unknown' });
        assert.deepEqual(decoded.refs, {});
        assert.equal(JSON.stringify(decoded.item).includes(MEMBER), code.startsWith('account.member') || code.startsWith('memberIncome') ? true : false, 'createdByMemberId is never projected (memberId only as legitimate param)');
        const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
        assert.deepEqual(decoded.item.params, clean);
        assert.notEqual(renderActivityText(decoded.item), 'Aktivität', code);
        assert.deepEqual(ActivityItemSchema.parse(JSON.parse(JSON.stringify(decoded.item))), decoded.item);
    }
    const tx = decodeStoredEvent({ _id: hex(100), accountId: ACCOUNT, date: new Date('2026-04-02T10:00:00.000Z'), code: 'transaction.booked', params: legacyDocs['transaction.booked'] });
    assert.deepEqual(tx.item.subject, { kind: 'transaction', id: TX, deleted: false });
    const income = decodeStoredEvent({ _id: hex(100), accountId: ACCOUNT, date: new Date('2026-04-02T10:00:00.000Z'), code: 'memberIncome.added', params: legacyDocs['memberIncome.added'] });
    assert.equal(income.item.subject, null, 'legacy income events carry no income id: no guessed subject');
});

test('decoder: unknown or damaged documents degrade safely and never become a guessed actor', () => {
    const doc = (extra) => ({ _id: hex(100), accountId: ACCOUNT, date: new Date('2026-04-02T10:00:00.000Z'), ...extra });
    const unknown = decodeStoredEvent(doc({ code: 'foo.bar', params: { secret: 'x' } }));
    assert.deepEqual(unknown.item, {
        id: hex(100),
        accountId: ACCOUNT,
        occurredAt: '2026-04-02T10:00:00.000Z',
        schemaVersion: 0,
        code: LEGACY_UNKNOWN_CODE,
        actor: { kind: 'unknown' },
        trigger: { kind: 'unknown' },
        subject: null,
        params: { typeHint: 'foo' }
    });
    assert.equal(renderActivityText(unknown.item), 'Aktivität (foo)');
    assert.equal(decodeStoredEvent(doc({ code: '<script>alert(1)</script>', params: {} })).item.params.typeHint, undefined, 'unsafe type hints are dropped');
    assert.equal(decodeStoredEvent(doc({ code: 'recurrence.deleted', params: {} })).item.code, LEGACY_UNKNOWN_CODE, 'reserved family is unknown until E07');
    assert.equal(decodeStoredEvent(doc({ code: 'category.created', params: { categoryId: CAT, name: 'x' } })).item.code, LEGACY_UNKNOWN_CODE, 'new code without schemaVersion is not a legacy event');
    assert.equal(decodeStoredEvent(doc({ code: 'transaction.booked', params: { transactionId: TX } })).item.code, LEGACY_UNKNOWN_CODE, 'legacy known code with missing required params');
    const dropped = decodeStoredEvent(doc({ code: 'transaction.created', params: { transactionId: TX, type: 'expense', amountMinor: 5, title: '', categoryId: 'bad', extra: 'x' } }));
    assert.deepEqual(dropped.item.params, { transactionId: TX, type: 'expense', amountMinor: 5 }, 'invalid optional legacy fields and unknown keys are dropped');
    assert.equal(decodeStoredEvent(doc({ schemaVersion: 2, code: 'transaction.created', params: samples['transaction.created'] })).item.code, LEGACY_UNKNOWN_CODE, 'future schema version');
    const forged = writeEvent('transaction.created', { actor: { kind: 'user', userId: 'not-an-id' } });
    const forgedResult = decodeStoredEvent(stored(forged));
    assert.equal(forgedResult.item.code, LEGACY_UNKNOWN_CODE);
    assert.deepEqual(forgedResult.item.actor, { kind: 'unknown' });
    assert.deepEqual(forgedResult.refs, {});
    assert.deepEqual(decodeStoredEvent(doc({ date: '2026-04-02', code: 'transaction.created', params: {} })), { ok: false, reason: 'invalid_date' });
    assert.deepEqual(decodeStoredEvent(doc({ date: new Date('x'), code: 'a' })), { ok: false, reason: 'invalid_date' });
    assert.deepEqual(decodeStoredEvent({ ...doc({ code: 'a' }), _id: 'x' }), { ok: false, reason: 'invalid_id' });
    assert.deepEqual(decodeStoredEvent({ ...doc({ code: 'a' }), accountId: undefined }), { ok: false, reason: 'invalid_account' });
    for (const bad of [null, undefined, 5, 'x', [], new Date()]) assert.deepEqual(decodeStoredEvent(bad), { ok: false, reason: 'not_an_object' });
});

test('instants: date stays the persisted instant, occurredAt is UTC ISO independent of the process zone', () => {
    const instant = '2026-03-29T00:30:00.000Z';
    for (const input of [new Date(instant), instant]) {
        const decoded = decodeStoredEvent({ _id: hex(1), accountId: ACCOUNT, date: input, code: 'transaction.statusChanged', params: samples['transaction.statusChanged'] });
        assert.equal(decoded.item.occurredAt, instant);
    }
    assert.equal(decodeStoredEvent({ _id: hex(1), accountId: ACCOUNT, date: '2026-03-29T01:30:00.000+01:00', code: 'a' }).ok, false, 'offsets are not UTC instants');
});

test('renderer: money, escaping policy and sizes', () => {
    assert.equal(formatMinor(123456), '1.234,56 €');
    assert.equal(formatMinor(5), '0,05 €');
    assert.equal(formatMinor(-250), '-2,50 €');
    const xss = '<img src=x onerror=alert(1)>';
    assert.equal(renderActivityText({ code: 'transaction.created', params: { ...samples['transaction.created'], title: xss } }), `Angelegt: Ausgabe 12,34 €${' ('}${xss})`, 'text is returned verbatim; UIs bind it as text, never as HTML');
    assert.equal(renderActivityText({ code: 'transaction.updated', params: samples['transaction.updated'] }), 'Transaktion geändert (2 Felder)');
    assert.equal(renderActivityText({ code: 'nope', params: null }), 'Aktivität');
});

test('read API contract: query, page, cursor payload', () => {
    assert.deepEqual(ActivityQuerySchema.parse({}), { limit: 20 });
    assert.equal(ActivityQuerySchema.parse({ limit: '100' }).limit, 100);
    for (const bad of [{ limit: '0' }, { limit: '101' }, { limit: '1.5' }, { code: 'nope' }, { actorKind: 'admin' }, { from: '2026-01-01' }, { accountId: ACCOUNT }, { subjectId: 'x' }, { cursor: '' }]) {
        assert.equal(ActivityQuerySchema.safeParse(bad).success, false, JSON.stringify(bad));
    }
    assert.equal(ActivityQuerySchema.safeParse({ code: 'transaction.created', subjectKind: 'transaction', subjectId: TX, actorKind: 'system', from: '2026-01-01T00:00:00.000Z', to: '2026-02-01T00:00:00.000Z', cursor: 'abc' }).success, true);
    const item = decodeStoredEvent(stored(writeEvent('transaction.booked'))).item;
    assert.equal(ActivityPageSchema.safeParse({ items: [item], nextCursor: null }).success, true);
    assert.equal(ActivityPageSchema.safeParse({ items: Array(101).fill(item), nextCursor: null }).success, false);
    assert.equal(ActivityPageSchema.safeParse({ items: [{ ...item, actor: { kind: 'user', userId: USER } }], nextCursor: null }).success, false, 'user ids are not part of the read model');
    assert.equal(ActivityPageSchema.safeParse({ items: [{ ...item, code: 'category.created' }], nextCursor: null }).success, false, 'params must match the code');
    assert.equal(ActivityCursorPayloadSchema.safeParse({ v: 1, accountId: ACCOUNT, date: '2026-11-04T01:30:00.000Z', id: TX, filter: 'f0' }).success, true);
    assert.equal(ActivityCursorPayloadSchema.safeParse({ v: 1, accountId: ACCOUNT, date: '2026-11-04', id: TX, filter: 'f0' }).success, false);
});

test('platform: no client route can create events; OpenAPI schemas are published', async () => {
    assert.deepEqual(
        endpoints.filter((e) => /activit|event/i.test(e.path) && e.method !== 'get'),
        []
    );
    assert.deepEqual(Object.keys(activityOpenApiSchemas), ['ActivityItem', 'ActivityPage', 'ActivityQuery']);
    assert.equal(
        Object.keys(await import('../dist/activity.js')).some((name) => /^(Create|Update|Patch).*Activity|Activity.*(Create|Request)/.test(name)),
        false,
        'no request schema creates events'
    );
});

test('review fixes: text clipping, deleted default, zone independence, hostile codes, OpenAPI refs', async () => {
    assert.equal(clipActivityText('  Miete  ', 120), 'Miete');
    assert.equal(clipActivityText('   ', 120), undefined);
    assert.equal(clipActivityText(null, 120), undefined);
    assert.equal(Array.from(clipActivityText('😀'.repeat(200), 120)).length, 120);
    assert.equal(ActivityWriteEventSchema.safeParse(writeEvent('transaction.created', { params: { ...samples['transaction.created'], title: clipActivityText('x'.repeat(500), ACTIVITY_TITLE_MAX) } })).success, true);
    for (const code of ['transaction.deleted', 'transaction.splitChildDeleted', 'category.deleted', 'memberIncome.removed', 'legacyRecurrence.deleted', 'account.member.removed']) {
        assert.equal(decodeStoredEvent(stored(writeEvent(code))).item.subject.deleted, true, code);
    }
    assert.equal(decodeStoredEvent(stored(writeEvent('transaction.created'))).item.subject.deleted, false);
    assert.equal(decodeStoredEvent({ _id: hex(1), accountId: ACCOUNT, date: new Date('2026-04-02T10:00:00.000Z'), code: 'transaction.splitChildDeleted', params: { transactionId: TX, parentTransactionId: OTHER } }).item.subject.deleted, true);
    for (const code of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
        const decoded = decodeStoredEvent({ _id: hex(1), accountId: ACCOUNT, date: new Date('2026-04-02T10:00:00.000Z'), code, params: {} });
        assert.equal(decoded.item.code, LEGACY_UNKNOWN_CODE, code);
        assert.equal(ActivityItemSchema.safeParse(JSON.parse(JSON.stringify(decoded.item))).success, true, `${code} unknown item matches the read schema`);
        assert.equal(renderActivityText({ code, params: {} }), 'Aktivität');
    }
    assert.equal(renderActivityText({ code: 'transaction.created', params: null }), 'Aktivität', 'broken params never throw');
    const cyclic = { _id: hex(1), accountId: ACCOUNT, date: new Date(), code: 'x', params: {} };
    cyclic.params.self = cyclic;
    assert.deepEqual(decodeStoredEvent(cyclic), { ok: false, reason: 'undecodable' }, 'hostile documents never throw');
    const legacyWithActor = decodeStoredEvent({
        _id: hex(1),
        accountId: ACCOUNT,
        date: new Date('2026-04-02T10:00:00.000Z'),
        code: 'memberIncome.removed',
        params: { memberId: MEMBER },
        actor: { kind: 'user', userId: USER },
        trigger: { kind: 'user_action' }
    });
    assert.deepEqual(legacyWithActor.item.actor, { kind: 'unknown' }, 'an actor field without schemaVersion is ignored');
    assert.deepEqual(legacyWithActor.refs, {});
    const nullOptional = decodeStoredEvent({ _id: hex(1), accountId: ACCOUNT, date: new Date('2026-04-02T10:00:00.000Z'), code: 'transaction.booked', params: { transactionId: TX, type: 'income', amountMinor: 1, title: null } });
    assert.deepEqual(nullOptional.item.params, { transactionId: TX, type: 'income', amountMinor: 1 });
    for (const code of ACTIVITY_CODES) {
        const wrongKind = activityCatalog[code].subject === 'transaction' ? 'category' : 'transaction';
        assert.equal(ActivityWriteEventSchema.safeParse(writeEvent(code, { subject: { kind: wrongKind, id: OTHER } })).success, false, `${code} wrong subject kind`);
        const base = writeEvent(code);
        if (activityCatalog[code].subjectId) assert.equal(ActivityWriteEventSchema.safeParse({ ...base, subject: { ...base.subject, id: hex(999) } }).success, false, `${code} wrong subject id`);
    }
    assert.equal(ActivityQuerySchema.safeParse({ from: '2026-02-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' }).success, false);
    assert.equal(ActivityQuerySchema.safeParse({ from: '2026-01-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' }).success, false, 'to is exclusive');

    const script = "import('./dist/activity.js').then(m=>{const r=m.decodeStoredEvent({_id:'000000000000000000000001',accountId:'000000000000000000000002',date:new Date('2026-03-29T00:30:00.000Z'),code:'a'});console.log(r.item.occurredAt)})";
    for (const TZ of ['America/Los_Angeles', 'Asia/Kiritimati', 'Pacific/Pago_Pago', 'Europe/Berlin']) {
        const out = execFileSync(process.execPath, ['-e', script], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, TZ }, encoding: 'utf8' }).trim();
        assert.equal(out, '2026-03-29T00:30:00.000Z', TZ);
    }

    const openapi = readFileSync(fileURLToPath(new URL('../../../apps/api/docs/openapi.yaml', import.meta.url)), 'utf8');
    assert.equal(openapi.includes('#/$defs/'), false, 'no unresolved $defs reference');
    const defined = new Set([...openapi.matchAll(/^ {4}([A-Za-z0-9_]+):$/gm)].map((m) => m[1]));
    for (const [, name] of openapi.matchAll(/\$ref: '?#\/components\/schemas\/([A-Za-z0-9_]+)'?/g)) assert.ok(defined.has(name), `schema ${name} is defined`);
});
