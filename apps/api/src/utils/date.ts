// Thin compatibility adapter: the month semantics live in lib/month.ts (which delegates to @tobu/contracts/calendar).
export { toMonthAnchorISO, monthRangeFromISO, lastNMonthAnchorsISO } from '../lib/month.js';

/** Forward-Fill für Balanceserie (fehlende Monate = letzter bekannter Wert; vor erstem Wert = 0) */
export const forwardFill = (labelsISO: string[], valuesByISO: Record<string, number | undefined>): number[] => {
    const out: number[] = [];
    let last = 0;
    let seenAny = false;
    for (const iso of labelsISO) {
        const v = valuesByISO[iso];
        if (typeof v === 'number') {
            last = v;
            seenAny = true;
            out.push(last);
        } else {
            out.push(seenAny ? last : 0);
        }
    }
    return out;
};
