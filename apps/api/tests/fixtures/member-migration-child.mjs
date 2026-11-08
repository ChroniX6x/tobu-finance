import { MongoClient } from 'mongodb';
import { MigrationRunner } from '../../dist/src/database/migration-runner.js';
import { ToolsBackup } from '../../dist/src/database/migration-backup.js';
import { migrations } from '../../dist/src/database/migration-catalog.js';
const uri = process.env.TEST_MONGODB_URI;
if (process.env.NODE_ENV !== 'test' || !uri || !new URL(uri).pathname.startsWith('/tobu_test_e05_migration_')) throw new Error('Explicit isolated E05 database required');
const client = await new MongoClient(uri).connect();
const db = client.db();
const entries = migrations.filter((e) => ['20261105221750028-event-envelope', '20261107163516618-member-activity'].includes(e.id)).map((entry) => ({ ...entry, migration: { ...entry.migration, up: entry.migration.up.map((step) => ({ ...step })) } }));
const last = entries.at(-1);
const apply = last.migration.up[0].apply;
last.migration.up[0].apply = async (context) => {
    await apply(context);
    process.send({ checkpoint: 'e05-validator-applied-tools-stopped' });
    await new Promise(() => {});
};
const runner = new MigrationRunner(client, db, uri, 'test', entries, { backup: new ToolsBackup(client, db, uri, process.env.TEST_BACKUP_ROOT, 'docker-local') });
await runner.run('up', (await runner.plan()).confirmation, true);
