import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MongoServerError } from 'mongodb';
import { maintenanceCheck } from '../../dist/src/database/maintenance.js';
import { MigrationDiagnosticError, migrationErrorMessage } from '../../dist/src/database/migration-errors.js';
import { findLocalMongoContainer } from '../../dist/src/database/migration-backup.js';

test('maintenance coalesces reads but never caches an unlocked or failed result', async () => {
    let reads = 0,
        locked = false,
        time = 100,
        fail = false;
    const check = maintenanceCheck(
        async () => {
            reads++;
            if (fail) throw new Error('unavailable');
            return locked;
        },
        () => time
    );
    assert.deepEqual(await Promise.all([check(), check(), check()]), [false, false, false]);
    assert.equal(reads, 1);
    locked = true;
    assert.equal(await check(), true);
    locked = false;
    assert.equal(await check(), true);
    assert.equal(reads, 2);
    time += 1001;
    fail = true;
    await assert.rejects(check(), /unavailable/);
    fail = false;
    assert.equal(await check(), false);
    assert.equal(reads, 4);
});

test('CLI diagnostics expose trusted messages but never driver data or spoofed names', () => {
    const safe = new MigrationDiagnosticError('Missing or modified migration/history');
    assert.equal(migrationErrorMessage(safe), safe.message);
    assert.match(migrationErrorMessage(new MigrationDiagnosticError('Migration stopped; recovery required', { cause: safe })), /Missing or modified/);
    for (const error of [new Error('mongodb://secret@host/private'), new MongoServerError({ message: 'private finance data' }), Object.assign(new Error('secret'), { name: 'MigrationDiagnosticError' })]) {
        assert.match(migrationErrorMessage(error), /private driver details are suppressed/);
        assert.doesNotMatch(migrationErrorMessage(new MigrationDiagnosticError('Recovery required', { cause: error })), /secret|private finance/);
    }
});

const mongoContainer = (id, hostPort, running = true) => JSON.stringify([{ Id: id, State: { Running: running }, NetworkSettings: { Ports: { '27017/tcp': [{ HostIp: '127.0.0.1', HostPort: hostPort }] } } }]);
const fakeDocker =
    (containers, calls = []) =>
    async (args) => {
        calls.push(args.join(' '));
        if (args[0] === 'ps') return `${Object.keys(containers).join('\n')}\n`;
        const entry = containers[args[1]];
        if (entry instanceof Error) throw entry;
        return entry;
    };
const goneError = (id) => Object.assign(new Error(`Command failed: docker inspect ${id}`), { code: 1, stderr: `error: no such object: ${id}\n` });

test('local container lookup skips containers that disappear between ps and inspect', async () => {
    const calls = [];
    const docker = fakeDocker({ other: goneError('other'), target: mongoContainer('full-target-id', '27018'), unrelated: mongoContainer('full-unrelated-id', '27019') }, calls);
    assert.equal(await findLocalMongoContainer('27018', docker), 'full-target-id');
    assert.deepEqual(calls, ['ps --format {{.ID}}', 'inspect other', 'inspect target', 'inspect unrelated']);
});

test('local container lookup still refuses missing, ambiguous and stopped targets', async () => {
    await assert.rejects(findLocalMongoContainer('27018', fakeDocker({ gone: goneError('gone') })), /Cannot identify the explicitly selected local MongoDB container/);
    await assert.rejects(findLocalMongoContainer('27018', fakeDocker({ stopped: mongoContainer('stopped-id', '27018', false) })), /Cannot identify/);
    await assert.rejects(findLocalMongoContainer('27018', fakeDocker({ a: mongoContainer('a-id', '27018'), b: mongoContainer('b-id', '27018') })), /Cannot identify/);
    assert.equal(await findLocalMongoContainer('27018', fakeDocker({ half: JSON.stringify([{ Id: 'half-id', State: { Running: true }, NetworkSettings: { Ports: null } }]), target: mongoContainer('target-id', '27018') })), 'target-id');
});

test('local container lookup does not hide other Docker failures', async () => {
    const denied = Object.assign(new Error('permission denied'), { code: 1, stderr: 'permission denied while trying to connect to the Docker daemon socket' });
    await assert.rejects(findLocalMongoContainer('27018', fakeDocker({ target: mongoContainer('target-id', '27018'), broken: denied })), denied);
    await assert.rejects(findLocalMongoContainer('27018', fakeDocker({ broken: '{not json' })), SyntaxError);
    const missingCli = Object.assign(new Error('spawn docker ENOENT'), { code: 'ENOENT' });
    await assert.rejects(findLocalMongoContainer('27018', fakeDocker({ broken: missingCli })), missingCli);
    await assert.rejects(
        findLocalMongoContainer('27018', async () => {
            throw denied;
        }),
        denied
    );
});

test('local container lookup recognises both Docker spellings of a missing container and empty results', async () => {
    for (const stderr of ['Error: No such object: gone', 'Error: No such container: gone']) {
        const gone = Object.assign(new Error('Command failed'), { code: 1, stderr });
        assert.equal(await findLocalMongoContainer('27018', fakeDocker({ gone, target: mongoContainer('target-id', '27018') })), 'target-id');
    }
    assert.equal(await findLocalMongoContainer('27018', fakeDocker({ empty: '[]', target: mongoContainer('target-id', '27018') })), 'target-id');
    await assert.rejects(findLocalMongoContainer('27018', fakeDocker({})), /Cannot identify the explicitly selected local MongoDB container/);
});
