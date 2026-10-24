import { MongoClient } from 'mongodb';
import { MigrationRunner } from '../../dist/src/database/migration-runner.js';
import { entry } from './migration-fixture.mjs';
const client = new MongoClient(process.env.TEST_MONGODB_URI);
await client.connect();
const runner = new MigrationRunner(client, client.db(), process.env.TEST_MONGODB_URI, 'test', [
    entry({
        pause: async () => {
            process.send('inside-transaction');
            await new Promise(() => {});
        }
    })
]);
try {
    const plan = await runner.plan();
    await runner.run('up', plan.confirmation, true);
} finally {
    await client.close();
}
