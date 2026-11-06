import { MongoClient } from 'mongodb';
import { MigrationRunner } from '../../dist/src/database/migration-runner.js';
import { ToolsBackup } from '../../dist/src/database/migration-backup.js';
import { preparationEntry } from './e03-event-preparation.mjs';
const uri = process.env.TEST_MONGODB_URI;
if (process.env.NODE_ENV !== 'test' || !uri || !new URL(uri).pathname.startsWith('/tobu_test_e03_')) throw new Error('Explicit isolated E03 database required');
const client = await new MongoClient(uri).connect();
const db = client.db(),
    entry = preparationEntry();
const apply = entry.migration.up[0].apply;
entry.migration.up[0].apply = async (context) => {
    await apply(context);
    process.send({ checkpoint: 'validator-applied-tools-stopped' });
    await new Promise(() => {});
};
const backup = new ToolsBackup(client, db, uri, process.env.TEST_BACKUP_ROOT, 'docker-local');
const runner = new MigrationRunner(client, db, uri, 'test', [entry], { backup });
await runner.run('up', (await runner.plan()).confirmation, true);
