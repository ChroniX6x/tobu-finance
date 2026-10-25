import { MigrationDiagnosticError, migrationErrorMessage } from './migration-errors.js';
import { MongoClient } from 'mongodb';
import { MigrationRunner } from './migration-runner.js';
import { ToolsBackup } from './migration-backup.js';

const uri = process.env.MONGODB_URI;
const command = process.argv[2] ?? 'status';
const option = (key: string) => process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
let client: MongoClient | undefined;
try {
    if (!uri) throw new MigrationDiagnosticError('Explicit MONGODB_URI required');
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, readPreference: 'primary' });
    if (!['status', 'plan', 'up', 'down', 'recover'].includes(command)) throw new MigrationDiagnosticError('Use status, plan, up, down or recover');
    await client.connect();
    const backupRoot = process.env.TOBU_MIGRATION_BACKUP_DIR;
    const mode = process.env.TOBU_MIGRATION_BACKUP_MODE ?? 'native';
    if (!['native', 'docker-local'].includes(mode)) throw new MigrationDiagnosticError('Unknown backup tool mode');
    if (mode === 'docker-local' && process.env.NODE_ENV === 'production') throw new MigrationDiagnosticError('Docker-local helper is not a production backend');
    const options = {
        ...(backupRoot ? { backup: new ToolsBackup(client, client.db(), uri, backupRoot, mode as 'native' | 'docker-local') } : {}),
        productionStructuralApproved: option('maintenance-approved') === client.db().databaseName && option('backup-protection-confirmed') === client.db().databaseName
    };
    const runner = new MigrationRunner(client, client.db(), uri, process.env.NODE_ENV ?? 'development', undefined, options);
    const direction = command === 'down' || (command === 'plan' && option('direction') === 'down') ? 'down' : 'up';
    if (['status', 'plan'].includes(command)) console.log(JSON.stringify(await runner.plan(direction), null, 2));
    else {
        const confirm = option('confirm') ?? '';
        const stopped = option('writers-stopped') === client.db().databaseName;
        const action = option('recovery');
        if (action && !['resume', 'restore'].includes(action)) throw new MigrationDiagnosticError('Use --recovery=resume or --recovery=restore');
        if (command === 'recover') console.log(await runner.recover(confirm, option('runner-stopped') ?? '', stopped, action as 'resume' | 'restore' | undefined));
        else console.log(await runner.run(direction, confirm, stopped));
    }
} catch (error) {
    // No raw driver errors/URIs: server errors may include document contents or credentials.
    console.error(migrationErrorMessage(error));
    process.exitCode = 1;
} finally {
    await client?.close();
}
