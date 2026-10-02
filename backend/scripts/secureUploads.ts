import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cloudinary from '../src/config/cloudinary.js';
import { connectDB } from '../src/config/db.js';
import Submission from '../src/models/Submission.js';
import { logError } from '../src/utils/logger.js';

dotenv.config();

const secureUploads = async (): Promise<void> => {
  let failed = 0;
  try {
    await connectDB(false);
    const submissions = await Submission.find({ cloudinaryPublicId: { $exists: true, $ne: '' } })
      .select('cloudinaryPublicId cloudinaryResourceType')
      .lean();
    const assets = new Map<string, string>();

    for (const submission of submissions) {
      if (submission.cloudinaryPublicId) {
        assets.set(submission.cloudinaryPublicId, submission.cloudinaryResourceType || 'raw');
      }
    }

    let secured = 0;
    for (const [publicId, resourceType] of assets) {
      try {
        try {
          await cloudinary.api.resource(publicId, { resource_type: resourceType, type: 'authenticated' });
          continue;
        } catch (error: any) {
          const statusCode = error?.http_code ?? error?.error?.http_code ?? error?.response?.status;
          if (statusCode !== 404) throw error;
        }

        await cloudinary.uploader.rename(publicId, publicId, {
          resource_type: resourceType,
          type: 'upload',
          to_type: 'authenticated',
          invalidate: true,
        });
        secured += 1;
      } catch (error) {
        failed += 1;
        logError('[Cloudinary asset migration failed]', error);
      }
    }

    console.log(`Cloudinary asset migration complete: ${secured} secured, ${assets.size - secured - failed} already secured, ${failed} failed.`);
  } catch (error) {
    logError('Cloudinary asset migration could not complete.', error);
    failed += 1;
  } finally {
    await mongoose.disconnect();
  }

  if (failed > 0) process.exitCode = 1;
};

void secureUploads();