import path from 'path';

/**
 * Sanitizes a filename to prevent path traversal and malicious filenames
 */
export const sanitizeFileName = (fileName: string): string => {
  // Remove paths, null bytes, control chars
  const basename = path.basename(fileName).replace(/[\0\x00-\x1F\x7F-\x9F]/g, '');
  // Keep extension, sanitize base
  const ext = path.extname(basename);
  const nameWithoutExt = path.basename(basename, ext);

  const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9_\-\.]/g, '_').substring(0, 80);
  const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  return cleanExt ? `${cleanName}.${cleanExt}` : cleanName;
};

/**
 * Validates file extension against allowed types
 */
export const isFileTypeAllowed = (fileName: string, allowedTypes: string[]): boolean => {
  if (!allowedTypes || allowedTypes.length === 0) return true;
  const ext = path.extname(fileName).replace('.', '').toLowerCase();
  const normalizedAllowed = allowedTypes.map((t) => t.replace('.', '').toLowerCase());
  return normalizedAllowed.includes(ext);
};

/**
 * Validates file size in bytes against max limit in MB
 */
export const isFileSizeValid = (fileSizeBytes: number, maxFileSizeMB: number): boolean => {
  const maxBytes = maxFileSizeMB * 1024 * 1024;
  return fileSizeBytes <= maxBytes;
};
