export const logError = (message: string, error: unknown): void => {
  const errorName = error instanceof Error && /^[A-Za-z]+Error$/.test(error.name)
    ? error.name
    : 'UnknownError';
  const statusCode = typeof error === 'object' && error !== null
    ? (error as any).http_code ?? (error as any).error?.http_code ?? (error as any).response?.status
    : undefined;
  console.error(message, errorName, Number.isInteger(statusCode) ? `HTTP ${statusCode}` : '');
};