import { MongoClient } from 'mongodb';
import { MigrationRunner } from './migration-runner.js';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Explicit MONGODB_URI required');
const command = process.argv[2] ?? 'status';
const option = (key: string) => process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, readPreference: 'primary' });
try {
    if (!['status', 'plan', 'up', 'down', 'recover'].includes(command)) throw new Error('Use status, plan, up, down or recover');
    await client.connect();
    const runner = new MigrationRunner(client, client.db(), uri, process.env.NODE_ENV ?? 'development');
    const direction = command === 'down' || (command === 'plan' && option('direction') === 'down') ? 'down' : 'up';
    if (['status', 'plan'].includes(command)) console.log(JSON.stringify(await runner.plan(direction), null, 2));
    else {
        const confirm = option('confirm') ?? '';
        const stopped = option('writers-stopped') === client.db().databaseName;
        if (command === 'recover') console.log(await runner.recover(confirm, option('runner-stopped') ?? '', stopped));
        else console.log(await runner.run(direction, confirm, stopped));
    }
} catch (error) {
    // No raw driver errors/URIs: server errors may include document contents or credentials.
    console.error(error instanceof Error && error.message.startsWith('Migration stopped;') ? error.message : 'Migration command failed. Check target, plan, history and maintenance prerequisites; no successful outcome is claimed.');
    process.exitCode = 1;
} finally {
    await client.close();
}
