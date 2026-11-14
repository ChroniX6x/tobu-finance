import { DateTime } from "luxon";
import type { ActivityItem } from "@tobu/contracts/activity";

export interface ActivityGroup {
  key: string;
  events: ActivityItem[];
  grouped: boolean;
}
/** Rebuild from all loaded pages, never invent an expected count or a successful batch result. */
export function groupLoadedActivity(
  items: readonly ActivityItem[],
): ActivityGroup[] {
  const seen = new Set<string>();
  const groups = new Map<string, ActivityGroup>();
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const key = item.group ? "group:" + item.group.key : "event:" + item.id;
    const group = groups.get(key) ?? {
      key,
      events: [],
      grouped: item.group?.source === "batch",
    };
    group.events.push(item);
    group.grouped ||= group.events.length > 1;
    groups.set(key, group);
  }
  return [...groups.values()];
}
export const activityDisplayZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
export function formatActivityInstant(
  instant: string,
  zone = activityDisplayZone(),
) {
  const value = DateTime.fromISO(instant, { zone: "utc" }).setZone(zone);
  return value.isValid
    ? value.setLocale("de").toFormat("dd.LL.yyyy HH:mm:ss ZZZZ")
    : "Zeitpunkt nicht verfügbar";
}
