export const logError = (message: string, error: unknown): void => {
  const errorObject = typeof error === 'object' && error !== null ? error : undefined;
  const errorNameValue = error instanceof Error
    ? error.name
    : errorObject && 'name' in errorObject && typeof errorObject.name === 'string'
      ? errorObject.name
      : '';
  const errorName = /^[A-Za-z]+Error$/.test(errorNameValue) ? errorNameValue : 'UnknownError';
  const rawErrorMessage = error instanceof Error
    ? error.message
    : errorObject && 'message' in errorObject && typeof errorObject.message === 'string'
      ? errorObject.message
      : typeof error === 'string'
        ? error
        : '';
  let safeErrorMessage = rawErrorMessage.replace(/(mongodb(?:\+srv)?:\/\/)[^/\s@]+@/gi, '$1[REDACTED]@');
  for (const key of ['MONGODB_URI', 'JWT_SECRET', 'CLOUDINARY_API_SECRET', 'BREVO_API_KEY', 'ADMIN_PASSWORD']) {
    const secret = process.env[key];
    if (secret) {
      safeErrorMessage = safeErrorMessage.split(secret).join('[REDACTED]');
    }
  }
  const statusCode = typeof error === 'object' && error !== null
    ? (error as any).http_code ?? (error as any).error?.http_code ?? (error as any).response?.status
    : undefined;
  console.error(
    message,
    errorName,
    Number.isInteger(statusCode) ? `HTTP ${statusCode}` : '',
    safeErrorMessage ? `- ${safeErrorMessage}` : ''
  );
};