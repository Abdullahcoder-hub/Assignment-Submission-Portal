import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    ready: databaseConnected,
    message: databaseConnected ? 'API is ready' : 'Database is unavailable',
    database: databaseConnected ? 'connected' : 'disconnected',
    poolId: process.env.BACKEND_POOL_ID || null,
    apiCompatibilityVersion: process.env.API_COMPATIBILITY_VERSION || 'v1',
  });
});

export default router;
