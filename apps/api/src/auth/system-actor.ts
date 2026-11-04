/**
 * System actor for real server-side automation (E02). It is created only by trusted internal code
 * (jobs, account-open hooks, reconciliation) and is deliberately NOT reachable from a request: no route may import
 * this module, and nothing here reads `req`, headers or a body (guarded by tests/unit/actor-context.test.mjs).
 * A system actor never claims a login; the initiating user, if any, is kept separately and was verified by the caller.
 */

export type SystemTrigger = 'account_open' | 'automation' | 'system_reconciliation';

export interface SystemActor {
    readonly kind: 'system';
    readonly trigger: SystemTrigger;
    readonly initiatedByUserId?: string;
}

const TRIGGERS: readonly SystemTrigger[] = ['account_open', 'automation', 'system_reconciliation'];
const OBJECT_ID = /^[a-f\d]{24}$/i;

export function createSystemActor(trigger: SystemTrigger, initiatedByUserId?: string): SystemActor {
    if (!TRIGGERS.includes(trigger)) throw new Error('Unknown system trigger');
    if (initiatedByUserId !== undefined && !(typeof initiatedByUserId === 'string' && OBJECT_ID.test(initiatedByUserId))) throw new Error('initiatedByUserId must be a verified user id');
    return Object.freeze({ kind: 'system' as const, trigger, ...(initiatedByUserId ? { initiatedByUserId } : {}) });
}
