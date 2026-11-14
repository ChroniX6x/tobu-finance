import { createHash, X509Certificate } from 'node:crypto';
import { getCACertificates } from 'node:tls';
import { ObjectId, type Db, type MongoClient } from 'mongodb';
import { MigrationDiagnosticError } from './migration-errors.js';

/** Version 2 never hashes authentication material. No URI is retained in the identity. */
export type MigrationTarget = {
    identityVersion: 2;
    environment: string;
    server: string;
    database: string;
    databaseId: string | null;
    deployment: { kind: 'replicaSet' | 'sharded'; id: string; setName?: string };
};

// Use the driver's parser, including IPv6, encoded credentials, SRV and default ports.
export function migrationEndpoint(client: MongoClient): string {
    const options = client.options;
    if (options.srvHost) return `mongodb+srv://${options.srvHost.toLowerCase()}`;
    const hosts = [...new Set(options.hosts.map((host) => (host.socketPath ? host.toString() : host.toString().toLowerCase())))].sort();
    if (!hosts.length) throw new MigrationDiagnosticError('Cannot identify migration endpoints');
    return `mongodb://${hosts.join(',')}`;
}

/** Actual effective connection policy; auth, tokens, key material/passphrases and file paths are excluded. */
export function migrationConnectionPolicy(client: MongoClient) {
    const o = client.options;
    const ca = o.ca === undefined ? getCACertificates('default') : Array.isArray(o.ca) ? o.ca : [o.ca];
    let trust: string[];
    try {
        trust = [
            ...new Set(
                ca.flatMap((certificate) => {
                    const text = certificate.toString();
                    const pem = text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
                    return (pem ?? [certificate]).map((part) => new X509Certificate(part).fingerprint256);
                })
            )
        ].sort();
    } catch {
        throw new MigrationDiagnosticError('Cannot fingerprint public TLS trust configuration');
    }
    return {
        trust,
        tls: Boolean(o.tls),
        tlsInsecure: Boolean(o.tlsInsecure),
        tlsAllowInvalidCertificates: Boolean(o.tlsAllowInvalidCertificates),
        tlsAllowInvalidHostnames: Boolean(o.tlsAllowInvalidHostnames),
        directConnection: o.directConnection,
        loadBalanced: o.loadBalanced,
        replicaSet: o.replicaSet ?? null,
        srvServiceName: o.srvServiceName,
        srvMaxHosts: o.srvMaxHosts,
        retryReads: o.retryReads,
        retryWrites: o.retryWrites,
        connectTimeoutMS: o.connectTimeoutMS,
        socketTimeoutMS: o.socketTimeoutMS,
        serverSelectionTimeoutMS: o.serverSelectionTimeoutMS,
        readPreference: o.readPreference.mode,
        readConcern: o.readConcern?.level ?? null,
        writeConcern: { w: o.writeConcern?.w ?? null, journal: o.writeConcern?.journal ?? null, wtimeoutMS: o.writeConcern?.wtimeoutMS ?? null }
    };
}

export async function migrationTarget(client: MongoClient, db: Db, environment: string, databaseId?: string): Promise<MigrationTarget> {
    const hello = await db.admin().command({ hello: 1 });
    let deployment: MigrationTarget['deployment'];
    if (hello.setName) {
        const response = await db.admin().command({ replSetGetConfig: 1 });
        const id: unknown = response.config?.settings?.replicaSetId;
        if (!(id instanceof ObjectId) || response.config?._id !== hello.setName) throw new MigrationDiagnosticError('Cannot verify replica-set deployment identity');
        deployment = { kind: 'replicaSet', id: id.toHexString(), setName: hello.setName };
    } else if (hello.msg === 'isdbgrid') {
        const version = await client.db('config').collection<{ _id: number; clusterId: ObjectId }>('version').findOne({ _id: 1 });
        if (!(version?.clusterId instanceof ObjectId)) throw new MigrationDiagnosticError('Cannot verify sharded deployment identity');
        deployment = { kind: 'sharded', id: version.clusterId.toHexString() };
    } else throw new MigrationDiagnosticError('Migrations require a replica set or sharded cluster; no standalone fallback');
    return { identityVersion: 2, environment, server: migrationEndpoint(client), database: db.databaseName, databaseId: databaseId ?? null, deployment };
}

export const migrationTargetHash = (target: MigrationTarget) => createHash('sha256').update(JSON.stringify(target)).digest('hex');

export function requireCurrentIdentity(version: unknown) {
    if (version !== 2) throw new MigrationDiagnosticError('Legacy migration identity: keep maintenance active. Finish recovery with the original verified runner/catalog and original target; no automatic journal or backup conversion is allowed');
}
