import { AssertionError } from 'node:assert';
import { MongoError, MongoNetworkError, MongoServerSelectionError } from 'mongodb';

type Phase = 'preUp' | 'up' | 'verifyUp' | 'preDown' | 'down' | 'verifyDown' | 'transaction' | 'inspect' | 'apply' | 'verify' | 'prepare' | 'restore';
type Diagnostic = { message: string; cause?: unknown; phase?: Phase | undefined };
const diagnostics = new WeakMap<object, Diagnostic>();
const phases = new WeakMap<object, Phase>();
const runs = new WeakMap<object, string>();
const protectedFailures = new WeakSet<object>();

// Only constructor-owned trusted messages can be printed; mutable error properties are never read.
export class MigrationDiagnosticError extends Error {
    constructor(message: string, options?: ErrorOptions & { phase?: Phase }) {
        super(message, options);
        diagnostics.set(this, { message, cause: options?.cause, phase: options?.phase });
    }
}

function own(error: unknown, key: string): unknown {
    try {
        if (typeof error !== 'object' || error === null) return undefined;
        const descriptor = Object.getOwnPropertyDescriptor(error, key);
        return descriptor && 'value' in descriptor ? descriptor.value : undefined;
    } catch {
        return undefined;
    }
}

function category(error: unknown): string {
    try {
        const code = own(error, 'code');
        if (error instanceof AssertionError) return 'assertion';
        if (code === 121) return 'document-validation (121)';
        if (code === 11000) return 'duplicate-key (11000)';
        if (code === 13 || code === 18) return `permission/authentication (${code})`;
        if (error instanceof MongoNetworkError || error instanceof MongoServerSelectionError || [6, 7, 89, 91, 11600, 11602].includes(code as number)) return 'connection';
    } catch {
        /* A hostile Proxy must not turn diagnostics into another failure. */
    }
    return 'unknown';
}

export async function withMigrationPhase<T>(phase: Phase, action: () => Promise<T>): Promise<T> {
    try {
        return await action();
    } catch (error) {
        if (typeof error !== 'object' || error === null) throw new MigrationDiagnosticError('Migration operation failed [unknown]', { phase });
        if (typeof error === 'object' && error !== null && !phases.has(error)) phases.set(error, phase);
        throw error;
    }
}

export function migrationRunError(error: unknown, runId: string): unknown {
    const failure = typeof error === 'object' && error !== null ? error : new MigrationDiagnosticError('Migration operation failed [unknown]');
    if (/^[a-f0-9-]{36}$/.test(runId)) runs.set(failure, runId);
    return failure;
}

/** Umzug formats a caught error.message. Give it only a safe wrapper; preserve known driver retry labels. */
export async function protectMigrationFailure<T>(action: () => Promise<T>): Promise<T> {
    try {
        return await action();
    } catch (error) {
        const safe = new MongoError('Migration operation failed');
        diagnostics.set(safe, { message: 'Migration operation failed', cause: error });
        protectedFailures.add(safe);
        const labels = own(error, 'errorLabelSet');
        for (const label of ['TransientTransactionError', 'UnknownTransactionCommitResult']) {
            try {
                if (Set.prototype.has.call(labels, label)) safe.addErrorLabel(label);
            } catch {
                /* Not a genuine Set. */
            }
        }
        throw safe;
    }
}
export const isProtectedMigrationFailure = (error: unknown): error is Error => typeof error === 'object' && error !== null && protectedFailures.has(error);

export function migrationErrorMessage(error: unknown): string {
    const seen = new Set<unknown>();
    const format = (current: unknown, depth: number): string => {
        if (depth > 6 || seen.has(current)) return 'Migration diagnostic chain truncated.';
        seen.add(current);
        const trusted = typeof current === 'object' && current !== null ? diagnostics.get(current) : undefined;
        const object = typeof current === 'object' && current !== null ? current : undefined;
        const knownPhase = trusted?.phase ?? (object ? phases.get(object) : undefined);
        const phase = knownPhase ? ` [phase=${knownPhase}]` : '';
        const run = object && runs.has(object) ? ` [run=${runs.get(object)}]` : '';
        if (!trusted) return `Migration command failed [${category(current)}]${phase}${run}; private driver details are suppressed.`;
        return trusted.message + phase + run + (trusted.cause !== undefined ? ` ${format(trusted.cause, depth + 1)}` : '');
    };
    return format(error, 0).slice(0, 2000);
}
