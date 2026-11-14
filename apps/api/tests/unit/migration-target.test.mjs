import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MongoClient, ObjectId } from 'mongodb';
import { rootCertificates } from 'node:tls';
import { migrationEndpoint, migrationConnectionPolicy, migrationTarget, migrationTargetHash, requireCurrentIdentity } from '../../dist/src/database/migration-target.js';

test('S1 canonical endpoints and effective policy exclude credentials and respect meaningful options', () => {
    const a = new MongoClient('mongodb://first:p%40ss%2Fword@B.EXAMPLE:27017,a.example/db?replicaSet=rs&tls=true&authSource=admin&appName=one');
    const b = new MongoClient('mongodb://second:rotated@A.EXAMPLE:27017,b.example/db?ssl=true&appName=two&replicaSet=rs&authSource=elsewhere');
    assert.equal(migrationEndpoint(a), migrationEndpoint(b));
    assert.deepEqual(migrationConnectionPolicy(a), migrationConnectionPolicy(b));
    assert.doesNotMatch(JSON.stringify([migrationEndpoint(a), migrationConnectionPolicy(a)]), /first|word|authSource|appName|admin/);
    const changed = new MongoClient('mongodb://a.example,b.example:27017/db?tls=false&replicaSet=rs');
    assert.notDeepEqual(migrationConnectionPolicy(a), migrationConnectionPolicy(changed));
    assert.notEqual(migrationEndpoint(a), migrationEndpoint(new MongoClient('mongodb://a.example:27018,b.example/db')));
    assert.equal(migrationEndpoint(new MongoClient('mongodb://[::1]/db')), migrationEndpoint(new MongoClient('mongodb://[::1]:27017/db')));
    const srv = new MongoClient('mongodb+srv://person:secret@EXAMPLE.COM/db?authMechanismProperties=AWS_SESSION_TOKEN:super-secret');
    assert.equal(migrationEndpoint(srv), 'mongodb+srv://example.com');
    assert.doesNotMatch(JSON.stringify(migrationConnectionPolicy(srv)), /person|secret|TOKEN/);
    assert.equal(migrationEndpoint(new MongoClient('mongodb://user:p%25ss@localhost/tobu%5Fdb')), 'mongodb://localhost:27017');
    const customTrust = new MongoClient('mongodb://localhost/db?tls=true', { ca: rootCertificates[0] });
    assert.notDeepEqual(migrationConnectionPolicy(customTrust).trust, migrationConnectionPolicy(a).trust);
    const secretTlsA = new MongoClient('mongodb://localhost/db?tls=true&tlsCertificateKeyFile=/tmp/one.pem&tlsCertificateKeyFilePassword=private-one');
    const secretTlsB = new MongoClient('mongodb://localhost/db?tls=true&tlsCertificateKeyFile=/tmp/two.pem&tlsCertificateKeyFilePassword=private-two');
    assert.deepEqual(migrationConnectionPolicy(secretTlsA), migrationConnectionPolicy(secretTlsB));
    assert.doesNotMatch(JSON.stringify(migrationConnectionPolicy(secretTlsA)), /private-one|one.pem/);
});

test('S1 deployment identity comes from server, never a URI name or process id; no fallback on denial', async () => {
    const id = new ObjectId();
    const client = new MongoClient('mongodb://user:secret@localhost/db?replicaSet=rs');
    const db = { databaseName: 'db', admin: () => ({ command: async (command) => (command.hello ? { setName: 'rs', topologyVersion: { processId: new ObjectId() } } : { config: { _id: 'rs', settings: { replicaSetId: id } } }) }) };
    const target = await migrationTarget(client, db, 'test', 'database-id');
    assert.equal(target.deployment.id, id.toHexString());
    const rotated = new MongoClient('mongodb://different:rotated@localhost/db?replicaSet=rs');
    assert.equal(migrationTargetHash(target), migrationTargetHash(await migrationTarget(rotated, db, 'test', 'database-id')));
    assert.notEqual(migrationTargetHash(target), migrationTargetHash({ ...target, databaseId: 'clone' }));
    assert.notEqual(migrationTargetHash(target), migrationTargetHash({ ...target, deployment: { ...target.deployment, id: new ObjectId().toHexString() } }));
    const denied = {
        databaseName: 'db',
        admin: () => ({
            command: async (command) => {
                if (command.hello) return { setName: 'rs' };
                throw new Error('denied');
            }
        })
    };
    await assert.rejects(migrationTarget(client, denied, 'test'), /denied/);
    for (const version of [undefined, 1, '2']) assert.throws(() => requireCurrentIdentity(version), /Legacy migration identity/);
    requireCurrentIdentity(2);
});
