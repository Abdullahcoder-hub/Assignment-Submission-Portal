import { NextFunction, Request, Response } from 'express';

const maxConcurrentExports = 1;
let activeExports = 0;

export const limitZipExports = (_req: Request, res: Response, next: NextFunction): void => {
  if (activeExports >= maxConcurrentExports) {
    res.setHeader('Retry-After', '30');
    res.status(429).json({
      success: false,
      message: 'Another ZIP export is already running. Please try again shortly.',
    });
    return;
  }

  activeExports += 1;
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    activeExports -= 1;
  };
  res.once('finish', release);
  res.once('close', release);
  next();
};
