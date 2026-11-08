import { Router } from 'express';
import { ActivityReadError, readAccountActivity } from '../services/activity-read.js';
const r = Router();
r.get('/:accountId/activity', async (req, res) => {
    try {
        res.json(await readAccountActivity(req, req.params.accountId, req.query));
    } catch (error) {
        const status = error instanceof ActivityReadError ? error.status : 503;
        if (status === 404) return res.sendStatus(404);
        return res.status(status).json({ error: error instanceof ActivityReadError ? error.code : 'ACTIVITY_UNAVAILABLE' });
    }
});
export default r;
