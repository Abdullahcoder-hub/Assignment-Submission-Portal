import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error('[Global Error Handler]:', err);

  // Multer error handling
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ success: false, message: 'File size exceeds the maximum allowed upload limit.' });
      return;
    }
    res.status(400).json({ success: false, message: `File upload error: ${err.message}` });
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e: any) => e.message);
    res.status(400).json({ success: false, message: messages.join(', ') || 'Validation failed.' });
    return;
  }

  // Duplicate key error
  if (err.code === 11000) {
    res.status(400).json({
      success: false,
      message: 'This record already exists in the system.',
    });
    return;
  }

  // Default internal server error response (sanitized for client security)
  res.status(err.status || 500).json({
    success: false,
    message: err.clientMessage || 'Something went wrong on the server. Please try again.',
  });
};
