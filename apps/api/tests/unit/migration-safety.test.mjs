import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MongoServerError } from 'mongodb';
import { maintenanceCheck } from '../../dist/src/database/maintenance.js';
import { MigrationDiagnosticError, migrationErrorMessage } from '../../dist/src/database/migration-errors.js';

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
