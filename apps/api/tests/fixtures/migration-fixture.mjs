import assert from 'node:assert/strict';
export function entry({ failUp = false, failDown = false, pause = async () => {} } = {}) {
    return {
        id: '20261024000000000-test',
        checksum: 'a'.repeat(64),
        migration: {
            type: 'transactional',
            predecessor: '2026-10-v1',
            description: 'Integration fixture',
            namespaces: ['migration_test'],
            async preUp(context) {
                assert.equal(await context.count('migration_test', { revision: { $exists: true } }), 0);
            },
            async up(context) {
                await context.updateMany('migration_test', {}, { $set: { revision: 1 } });
                await pause();
                if (failUp) throw new Error('forced-up-failure');
            },
            async verifyUp(context) {
                assert.equal(await context.count('migration_test', { revision: 1 }), 2);
            },
            async preDown(context) {
                assert.equal(await context.count('migration_test', { revision: 1 }), 2);
            },
            async down(context) {
                await context.updateMany('migration_test', {}, { $unset: { revision: '' } });
                if (failDown) throw new Error('forced-down-failure');
            },
            async verifyDown(context) {
                assert.equal(await context.count('migration_test', { revision: { $exists: true } }), 0);
            }
        }
    };
}
