export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  }
  return secret;
};

export const validateStartupSecurityConfig = (): void => {
  getJwtSecret();
  if (process.env.NODE_ENV !== 'production') return;

  const required = [
    'MONGODB_URI',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'BREVO_API_KEY',
    'BREVO_SENDER_EMAIL',
    'FRONTEND_URL',
    'BACKEND_URL',
  ];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  }

  for (const key of ['FRONTEND_URL', 'BACKEND_URL']) {
    const value = process.env[key] as string;
    if (new URL(value).protocol !== 'https:') {
      throw new Error(`${key} must use HTTPS in production.`);
    }
  }

  if (/\b(localhost|127\.0\.0\.1)\b/i.test(process.env.MONGODB_URI as string)) {
    throw new Error('MONGODB_URI must not point to localhost in production.');
  }
};