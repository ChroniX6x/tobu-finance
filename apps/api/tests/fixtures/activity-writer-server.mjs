// Test-only HTTP/JWT domain adapter. Not imported by the app or packaged in the release.
import express from 'express';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
const uri = process.env.TEST_MONGODB_URI;
if (process.env.NODE_ENV !== 'test' || !uri || !new URL(uri).pathname.startsWith('/tobu_test_e04_') || !['127.0.0.1', 'localhost'].includes(new URL(uri).hostname)) throw new Error('Isolated E04 database required');
const { requireAuth } = await import('../../dist/src/auth/middleware.js');
const { requireAccountContext } = await import('../../dist/src/auth/account-context.js');
const { createSystemActor } = await import('../../dist/src/auth/system-actor.js');
const { commitActivity, writeActivityInSession, activityCommand } = await import('../../dist/src/services/activity-writer.js');
const { default: Transaction } = await import('../../dist/src/models/Transaction.js');
const { default: Account } = await import('../../dist/src/models/Account.js');
const { default: Member } = await import('../../dist/src/models/Member.js');
const { User } = await import('../../dist/src/auth/models.js');
await mongoose.connect(uri, { autoCreate: false, autoIndex: false, monitorCommands: true });
const id = (name) => createHash('sha256').update(`${process.env.TEST_FIXTURE_ID}:${name}`).digest('hex').slice(0, 24);
const oid = (name) => new mongoose.Types.ObjectId(id(name));
if (!(await User.exists({ _id: oid('user') }))) {
    await User.create({ _id: oid('user'), email: 'e04@example.test', emailNormalized: 'e04@example.test', passwordHash: 'test-fixture', roles: ['user'], isActive: true });
    await Member.create({ _id: oid('member'), name: 'Actor', userId: oid('user') });
    await Member.create({ _id: oid('payer'), name: 'Payer' });
    await Account.create({
        _id: oid('account'),
        members: [
            { memberId: oid('member'), role: 'owner' },
            { memberId: oid('payer'), role: 'member' }
        ]
    });
    await Account.create({ _id: oid('foreign-account'), members: [] });
    await Transaction.create({ _id: oid('foreign-subject'), accountId: oid('foreign-account'), title: 'Foreign', type: 'expense', amountMinor: 1000, month: new Date('2026-11-01T00:00:00Z'), isFromSharedAccount: true });
}
const app = express();
app.use(express.json(), requireAuth);
app.get('/read', async (_req, res) => res.json({ count: await Transaction.countDocuments({ accountId: oid('account') }) }));
app.get('/preview', async (_req, res) => res.json({ proposedAmount: 1000 }));
app.patch('/equal/:name', async (req, res) => {
    const context = await requireAccountContext(req, res, id('account'));
    if (!context) return;
    const subjectId = id(`${req.params.name}:parent`);
    const result = await commitActivity(
        context,
        activityCommand(`equal:${subjectId}:title:Domain`),
        [{ code: 'transaction.updated', subject: { kind: 'transaction', id: subjectId }, params: { transactionId: subjectId, changedFields: ['title'] } }],
        async (session) => {
            const current = await Transaction.findById(subjectId).session(session);
            if (current.title === req.body.title) return false;
            throw new Error('Fixture only permits equal patch');
        }
    );
    res.json(result);
});
app.post('/command/:name', async (req, res) => {
    const context = await requireAccountContext(req, res, req.body.foreignAccount ? id('foreign-account') : id('account'));
    if (!context) return;
    const name = req.params.name;
    const subjectId = id(`${name}:parent`),
        childId = id(`${name}:child`);
    const generatedCommand = activityCommand(`e04:${id('account')}:${subjectId}:create-v1`);
    const command = req.body.forgedCommand ? { ...generatedCommand } : generatedCommand;
    const authority = req.body.forged ? { actor: { kind: 'user', userId: id('payer') }, account: context.account } : req.body.system ? { accountId: id('account'), system: createSystemActor('automation', context.actor.userId) } : context;
    const intent = {
        code: req.body.code ?? 'transaction.created',
        subject: { kind: 'transaction', id: req.body.foreignSubject ? id('foreign-subject') : subjectId },
        params: { transactionId: subjectId, type: 'expense', amountMinor: req.body.amount ?? 1000, title: req.body.title ?? 'Fixture', ...(req.body.extraParams ?? {}) }
    };
    if (req.body.foreignSubject) intent.params.transactionId = id('foreign-subject');
    const intents = req.body.fanout
        ? [intent, { code: 'transaction.splitChildCreated', subject: { kind: 'transaction', id: childId }, params: { transactionId: childId, parentTransactionId: subjectId, type: 'expense', amountMinor: 333 } }]
        : [intent];
    const mutate = async (session) => {
        if (req.body.noop) return false;
        if (req.body.invalid) throw Object.assign(new Error('DOMAIN_INVALID'), { status: req.body.invalid });
        await Transaction.create([{ _id: subjectId, accountId: id('account'), title: 'Domain', type: 'expense', amountMinor: 1000, month: new Date('2026-11-01T00:00:00Z'), isFromSharedAccount: false, paidByMemberId: id('payer') }], { session });
        if (req.body.failAfterDomain) throw new Error('DOMAIN_AFTER_WRITE');
        await Transaction.create(
            [{ _id: childId, parentTransactionId: subjectId, accountId: id('account'), title: 'Child', type: 'expense', amountMinor: 333, month: new Date('2026-11-01T00:00:00Z'), isFromSharedAccount: false, paidByMemberId: id('payer') }],
            { session }
        );
        return true;
    };
    let result;
    if (req.body.pauseBeforeCommit) {
        result = await mongoose.connection.transaction(async (session) => {
            const value = await writeActivityInSession(session, authority, command, intents, mutate);
            process.send({ checkpoint: 'before-commit' });
            await new Promise(() => {});
            return value;
        });
    } else if (req.body.existingSession) result = await mongoose.connection.transaction((session) => writeActivityInSession(session, authority, command, intents, mutate));
    else result = await commitActivity(authority, command, intents, mutate);
    if (req.body.pauseAfterCommit) {
        process.send({ checkpoint: 'after-commit' });
        await new Promise(() => {});
    }
    if (req.body.lostReply) return req.socket.destroy();
    res.status(result.outcome === 'applied' ? 201 : 200).json(result);
});
app.use((error, _req, res, next) => {
    void next; // Express recognizes an error handler by its four parameters.
    res.status(error.status ?? (error.name === 'ZodError' ? 422 : 500)).json({ error: error.message.startsWith('ACTIVITY_') ? error.message : 'TEST_FAILURE' });
});
const server = app.listen(0, '127.0.0.1', () => process.send({ port: server.address().port, userId: id('user'), accountId: id('account'), payerId: id('payer') }));
// Wire-level evidence from the actual driver, with no payload/credentials logged.
mongoose.connection.getClient().on('commandStarted', (event) => {
    if (['insert', 'commitTransaction', 'abortTransaction'].includes(event.commandName))
        process.send({ command: event.commandName, collection: event.command.insert, transaction: event.command.txnNumber?.toString(), lsid: event.command.lsid?.id.toString('hex') });
});
