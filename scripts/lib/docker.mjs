import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { root, apiRequire } from './config.mjs';
import { capture, run } from './processes.mjs';

export const MONGO_IMAGE = 'mongo:9.0.4';
export async function requireDocker() {
  try {
    if (await capture('docker', ['info', '--format', '{{.OSType}}']) !== 'linux') throw new Error('Linux containers required');
    await capture('docker', ['compose', 'version']);
  }
  catch { throw new Error('Docker engine/Compose is unavailable. Start Docker Desktop with Linux containers. No native database fallback will be used.'); }
}
const compose = config => ['compose', '--project-name', config.project, '--file', resolve(root, 'infra/compose.yaml')];
export async function databaseUp(config) {
  if (config.mode === 'docker') {
    await requireDocker();
    await run('docker', [...compose(config), 'up', '-d', '--wait', '--wait-timeout', '90'], { env: { ...process.env, DB_PORT: String(config.dbPort) } });
  }
  await pingDatabase(config.uri);
}
export async function databaseDown(config) {
  if (config.mode === 'external') { console.log('External database is not managed or stopped by ToBu.'); return; }
  await run('docker', [...compose(config), 'stop'], { env: { ...process.env, DB_PORT: String(config.dbPort) } });
  console.log('MongoDB stopped. The persistent volume is retained.');
}
export async function pingDatabase(uri) {
  const { MongoClient } = apiRequire('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
  try { await client.connect(); await client.db().command({ ping: 1 }); }
  finally { await client.close(); }
}
export async function temporaryDatabase(signal) {
  await requireDocker();
  signal?.throwIfAborted();
  const name = `tobu-test-${randomUUID()}`;
  try {
    await capture('docker', ['run', '--detach', '--name', name, '--label', 'tobu.test=true', '--publish', '127.0.0.1::27017', MONGO_IMAGE]);
    signal?.throwIfAborted();
    const mapping = JSON.parse(await capture('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', name]));
    const port = mapping['27017/tcp'][0].HostPort;
    const uri = `mongodb://127.0.0.1:${port}/tobu_test_${randomUUID().replaceAll('-', '')}`;
    for (let i = 0; i < 30; i++) {
      signal?.throwIfAborted();
      try { await pingDatabase(uri); return { uri, stop: () => capture('docker', ['rm', '--force', '--volumes', name]) }; }
      catch { await delay(300); }
    }
    throw new Error('Temporary test MongoDB did not become ready');
  } catch (error) { await capture('docker', ['rm', '--force', '--volumes', name]).catch(() => {}); throw error; }
}
