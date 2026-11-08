// TEST-ONLY generic domain adapter. No production router, recurrence model, ensure, revision logic or delete eligibility.
import express from 'express';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { recurrenceActivitySamples } from './recurrence-activity-samples.mjs';
const uri = process.env.TEST_MONGODB_URI;
if (process.env.NODE_ENV !== 'test' || !uri || !new URL(uri).pathname.startsWith('/tobu_test_e07_') || !['127.0.0.1', 'localhost'].includes(new URL(uri).hostname)) throw new Error('Isolated E07 database required');
const { requireAuth } = await import('../../dist/src/auth/middleware.js');
const { requireAccountContext } = await import('../../dist/src/auth/account-context.js');
const { createSystemActor } = await import('../../dist/src/auth/system-actor.js');
const { activityCommand, activityBatch } = await import('../../dist/src/services/activity-writer.js');
const { commitRecurrenceActivity, writeRecurrenceActivityInSession } = await import('../../dist/src/services/recurrence-activity.js');
const { createRecurrenceActivityScope } = await import('../../dist/src/services/recurrence-activity-scope.js');
const { readAccountActivity, previewActivity } = await import('../../dist/src/services/activity-read.js');
const { default: Account } = await import('../../dist/src/models/Account.js');
const { default: Member } = await import('../../dist/src/models/Member.js');
const { default: Transaction } = await import('../../dist/src/models/Transaction.js');
const { User } = await import('../../dist/src/auth/models.js');
await mongoose.connect(uri, { autoCreate: false, autoIndex: false, monitorCommands: true });
const id = (name) => createHash('sha256').update(`${process.env.TEST_FIXTURE_ID}:${name}`).digest('hex').slice(0, 24);
const oid = (name) => new mongoose.Types.ObjectId(id(name));
if (!(await User.exists({ _id: oid('owner') }))) {
    for (const name of ['owner', 'member', 'outsider'])
        await User.create({ _id: oid(name), email: `e07-${name}@example.test`, emailNormalized: `e07-${name}@example.test`, passwordHash: 'test-fixture', roles: name === 'outsider' ? ['admin'] : ['user'], isActive: true });
    for (const name of ['owner', 'member']) await Member.create({ _id: oid(name + '-member'), name: name === 'owner' ? 'Actor <script>test</script>' : 'Member', userId: oid(name) });
    await Member.create({ _id: oid('payer'), name: 'Unregistered payer' });
    await Account.create({
        _id: oid('account'),
        members: [
            { memberId: oid('owner-member'), role: 'owner' },
            { memberId: oid('member-member'), role: 'member' },
            { memberId: oid('payer'), role: 'member' }
        ]
    });
    await Account.create({ _id: oid('foreign-account'), members: [] });
    for (const [name, accountId, amountMinor, parentTransactionId] of [
        ['transaction', oid('account'), 12345, null],
        ['foreign-transaction', oid('foreign-account'), 54321, null],
        ['child-transaction', oid('account'), 100, oid('transaction')]
    ])
        await Transaction.create({
            _id: oid(name),
            accountId,
            title: 'Financial fixture: unchanged',
            type: 'expense',
            amountMinor,
            parentTransactionId,
            month: new Date('2026-11-01T00:00:00.000Z'),
            status: 'pending',
            isFromSharedAccount: false,
            paidByMemberId: oid('payer')
        });
    await Transaction.create({
        _id: oid('new-transaction'),
        accountId: oid('account'),
        title: 'Second immutable financial fixture',
        type: 'expense',
        amountMinor: 11111,
        parentTransactionId: null,
        month: new Date('2026-11-01T00:00:00.000Z'),
        status: 'pending',
        isFromSharedAccount: true
    });
    await mongoose.connection.db.createCollection('e07_generic_domain');
    await mongoose.connection.db.collection('e07_generic_domain').createIndex({ accountId: 1, recurrenceId: 1, occurrenceKey: 1 }, { unique: true, partialFilterExpression: { kind: 'occurrence' }, name: 'fixture_slot_unique' });
}
const generic = mongoose.connection.db.collection('e07_generic_domain');
const app = express();
app.use(express.json(), requireAuth);
app.get('/read', async (req, res) => res.json(await readAccountActivity(req, id('account'), req.query)));
app.get('/preview', async (req, res) => res.json(previewActivity(await readAccountActivity(req, id('account'), { limit: 20 }))));
app.post('/platform/:name', async (req, res) => {
    const context = await requireAccountContext(req, res, id('account'));
    if (!context) return;
    const name = req.params.name;
    const ids = Object.fromEntries(['recurrence', 'revision', 'previousRevision', 'occurrence', 'previousRecurrence', 'previousOccurrence'].map((key) => [key, id(name + ':' + key)]));
    ids.transaction = id('transaction');
    const [kind, subjectId, params] = recurrenceActivitySamples(ids)[req.body.code];
    const intent = { code: req.body.code, subject: { kind, id: subjectId }, params: { ...params, ...req.body.params } };
    if (req.body.subject) intent.subject = req.body.subject;
    if (req.body.upperIds) {
        intent.subject.id = intent.subject.id.toUpperCase();
        for (const key of Object.keys(intent.params)) if (key.endsWith('Id')) intent.params[key] = intent.params[key].toUpperCase();
    }
    let cached;
    let lookups = 0;
    const validScope = createRecurrenceActivityScope(async ({ session, kind: refKind, id: refId, accountId: scopeAccountId, attest }) => {
        lookups++;
        if (req.body.scopeThrows || (req.body.scopeThrowsAfterMutation && lookups > 1)) throw new Error('FIXTURE_SCOPE_FAILURE');
        if (req.body.cachedWitness && cached) return cached;
        const row = await generic.findOne({ _id: new mongoose.Types.ObjectId(refId), kind: refKind, accountId: new mongoose.Types.ObjectId(scopeAccountId) }, { session });
        if (!row) return null;
        if (req.body.reuseSession) {
            await session.abortTransaction();
            session.startTransaction();
        }
        const proof = attest({
            kind: row.kind,
            id: String(row._id),
            accountId: req.body.wrongTenantWitness ? id('foreign-account') : String(row.accountId),
            ...(row.kind !== 'recurrence' ? { recurrenceId: String(row.recurrenceId) } : {}),
            ...(row.kind === 'occurrence' ? { occurrenceKey: row.occurrenceKey, transactionId: row.transactionId ? String(row.transactionId) : null } : {})
        });
        cached = proof;
        return req.body.copiedWitness ? { ...proof } : proof;
    });
    const scope = req.body.missingScope ? undefined : req.body.forgedScope ? { ...validScope } : validScope;
    const authority = req.body.forgedActor ? { ...context } : req.body.system ? { accountId: id('account'), system: createSystemActor('account_open', context.actor.userId) } : context;
    const batch = req.body.batch ? activityBatch(`e07:${id('account')}:fixture-batch`) : undefined;
    const command = activityCommand(`e07:${id('account')}:${name}:${intent.code}:v1`, req.body.forgedBatch ? { ...activityBatch('forged-copy') } : batch);
    const intents =
        req.body.releaseAndGenerate || req.body.unlinkAndGenerate
            ? [intent, { code: 'occurrence.generated', subject: intent.subject, params: { ...recurrenceActivitySamples(ids)['occurrence.generated'][2], ...(req.body.unlinkAndGenerate ? { transactionId: id('new-transaction') } : {}) } }]
            : [intent];
    const mutate = async (session) => {
        if (req.body.reject) throw Object.assign(new Error('FIXTURE_DOMAIN_REJECTED'), { status: 409 });
        if (req.body.noop) return false;
        const rec = new mongoose.Types.ObjectId(ids.recurrence);
        const accountId = oid('account');
        if (intent.code === 'recurrence.created') {
            await generic.insertOne({ _id: rec, kind: 'recurrence', accountId, value: 1 }, { session });
            await generic.insertOne({ _id: new mongoose.Types.ObjectId(ids.revision), kind: 'revision', accountId, recurrenceId: rec }, { session });
        } else if (intent.code === 'recurrence.deleted') await generic.deleteMany({ $or: [{ _id: rec }, { recurrenceId: rec }] }, { session });
        else if (intent.code === 'recurrence.config.updated') {
            await generic.updateOne({ _id: rec }, { $inc: { value: 1 } }, { session });
            await generic.insertOne({ _id: new mongoose.Types.ObjectId(ids.revision), kind: 'revision', accountId, recurrenceId: rec }, { session });
        } else if (intent.code.startsWith('recurrence.')) await generic.updateOne({ _id: rec }, { $inc: { value: 1 } }, { session });
        else {
            const occurrenceId = new mongoose.Types.ObjectId(ids.occurrence);
            if (intent.code === 'occurrence.reassigned') await generic.updateOne({ _id: new mongoose.Types.ObjectId(ids.previousOccurrence) }, { $set: { transactionId: null } }, { session });
            const linked = ['occurrence.generated', 'occurrence.linked', 'occurrence.reassigned'].includes(intent.code);
            await generic.updateOne(
                { _id: occurrenceId },
                { $set: { kind: 'occurrence', accountId, recurrenceId: rec, occurrenceKey: '2026-11', transactionId: req.body.unlinkAndGenerate ? oid('new-transaction') : linked ? oid('transaction') : null }, $inc: { value: 1 } },
                { session, upsert: true }
            );
        }
        if (req.body.afterWriteFault) throw new Error('FIXTURE_AFTER_WRITE');
        return true;
    };
    const result = req.body.existingSession
        ? await mongoose.connection.transaction((session) => writeRecurrenceActivityInSession(session, authority, command, intents, scope, mutate))
        : await commitRecurrenceActivity(authority, command, intents, scope, mutate);
    if (req.body.lostReply) return req.socket.destroy();
    res.status(result.outcome === 'applied' ? 201 : 200).json(result);
});
app.use((error, _req, res, next) => {
    void next;
    const status =
        error.status ??
        (error.message === 'ACTIVITY_E07_OWNER_REQUIRED' || error.message === 'ACTIVITY_UNTRUSTED_AUTHORITY' ? 403 : error.name === 'ZodError' || error.message.startsWith('ACTIVITY_E07_') || error.message === 'ACTIVITY_UNTRUSTED_BATCH' ? 422 : 500);
    res.status(status).json({ error: error.message.startsWith('ACTIVITY_') ? error.message : 'TEST_FAILURE' });
});
const server = app.listen(0, '127.0.0.1', () =>
    process.send({ port: server.address().port, ownerId: id('owner'), memberId: id('member'), outsiderId: id('outsider'), accountId: id('account'), foreignAccountId: id('foreign-account'), transactionId: id('transaction') })
);
mongoose.connection.getClient().on('commandStarted', (event) => {
    if (['insert', 'update', 'delete', 'commitTransaction', 'abortTransaction'].includes(event.commandName))
        process.send({ command: event.commandName, collection: event.command[event.commandName], transaction: event.command.txnNumber?.toString(), lsid: event.command.lsid?.id.toString('hex') });
});
