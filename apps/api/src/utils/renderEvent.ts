import { renderActivityText } from '@tobu/contracts/activity';

/** Shared catalog includes split labels; legacy unknown remains safely renderable. */
export function renderEventText(code: string, params: Record<string, unknown>): string {
    return renderActivityText({ code, params });
}
