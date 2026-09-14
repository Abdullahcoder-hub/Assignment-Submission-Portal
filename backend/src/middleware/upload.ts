import multer from 'multer';

// Use memory storage so files are held in buffer before uploading to Cloudinary
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB absolute upper bound for multer buffer (specific assignment limits checked in controller)
  },
});
