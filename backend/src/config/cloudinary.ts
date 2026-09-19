import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Sanitize strings for Cloudinary public_ids and path segments to prevent path traversal or unsafe characters.
 */
export const sanitizePathSegment = (str: string): string => {
  return str
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
};

/**
 * Upload file buffer directly to Cloudinary
 */
export const uploadToCloudinary = (
  fileBuffer: Buffer,
  originalFilename: string,
  subjectCode: string,
  assignmentTitle: string,
  rollNumber: string,
  groupName?: string
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const cleanSubject = sanitizePathSegment(subjectCode);
    const cleanAssignment = sanitizePathSegment(assignmentTitle);
    const cleanRoll = sanitizePathSegment(rollNumber);
    const timestamp = Date.now();

    const folderPath = `assignment-submissions/${cleanSubject}/${cleanAssignment}`;

    // If this is a group submission, prefix the public_id with the sanitized group name
    const cleanGroup = groupName ? sanitizePathSegment(groupName) : null;
    const publicId = cleanGroup
      ? `${cleanGroup}_${cleanRoll}_${timestamp}`
      : `${cleanRoll}_${timestamp}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath,
        public_id: publicId,
        resource_type: 'auto',
        use_filename: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) {
          console.error('[Cloudinary Upload Error]:', error);
          return reject(error || new Error('Cloudinary upload failed with empty result.'));
        }
        resolve(result);
      }
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Delete file from Cloudinary by public ID
 */
export const deleteFromCloudinary = async (publicId: string, resourceType: string = 'raw'): Promise<boolean> => {
  try {
    if (!publicId) return false;
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType as any, invalidate: true });
    if (result.result !== 'ok' && result.result !== 'not found') {
      // Try image or auto as fallback
      await cloudinary.uploader.destroy(publicId, { invalidate: true });
    }
    console.log(`[Cloudinary Delete] Deleted ${publicId}:`, result);
    return true;
  } catch (error) {
    console.error(`[Cloudinary Delete Error] Failed to delete public_id ${publicId}:`, error);
    return false;
  }
};

export default cloudinary;
