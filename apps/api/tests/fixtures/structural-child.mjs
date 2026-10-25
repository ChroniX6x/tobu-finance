import { MongoClient } from 'mongodb';
import { MigrationRunner } from '../../dist/src/database/migration-runner.js';
import { ToolsBackup } from '../../dist/src/database/migration-backup.js';
import { structuralEntry } from './structural-fixture.mjs';

const uri = process.env.TEST_MONGODB_URI;
const client = await new MongoClient(uri).connect();
const backup = new ToolsBackup(client, client.db(), uri, process.env.TEST_BACKUP_ROOT, 'docker-local');
const entry = structuralEntry({
    afterRename: async () => {
        process.send({ renamed: true });
        await new Promise(() => {});
    }
});
const runner = new MigrationRunner(client, client.db(), uri, 'test', [entry], { backup });
await runner.run('up', (await runner.plan()).confirmation, true);
