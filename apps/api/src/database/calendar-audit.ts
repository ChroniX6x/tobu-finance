import type { Db } from 'mongodb';

/**
 * Read-only audit of calendar values (H05). It only reads documents and reports aggregated
 * counts: no ids, titles, amounts or dates leave this module, and nothing is ever written.
 */
export type AuditSeverity = 'blocking' | 'legacy-tolerated' | 'info';

export interface AuditFinding {
    collection: string;
    check: string;
    severity: AuditSeverity;
    count: number;
}

export interface CalendarAuditReport {
    schema: 'tobu-calendar-audit-v1';
    counts: Record<string, number>;
    findings: AuditFinding[];
    blocking: number;
    needsReview: number;
    decision: 'NO MIGRATION' | 'REVIEW' | 'STOP-DATA';
}

type Doc = Record<string, unknown>;

const isDate = (value: unknown): value is Date => value instanceof Date && !Number.isNaN(value.getTime());
const isMonthAnchor = (value: Date) => value.getUTCDate() === 1 && value.getTime() % 86_400_000 === 0;
const isUtcMidnight = (value: Date) => value.getTime() % 86_400_000 === 0;
const monthIndex = (value: Date) => value.getUTCFullYear() * 12 + value.getUTCMonth();

class Collector {
    readonly findings = new Map<string, AuditFinding>();
    add(collection: string, check: string, severity: AuditSeverity) {
        const key = `${collection}\u0000${check}`;
        const found = this.findings.get(key);
        if (found) found.count += 1;
        else this.findings.set(key, { collection, check, severity, count: 1 });
    }
}

async function scan(db: Db, name: string, projection: Doc, visit: (doc: Doc) => void): Promise<number> {
    let total = 0;
    for await (const doc of db.collection(name).find({}, { projection })) {
        total += 1;
        visit(doc as Doc);
    }
    return total;
}

// A month field is canonical when it is null/absent (optional fields) or a UTC first-of-month Date.
function checkMonth(c: Collector, collection: string, field: string, value: unknown, required: boolean) {
    if (value === null || value === undefined) {
        if (required) c.add(collection, `${field}:missing`, 'blocking');
        return;
    }
    if (!isDate(value)) c.add(collection, `${field}:not-a-date`, 'blocking');
    else if (!isMonthAnchor(value)) c.add(collection, `${field}:not-utc-month-anchor`, 'blocking');
}

function checkRange(c: Collector, collection: string, from: unknown, to: unknown) {
    if (isDate(from) && isDate(to) && monthIndex(from) > monthIndex(to)) c.add(collection, 'range:from-after-to', 'blocking');
}

export async function auditCalendarData(db: Db): Promise<CalendarAuditReport> {
    const c = new Collector();
    const counts: Record<string, number> = {};

    const transactions = new Map<string, { month: unknown; bookDate: unknown }>();
    const children: { parent: string; month: unknown; bookDate: unknown }[] = [];
    counts.transactions = await scan(db, 'transactions', { month: 1, bookDate: 1, status: 1, parentTransactionId: 1 }, (doc) => {
        checkMonth(c, 'transactions', 'month', doc.month, true);
        const book = doc.bookDate;
        if (book !== null && book !== undefined) {
            if (!isDate(book)) c.add('transactions', 'bookDate:not-a-date', 'blocking');
            else if (!isUtcMidnight(book)) c.add('transactions', 'bookDate:not-utc-midnight-carrier', 'legacy-tolerated');
            if (isDate(book) && isDate(doc.month) && monthIndex(book) !== monthIndex(doc.month)) {
                c.add('transactions', doc.status === 'booked' ? 'booked:month-contradicts-bookDate' : 'pending:month-contradicts-bookDate', 'blocking');
            }
        } else if (doc.status === 'booked') c.add('transactions', 'booked:without-bookDate', 'blocking');
        const id = String(doc._id);
        transactions.set(id, { month: doc.month, bookDate: doc.bookDate });
        if (doc.parentTransactionId) children.push({ parent: String(doc.parentTransactionId), month: doc.month, bookDate: doc.bookDate });
    });
    for (const child of children) {
        const parent = transactions.get(child.parent);
        if (!parent) c.add('transactions', 'child:orphan-parent', 'blocking');
        else {
            if (isDate(parent.month) && isDate(child.month) && parent.month.getTime() !== child.month.getTime()) c.add('transactions', 'child:month-differs-from-parent', 'blocking');
            const same = (a: unknown, b: unknown) => (isDate(a) && isDate(b) ? a.getTime() === b.getTime() : a == null && b == null);
            if (!same(parent.bookDate, child.bookDate)) c.add('transactions', 'child:bookDate-differs-from-parent', 'blocking');
        }
    }

    counts.account_balances = await scan(db, 'account_balances', { month: 1 }, (doc) => checkMonth(c, 'account_balances', 'month', doc.month, false));
    counts.carryovers = await scan(db, 'carryovers', { month: 1 }, (doc) => checkMonth(c, 'carryovers', 'month', doc.month, false));
    for (const name of ['category_budgets', 'member_incomes', 'contribution_rules']) {
        counts[name] = await scan(db, name, { fromMonth: 1, toMonth: 1 }, (doc) => {
            checkMonth(c, name, 'fromMonth', doc.fromMonth, false);
            checkMonth(c, name, 'toMonth', doc.toMonth, false);
            checkRange(c, name, doc.fromMonth, doc.toMonth);
        });
    }
    // Recurrence is legacy and not implemented by this feature: report, never judge.
    counts.recurrences = await scan(db, 'recurrences', { activeFrom: 1, activeUntil: 1, nextPlanned: 1, lastEmitted: 1 }, (doc) => {
        for (const field of ['activeFrom', 'activeUntil', 'nextPlanned', 'lastEmitted']) {
            const value = doc[field];
            if (value === null || value === undefined) continue;
            if (!isDate(value) || !isUtcMidnight(value)) c.add('recurrences', `${field}:not-utc-midnight`, 'info');
        }
        if (isDate(doc.activeFrom) && isDate(doc.activeUntil) && doc.activeFrom.getTime() > doc.activeUntil.getTime()) c.add('recurrences', 'range:from-after-until', 'info');
    });
    // Events carry real instants; only the type is checked.
    counts.events = await scan(db, 'events', { date: 1 }, (doc) => {
        if (!isDate(doc.date)) c.add('events', 'date:not-a-date', 'blocking');
    });

    const findings = [...c.findings.values()].sort((a, b) => `${a.collection}${a.check}`.localeCompare(`${b.collection}${b.check}`));
    const blocking = findings.filter((f) => f.severity === 'blocking').reduce((sum, f) => sum + f.count, 0);
    // Tolerated legacy values (possible instant vs. calendar ambiguity, STOP-1) need an owner decision first.
    const needsReview = findings.filter((f) => f.severity === 'legacy-tolerated').reduce((sum, f) => sum + f.count, 0);
    const decision = blocking > 0 ? 'STOP-DATA' : needsReview > 0 ? 'REVIEW' : 'NO MIGRATION';
    return { schema: 'tobu-calendar-audit-v1', counts, findings, blocking, needsReview, decision };
}
