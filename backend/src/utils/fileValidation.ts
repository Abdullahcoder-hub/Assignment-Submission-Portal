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

export const isFileSignatureValid = (fileName: string, buffer: Buffer): boolean => {
  const extension = path.extname(fileName).toLowerCase();
  const header = buffer.subarray(0, 8);
  const startsWith = (signature: number[]) => signature.every((byte, index) => header[index] === byte);

  if (extension === '.pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (['.doc', '.ppt'].includes(extension)) {
    return startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }
  if (['.zip', '.docx', '.pptx'].includes(extension)) {
    return startsWith([0x50, 0x4b, 0x03, 0x04]) || startsWith([0x50, 0x4b, 0x05, 0x06]) || startsWith([0x50, 0x4b, 0x07, 0x08]);
  }
  if (['.jpg', '.jpeg'].includes(extension)) {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (extension === '.png') return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (extension === '.gif') {
    const signature = buffer.subarray(0, 6).toString('ascii');
    return signature === 'GIF87a' || signature === 'GIF89a';
  }
  if (extension === '.webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return true;
};

/**
 * Validates file size in bytes against max limit in MB
 */
export const isFileSizeValid = (fileSizeBytes: number, maxFileSizeMB: number): boolean => {
  const maxBytes = maxFileSizeMB * 1024 * 1024;
  return fileSizeBytes <= maxBytes;
};

/**
 * Sanitizes CSV cell content against CSV Formula Injection / DDE attacks
 * Prevents Excel/Spreadsheet execution of malicious formulas starting with =, +, -, @, \t, \r
 */
export const sanitizeCsvField = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '""';
  let str = String(value).trim();
  
  // Escape formula injection characters
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  
  // Double-quote escape
  return `"${str.replace(/"/g, '""')}"`;
};

export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character] as string));
