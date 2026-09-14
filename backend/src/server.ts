import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Start the API even when Atlas is temporarily unreachable; the connection is retried below.
const startServer = async () => {
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Health Check: http://localhost:${PORT}/health`);
    console.log(`==================================================`);
  });

  const connectWithRetry = async (): Promise<void> => {
    try {
      await connectDB();
    } catch {
      console.log('[MongoDB] Retrying connection in 10 seconds...');
      setTimeout(connectWithRetry, 10000);
    }
  };

  await connectWithRetry();
};

startServer();
