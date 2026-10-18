import { Router, Request, Response } from 'express';
import { loadBackendRegistry } from '../utils/backendRegistry.js';

const router = Router();

router.get('/backends', async (_req: Request, res: Response): Promise<void> => {
  try {
    const configuration = await loadBackendRegistry();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      backends: configuration.backends,
      registryConfigured: configuration.registryConfigured,
      poolId: configuration.poolId,
      apiCompatibilityVersion: configuration.apiCompatibilityVersion,
    });
  } catch {
    res.status(503).json({ success: false, message: 'Backend discovery is temporarily unavailable.' });
  }
});

export default router;
