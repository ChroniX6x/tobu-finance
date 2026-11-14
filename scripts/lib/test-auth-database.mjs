// A disposable auth-enforced replica set for real maintenance-account/privilege regression tests.
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { requireDocker, MONGO_IMAGE } from './docker.mjs';
import { capture, start } from './processes.mjs';
import { apiRequire } from './config.mjs';
const { MongoClient } = apiRequire('mongodb');

export async function testAuthDatabase() {
    await requireDocker();
    const name = `tobu-test-auth-${randomUUID()}`;
    const password = randomUUID();
    const stop = () => capture('docker', ['rm', '--force', '--volumes', name]);
    try {
        await capture('docker', [
            'run',
            '--detach',
            '--name',
            name,
            '--label',
            'tobu.test=true',
            '--publish',
            '127.0.0.1::27017',
            '--user',
            'mongodb',
            '--entrypoint',
            'bash',
            MONGO_IMAGE,
            '-c',
            'umask 077; openssl rand -base64 756 > /tmp/tobu-auth-key; exec mongod --replSet tobu-local --auth --keyFile /tmp/tobu-auth-key --bind_ip_all --setParameter enableTestCommands=1'
        ]);
        let ready = false;
        for (let attempt = 0; attempt < 40; attempt++) {
            try {
                await capture('docker', ['exec', name, 'mongosh', '--quiet', '--eval', 'if (!db.hello().ok) quit(1)']);
                ready = true;
                break;
            } catch {
                await delay(250);
            }
        }
        if (!ready) throw new Error('Auth test MongoDB did not start');
        // The localhost exception is used only inside this owned container to bootstrap its first admin.
        // Secret travels over stdin, never in argv, logs or an on-disk script.
        const bootstrap = start('docker', ['exec', '-i', name, 'mongosh', '--quiet'], { stdio: ['pipe', 'pipe', 'pipe'] });
        bootstrap.stdout.resume();
        bootstrap.stderr.resume();
        bootstrap.stdin.end(
            `rs.initiate({_id:'tobu-local',members:[{_id:0,host:'localhost:27017'}]});\nconst deadline = Date.now() + 30000; while (!db.hello().isWritablePrimary) { if (Date.now() > deadline) quit(2); sleep(100); }\ndb.getSiblingDB('admin').createUser({user:'bootstrap',pwd:${JSON.stringify(password)},roles:[{role:'root',db:'admin'}]});\n`
        );
        // Removing the owned container in the outer catch also stops the inner mongosh after exec is killed.
        const timer = setTimeout(() => bootstrap.kill('SIGKILL'), 45000);
        let result;
        try {
            result = await bootstrap.done;
        } finally {
            clearTimeout(timer);
        }
        if (result.code !== 0) throw new Error('Auth test bootstrap failed (private details suppressed)');
        const mapping = JSON.parse(await capture('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', name]));
        const uri = `mongodb://bootstrap:${password}@127.0.0.1:${mapping['27017/tcp'][0].HostPort}/tobu_test_auth_${randomUUID().replaceAll('-', '')}?authSource=admin&directConnection=true&replicaSet=tobu-local`;
        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        try {
            await client.connect();
            await client.db('admin').command({ connectionStatus: 1 });
        } finally {
            await client.close();
        }
        return { uri, name, stop };
    } catch (error) {
        await stop().catch(() => {});
        throw error;
    }
}
