import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    success: true,
    message: databaseConnected ? 'API is running' : 'API is running, but database is unavailable',
    database: databaseConnected ? 'connected' : 'disconnected',
  });
});

export default router;
