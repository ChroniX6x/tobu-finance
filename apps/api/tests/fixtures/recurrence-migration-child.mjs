import { MongoClient } from 'mongodb';
import { MigrationRunner } from '../../dist/src/database/migration-runner.js';
import { ToolsBackup } from '../../dist/src/database/migration-backup.js';
import { migrations } from '../../dist/src/database/migration-catalog.js';
const uri = process.env.TEST_MONGODB_URI;
if (process.env.NODE_ENV !== 'test' || !uri || !new URL(uri).pathname.startsWith('/tobu_test_e07_migration_') || !['localhost', '127.0.0.1'].includes(new URL(uri).hostname)) throw new Error('Isolated E07 migration target required');
const client = await new MongoClient(uri).connect();
const db = client.db();
const entries = migrations.filter((entry) => entry.id <= '20261108172127336-recurrence-activity-primitives').map((entry) => ({ ...entry, migration: { ...entry.migration, up: entry.migration.up.map((step) => ({ ...step })) } }));
const last = entries.at(-1),
    apply = last.migration.up[0].apply;
last.migration.up[0].apply = async (context) => {
    await apply(context);
    process.send({ checkpoint: 'e07-validator-applied-tools-stopped' });
    await new Promise(() => {});
};
const runner = new MigrationRunner(client, db, uri, 'test', entries, { backup: new ToolsBackup(client, db, uri, process.env.TEST_BACKUP_ROOT, 'docker-local') });
const plan = await runner.plan();
if (plan.migrations.length !== 1 || plan.migrations[0].id !== last.id) throw new Error('All E07 predecessors must already be applied');
await runner.run('up', plan.confirmation, true);
