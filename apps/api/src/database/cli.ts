import mongoose from 'mongoose';
import { connectDB } from '../db.js';
import { initializeBaseline, verifyBaseline } from './baseline.js';
import { seedDevelopment } from './seed.js';
import { MigrationRunner } from './migration-runner.js';

async function initializeAndMigrateNewDatabase(uri: string) {
    const created = await initializeBaseline();
    if (created) {
        const runner = new MigrationRunner(mongoose.connection.getClient(), mongoose.connection.db!, uri, process.env.NODE_ENV ?? 'development');
        const plan = await runner.plan();
        await runner.run('up', plan.confirmation, true);
    }
    await verifyBaseline();
}

const command = process.argv[2];
try {
    if (process.env.NODE_ENV === 'production') throw new Error('Development database commands are disabled in production');
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('Explicit MONGODB_URI required');
    await connectDB(uri);
    if (command === 'init') await initializeAndMigrateNewDatabase(uri);
    else if (command === 'setup') {
        await initializeAndMigrateNewDatabase(uri);
        // Resume an interrupted first seed; do not refill an already completed demo.
        const seeded = await mongoose.connection.db!.collection('_tobu_seed').findOne({ name: 'demo-v1', status: 'ready' });
        if (!seeded) await seedDevelopment(process.env.SEED_MONTH);
    } else if (command === 'seed') {
        await verifyBaseline();
        await seedDevelopment(process.env.SEED_MONTH);
    } else if (command === 'check') await verifyBaseline();
    else if (command === 'migrate') throw new Error('Use npm run db:migrate:plan and the confirmed npm run db:migrate command');
    else if (command === 'reset') {
        const name = mongoose.connection.db!.databaseName;
        if (name !== 'tobu_finance_dev' || process.env.TOBU_RESET_CONFIRM !== name) {
            throw new Error('Reset requires the dedicated tobu_finance_dev database and explicit --confirm=tobu_finance_dev');
        }
        await verifyBaseline();
        await mongoose.connection.db!.dropDatabase();
        await initializeAndMigrateNewDatabase(uri);
        await seedDevelopment(process.env.SEED_MONTH);
    } else throw new Error('Unknown database command');
    console.log(`Database ${command}: OK`);
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
