import type { ClientSession } from 'mongoose';
import { isRecurrenceActivityCode, type RecurrenceActivityCode } from '@tobu/contracts/activity';
import { activityCommand, commitActivity, writeActivityInSession, reconcileActivity, type ActivityAuthority, type ActivityIntent } from './activity-writer.js';
import type { RecurrenceScopePort } from './recurrence-activity-scope.js';

export type RecurrenceActivityIntent = Extract<ActivityIntent, { code: RecurrenceActivityCode }>;
const checked = (intents: readonly RecurrenceActivityIntent[]) => {
    if (!intents.length || intents.some((intent) => !isRecurrenceActivityCode(intent.code))) throw new Error('RECURRENCE_ACTIVITY_INTENTS_REQUIRED');
    return intents;
};
type Command = ReturnType<typeof activityCommand>;
/** Emit adapter only. The caller supplies the real domain guard/mutation and the same-session scope port. */
export const commitRecurrenceActivity = (context: ActivityAuthority, command: Command, intents: readonly RecurrenceActivityIntent[], scope: RecurrenceScopePort, mutate: (session: ClientSession) => Promise<boolean>) =>
    commitActivity(context, command, checked(intents), mutate, scope);
export const writeRecurrenceActivityInSession = (session: ClientSession, context: ActivityAuthority, command: Command, intents: readonly RecurrenceActivityIntent[], scope: RecurrenceScopePort, mutate: (session: ClientSession) => Promise<boolean>) =>
    writeActivityInSession(session, context, command, checked(intents), mutate, scope);
export const reconcileRecurrenceActivity = (context: ActivityAuthority, command: Command, intents: readonly RecurrenceActivityIntent[], scope: RecurrenceScopePort, session?: ClientSession) =>
    reconcileActivity(context, command, checked(intents), session, scope);
