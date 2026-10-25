// Never cache "unlocked": a newly acquired migration lock must be visible on the next check.
// Coalesce concurrent reads and briefly cache only the conservative blocked result.
export function maintenanceCheck(readLocked: () => Promise<boolean>, now = () => performance.now()) {
    let blockedUntil = 0;
    let pending: Promise<boolean> | undefined;
    return async () => {
        if (now() < blockedUntil) return true;
        if (!pending) {
            pending = readLocked()
                .then((locked) => {
                    if (locked) blockedUntil = now() + 1000;
                    return locked;
                })
                .finally(() => {
                    pending = undefined;
                });
        }
        return pending;
    };
}
