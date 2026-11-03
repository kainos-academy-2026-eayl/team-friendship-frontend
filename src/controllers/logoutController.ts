import { type Request, type Response, Router } from 'express';
import { endSession } from '../services/sessionService';
import {
    backendUrl,
    clearSessionCookies,
    REFRESH_COOKIE,
} from './sessionController';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
    const refreshToken: unknown = req.cookies?.[REFRESH_COOKIE];
    if (typeof refreshToken === 'string' && refreshToken.length > 0) {
        await endSession(backendUrl(), refreshToken).catch(() => { });
    }

    clearSessionCookies(res);
    res.redirect('/login');
});

export default router;
