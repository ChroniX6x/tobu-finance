import mongoose, { Types, type ClientSession } from 'mongoose';
import { addMonthsToMonthKey, monthKeyOfUtcDate, monthKeyToAnchor } from '@tobu/contracts/calendar';

import CategoryBudget from '../models/CategoryBudget.js';
import Category from '../models/Category.js';
import ContributionRule from '../models/ContributionRule.js';

type CustomSplitEntry = { memberId: Types.ObjectId; split: number };

/**
 * Returns a stable key for a customSplit array so that two categories with
 * identical splits can be grouped into one shared base rule.
 * An empty (or absent) split maps to the special "__proRata__" key.
 */
function splitKey(customSplit: CustomSplitEntry[]): string {
    if (!customSplit || customSplit.length === 0) return '__proRata__';
    return customSplit
        .map((e) => `${String(e.memberId)}:${e.split}`)
        .sort()
        .join('|');
}

/** A budget on the month axis: inclusive MonthKeys, null = unbounded. */
export interface BudgetSpan {
    from: string | null;
    to: string | null;
    amountMinor: number;
}

/** One contiguous period with a constant total, inclusive MonthKeys, null = unbounded. */
export interface AmountPeriod {
    from: string | null;
    to: string | null;
    amountMinor: number;
}

/**
 * Month-accurate need of a set of budgets: for every month, exactly the budgets that are valid in THAT month are summed.
 * Contiguous months with an identical total are merged into one period; months without any amount produce no period.
 * Pure: no clock, so adding a budget for November can never change the result for March.
 */
export function amountPeriods(budgets: BudgetSpan[]): AmountPeriod[] {
    // A budget's total can only change in the month it starts and in the month after it ends.
    const changes = new Set<string>();
    for (const b of budgets) {
        if (b.from) changes.add(b.from);
        if (b.to) {
            try {
                changes.add(addMonthsToMonthKey(b.to, 1));
            } catch {
                /* the end lies beyond the supported years: the budget stays open towards the end */
            }
        }
    }
    const starts: Array<string | null> = [null, ...[...changes].sort()];
    const periods: AmountPeriod[] = [];
    starts.forEach((start, i) => {
        // Before the first change only budgets without a start are active; later every budget is judged at the period start.
        const total = budgets.filter((b) => (start === null ? b.from === null : (b.from === null || b.from <= start) && (b.to === null || b.to >= start))).reduce((sum, b) => sum + b.amountMinor, 0);
        if (total <= 0) return;
        const next = starts[i + 1];
        const to = next === undefined || next === null ? null : addMonthsToMonthKey(next, -1);
        const last = periods[periods.length - 1];
        if (last && last.amountMinor === total && last.to !== null && start !== null && addMonthsToMonthKey(last.to, 1) === start) last.to = to;
        else periods.push({ from: start, to, amountMinor: total });
    });
    return periods;
}

const spanOf = (budget: { fromMonth?: unknown; toMonth?: unknown; amountMinor?: unknown }): BudgetSpan => ({
    from: budget.fromMonth ? monthKeyOfUtcDate(budget.fromMonth as Date) : null,
    to: budget.toMonth ? monthKeyOfUtcDate(budget.toMonth as Date) : null,
    amountMinor: Number(budget.amountMinor ?? 0)
});

/**
 * Rebuilds all `type: 'base'` ContributionRules for an account from its CategoryBudgets.
 * Called after every POST / PATCH / DELETE on category-budgets.
 *
 * Algorithm:
 *  1. Load all budgets + their categories (for customSplit) and group them by customSplit signature.
 *  2. Per group, one base rule per period of constant total (see {@link amountPeriods}): a month only ever
 *     counts the budgets that are valid in that month; the generator does not look at the clock.
 *  3. Replace the old base rules by the new ones in ONE transaction: a failure leaves the old rules untouched,
 *     and rules are never deleted without their replacement.
 *
 * Existing stored base rules are only replaced when a budget of the account is written; there is no bulk rewrite.
 */
export async function regenerateBaseRules(accountId: string | Types.ObjectId, session?: ClientSession): Promise<void> {
    const accId = typeof accountId === 'string' ? new Types.ObjectId(accountId) : accountId;
    const rulesData = await buildBaseRules(accId, session);
    const replace = async (s: ClientSession) => {
        await ContributionRule.deleteMany({ accountId: accId, type: 'base' }, { session: s });
        if (rulesData.length > 0) await ContributionRule.insertMany(rulesData, { session: s });
    };
    if (session) await replace(session);
    else await mongoose.connection.transaction(replace);
}

async function buildBaseRules(accId: Types.ObjectId, session?: ClientSession): Promise<object[]> {
    const budgets = await CategoryBudget.find({ accountId: accId }, null, { session: session ?? null }).lean();
    if (budgets.length === 0) return [];

    const categoryIds = [...new Set(budgets.map((b) => String(b.categoryId)))];
    const categories = await Category.find({ _id: { $in: categoryIds.map((id) => new Types.ObjectId(id)) } }, null, { session: session ?? null }).lean();
    const categoryMap = new Map(categories.map((c) => [String(c._id), c]));

    const groups = new Map<string, { customSplit: CustomSplitEntry[]; spans: BudgetSpan[] }>();
    for (const budget of budgets) {
        const split = (categoryMap.get(String(budget.categoryId))?.customSplit ?? []) as unknown as CustomSplitEntry[];
        const key = splitKey(split);
        if (!groups.has(key)) groups.set(key, { customSplit: split, spans: [] });
        groups.get(key)!.spans.push(spanOf(budget));
    }

    const rulesData: object[] = [];
    for (const group of groups.values()) {
        const isProRata = group.customSplit.length === 0;
        for (const period of amountPeriods(group.spans)) {
            rulesData.push({
                accountId: accId,
                type: 'base',
                recurring: true,
                description: null,
                amountMinor: period.amountMinor,
                distribution: isProRata
                    ? { mode: 'proRataIncome', memberId: null, customSplit: null }
                    : {
                          mode: 'customSplit',
                          memberId: null,
                          customSplit: group.customSplit.map((e) => ({ memberId: e.memberId, split: e.split }))
                      },
                fromMonth: period.from ? monthKeyToAnchor(period.from) : null,
                toMonth: period.to ? monthKeyToAnchor(period.to) : null
            });
        }
    }
    return rulesData;
}
