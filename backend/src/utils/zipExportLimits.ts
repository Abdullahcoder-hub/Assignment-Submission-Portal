const megabyte = 1024 * 1024;

const readPositiveLimit = (name: string, defaultValue: number): number => {
  const configuredValue = process.env[name];
  if (configuredValue === undefined || configuredValue.trim() === '') return defaultValue;

  const parsedValue = Number(configuredValue);
  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsedValue;
};

export const zipExportLimits = {
  maxFiles: readPositiveLimit('MAX_ZIP_EXPORT_FILES', 200),
  maxFileBytes: readPositiveLimit('MAX_ZIP_EXPORT_FILE_SIZE_MB', 50) * megabyte,
  maxTotalBytes: readPositiveLimit('MAX_ZIP_EXPORT_TOTAL_SIZE_MB', 200) * megabyte,
  maxPdfPages: readPositiveLimit('MAX_ZIP_EXPORT_PDF_PAGES', 2000),
};

export class ZipExportLimitError extends Error {
  readonly statusCode = 413;
}
