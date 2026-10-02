import mongoose from 'mongoose';
import dns from 'node:dns';
import { logError } from '../utils/logger.js';

export const connectDB = async (syncGroupIndexes = true): Promise<void> => {
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
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 50,
      minPoolSize: 5,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 10000,
    });
    console.log('[MongoDB] Connected.');

    if (syncGroupIndexes) {
      // Synchronize Group model indexes to drop legacy non-subject-wise indexes
      try {
        const groupMod = await import('../models/Group.js');
        const GroupModel = (groupMod.default as any) || mongoose.models.Group;
        if (GroupModel && typeof GroupModel.syncIndexes === 'function') {
          await GroupModel.syncIndexes();
          console.log('[MongoDB] Group indexes synchronized successfully.');
        } else if (mongoose.models.Group && typeof mongoose.models.Group.syncIndexes === 'function') {
          await mongoose.models.Group.syncIndexes();
          console.log('[MongoDB] Group indexes synchronized successfully.');
        }
      } catch (idxErr: any) {
        logError('[MongoDB] Group index synchronization failed.', idxErr);
      }
    }
  } catch (error) {
    logError('[MongoDB] Connection failed.', error);
    throw error;
  }
};
