import type { Request, Response, NextFunction } from 'express-serve-static-core';
import { verifyAccessToken } from './jwt.js';
import { User } from './models.js';

declare module 'express-serve-static-core' {
    interface Request {
        user?: { sub: string; roles?: string[]; email?: string };
    }
}

/**
 * Verifies the access token and the account behind it on every request: a deleted or deactivated (blocked) user loses
 * access immediately, even with a still valid token. Roles come from the database, not from the token claim.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = header.slice('Bearer '.length);
    let sub: string;
    try {
        sub = verifyAccessToken(token).sub;
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    try {
        const user = /^[a-f\d]{24}$/i.test(sub) ? await User.findById(sub, { isActive: 1, roles: 1, email: 1 }).lean() : null;
        if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid or expired token' });
        req.user = { sub: String(user._id), roles: user.roles ?? [], email: user.email };
        next();
    } catch (error) {
        next(error);
    }
}

export function requireRole(role: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        const roles = req.user?.roles || [];
        if (!roles.includes(role)) return res.status(403).json({ error: 'Forbidden' });
        next();
    };
}
