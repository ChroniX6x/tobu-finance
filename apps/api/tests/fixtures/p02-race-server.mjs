// Pause the actual completed preflight account read, outside the writer transaction.
// Only this isolated test process changes scheduling; production code and results remain unchanged.
import Account from '../../dist/src/models/Account.js';
const uri = new URL(process.env.MONGODB_URI);
if (process.env.NODE_ENV !== 'test' || !['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname) || !/^\/tobu_test_[a-f0-9]{32}$/.test(uri.pathname) || !process.send) throw new Error('Isolated P02 IPC test process required');
let armed;
let release;
process.on('message', (message) => {
    if (message.type === 'arm') {
        armed = message.accountId;
        process.send({ state: 'armed' });
    }
    if (message.type === 'resume') {
        release?.();
        release = undefined;
    }
});
const findById = Account.findById.bind(Account);
Account.findById = (...args) => {
    const query = findById(...args);
    const exec = query.exec.bind(query);
    query.exec = async (...execArgs) => {
        const row = await exec(...execArgs);
        if (armed && !query.getOptions().session && String(row?._id) === armed) {
            armed = undefined;
            const resumed = new Promise((resolve) => {
                release = resolve;
            });
            process.send({ state: 'preflight-read-completed' });
            await resumed;
        }
        return row;
    };
    return query;
};
await import('../../dist/src/server.js');
