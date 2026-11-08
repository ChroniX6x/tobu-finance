import { createHash, sign, verify } from 'node:crypto';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { keys } from '../auth/config.js';

// This is a signed domain id, NOT an access token or a client-selected event command.
// The two-part format and purpose prefix cannot be used as an authentication JWT.
const purpose = 'tobu-domain-creation-v1:';
const generations = new WeakMap<Types.ObjectId, number>();
export const creationGeneration = (id: Types.ObjectId) => generations.get(id);
export function canonical(value: unknown): string {
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    if (value instanceof Types.ObjectId) return JSON.stringify(String(value));
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object')
        return (
            '{' +
            Object.entries(value)
                .filter(([, v]) => v !== undefined)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
                .join(',') +
            '}'
        );
    return JSON.stringify(value);
}
export const fingerprint = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');

/** Bind the first authorized domain revision to a retry. A later revision fails closed, never reapplies an old change. */
export function mutationPermit(req: Request, identity: string): { status: number; body: Record<string, unknown> } | null {
    const binding = { user: req.user!.sub, resource: req.method + ':' + req.originalUrl, payload: fingerprint(req.body ?? null), identity };
    const prefix = 'tobu-domain-mutation-v1:';
    const token = req.get('X-Tobu-Mutation');
    if (!token) {
        const data = Buffer.from(JSON.stringify(binding)).toString('base64url');
        const signature = sign('sha256', Buffer.from(prefix + data), keys.access.privateKey).toString('base64url');
        return { status: 428, body: { error: 'MUTATION_PROOF_REQUIRED', mutationProof: data + '.' + signature } };
    }
    try {
        if (token.length > 2048) throw new Error();
        const [data, signature, extra] = token.split('.');
        if (!data || !signature || extra || !verify('sha256', Buffer.from(prefix + data), keys.access.publicKey, Buffer.from(signature, 'base64url'))) throw new Error();
        const claim = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
        if (claim.user !== binding.user || claim.resource !== binding.resource || claim.payload !== binding.payload) throw new Error();
        if (claim.identity !== identity) return { status: 409, body: { error: 'MUTATION_REVISION_STALE' } };
        return null;
    } catch {
        return { status: 422, body: { error: 'INVALID_MUTATION_PROOF' } };
    }
}

/** Missing proof negotiates WITHOUT writes. Retain the proof before submitting the actual creation. */
export function creationId(req: Request, res: Response, resource: string, payload: unknown, generation?: number): Types.ObjectId | null {
    const binding = { user: req.user!.sub, resource, payload: fingerprint(payload) };
    const token = req.get('X-Tobu-Creation');
    if (!token) {
        const data = Buffer.from(JSON.stringify({ ...binding, id: String(new Types.ObjectId()), ...(generation === undefined ? {} : { generation }) })).toString('base64url');
        const signature = sign('sha256', Buffer.from(purpose + data), keys.access.privateKey).toString('base64url');
        res.status(428).json({ error: 'CREATION_PROOF_REQUIRED', creationProof: data + '.' + signature });
        return null;
    }
    try {
        if (token.length > 2048) throw new Error();
        const [data, signature, extra] = token.split('.');
        if (!data || !signature || extra || !verify('sha256', Buffer.from(purpose + data), keys.access.publicKey, Buffer.from(signature, 'base64url'))) throw new Error();
        const claim = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
        if (claim.user !== binding.user || claim.resource !== resource || claim.payload !== binding.payload || !/^[a-f\d]{24}$/.test(claim.id)) throw new Error();
        const id = new Types.ObjectId(claim.id);
        if (generation !== undefined) {
            if (!Number.isSafeInteger(claim.generation) || claim.generation < 0) throw new Error();
            generations.set(id, claim.generation);
        }
        return id;
    } catch {
        res.status(422).json({ error: 'INVALID_CREATION_PROOF' });
        return null;
    }
}
