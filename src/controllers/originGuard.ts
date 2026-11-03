import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isSameOrigin(req: Request): boolean {
    const fetchSite = req.get('sec-fetch-site');
    if (fetchSite) {
        // 'none' is a user-initiated navigation such as a bookmark.
        return fetchSite === 'same-origin' || fetchSite === 'none';
    }

    const origin = req.get('origin');
    if (origin) {
        try {
            return new URL(origin).host === req.get('host');
        } catch {
            return false;
        }
    }

    // Browsers always send one of the headers above on cross-site POSTs.
    return true;
}

export function requireSameOrigin(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    if (SAFE_METHODS.has(req.method) || isSameOrigin(req)) {
        next();
        return;
    }
    res.status(403).type('text/plain').send('Cross-site request rejected');
}
