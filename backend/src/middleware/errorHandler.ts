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

  // Mongoose CastError (invalid ObjectId or type conversion)
  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      message: 'Invalid resource identifier provided.',
    });
    return;
  }

  // CORS policy rejection
  if (err.message && err.message.startsWith('CORS policy:')) {
    res.status(403).json({
      success: false,
      message: 'Origin not allowed by CORS policy.',
    });
    return;
  }

  // Default internal server error response (sanitized for client security)
  res.status(err.status || 500).json({
    success: false,
    message: err.clientMessage || 'Something went wrong on the server. Please try again.',
  });
};
