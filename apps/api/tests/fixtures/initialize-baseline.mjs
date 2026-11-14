// Historical-schema fixture for runner/replica conversion tests. Never starts the app or applies a catalog.
import mongoose from 'mongoose';
import { initializeBaseline } from '../../dist/src/database/baseline.js';
const uri = process.env.MONGODB_URI;
if (process.env.NODE_ENV !== 'test' || !uri) throw new Error('Explicit test database required');
const url = new URL(uri);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !url.pathname.startsWith('/tobu_test_')) throw new Error('Isolated loopback test database required');
try {
    await mongoose.connect(uri, { autoCreate: false, autoIndex: false });
    await initializeBaseline();
} finally {
    await mongoose.disconnect();
}
