import { Types } from 'mongoose';
import { DateTime } from 'luxon';

export const ACTIVITY_READ_INDEX = { accountId: 1, date: -1, _id: -1 } as const;
/** Ordered disjoint ranges avoid a residual OR filter rescanning preceding IDs at the same timestamp. */
export function activityStorageRanges(accountId: string, from?: string, to?: string, after?: { date: string; id: string }): Record<string, unknown>[] {
    const account = { accountId: new Types.ObjectId(accountId) };
    const lower = from ? { $gte: DateTime.fromISO(from, { zone: 'utc' }).toJSDate() } : {};
    if (!after) return [{ ...account, ...(from || to ? { date: { ...lower, ...(to ? { $lt: DateTime.fromISO(to, { zone: 'utc' }).toJSDate() } : {}) } } : {}) }];
    const date = DateTime.fromISO(after.date, { zone: 'utc' }).toJSDate();
    return [
        { ...account, date, _id: { $lt: new Types.ObjectId(after.id) } },
        { ...account, date: { ...lower, $lt: date } }
    ];
}
