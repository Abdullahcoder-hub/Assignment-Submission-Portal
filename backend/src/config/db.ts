import mongoose from 'mongoose';
import dns from 'node:dns';

export const connectDB = async (): Promise<void> => {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/assignment_submission_db';
    if (connStr.startsWith('mongodb+srv://')) {
      const dnsServers = (process.env.MONGODB_DNS_SERVERS || '1.1.1.1,8.8.8.8')
        .split(',')
        .map((server) => server.trim())
        .filter(Boolean);
      dns.setServers(dnsServers);
    }

    const conn = await mongoose.connect(connStr, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`[MongoDB] Connected: ${conn.connection.host}`);

    // Synchronize Group model indexes to drop legacy non-subject-wise indexes
    try {
      const Group = (await import('../models/Group.js')).default;
      await (Group as any).syncIndexes();
      console.log('[MongoDB] Group indexes synchronized successfully.');
    } catch (idxErr) {
      console.warn('[MongoDB] Group index sync warning:', idxErr);
    }
  } catch (error) {
    console.error('[MongoDB] Connection Error:', error);
    throw error;
  }
};
