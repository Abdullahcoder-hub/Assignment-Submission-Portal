import axios from 'axios';
import type JSZip from 'jszip';
import type { PDFDocument as PDFDocumentType } from 'pdf-lib';
import api from '../api/axios';

const megabyte = 1024 * 1024;
const readClientLimit = (name: string, defaultValue: number): number => {
  const configuredValue = import.meta.env[name];
  if (configuredValue === undefined || configuredValue.trim() === '') return defaultValue;
  const parsedValue = Number(configuredValue);
  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsedValue;
};
const maxClientExportBytes = readClientLimit('VITE_CLIENT_EXPORT_MAX_SIZE_MB', 40) * megabyte;
const maxClientFiles = readClientLimit('VITE_CLIENT_EXPORT_MAX_FILES', 100);
const maxClientPdfPages = readClientLimit('VITE_CLIENT_EXPORT_MAX_PDF_PAGES', 500);

type ExportManifest = {
  success: boolean;
  assignment: { id: string; title: string; submissionType: 'Individual' | 'Group' };
  limits: {
    maxFiles: number;
    maxFileBytes: number;
    maxTotalBytes: number;
    maxPdfPages: number;
  };
  submissions: Array<{
    id: string;
    rollNumber: string;
    originalFileName: string;
    fileSize: number;
    groupId: string | null;
    groupName: string | null;
    sequenceNumber: number | null;
  }>;
};

type SaveFileHandle = {
  createWritable: () => Promise<{
    write: (chunk: Uint8Array) => Promise<void>;
    close: () => Promise<void>;
    abort: () => Promise<void>;
  }>;
};

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<SaveFileHandle>;
};

const safeFileName = (value: string): string =>
  value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').trim() || 'Assignment';

const getExportUnits = (manifest: ExportManifest) => {
  const hasGroupMetadata = manifest.submissions.some((submission) =>
    Boolean(submission.groupId && submission.groupName?.trim())
  );
  const isGroupAssignment = manifest.assignment.submissionType === 'Group'
    || (manifest.assignment.submissionType !== 'Individual' && hasGroupMetadata);
  if (!isGroupAssignment) {
    return manifest.submissions.map((submission) => ({
      fileName: `${safeFileName(submission.rollNumber)}.pdf`,
      submissions: [submission],
    }));
  }

  const groups = new Map<string, {
    name: string;
    submissions: ExportManifest['submissions'];
  }>();
  for (const submission of manifest.submissions) {
    const groupId = submission.groupId || `unmatched:${submission.id}`;
    const groupName = submission.groupName?.trim() || `Submission_${submission.rollNumber}`;
    const group = groups.get(groupId) || {
      name: groupName,
      submissions: [],
    };
    group.submissions.push(submission);
    groups.set(groupId, group);
  }

  return [...groups.values()]
    .sort((first, second) => first.name.localeCompare(second.name, undefined, { numeric: true, sensitivity: 'base' }))
    .map((group) => ({
      fileName: `${safeFileName(group.name)}.pdf`,
      submissions: group.submissions.sort((first, second) => {
        const firstSequence = first.sequenceNumber !== null
          && Number.isSafeInteger(first.sequenceNumber)
          && first.sequenceNumber > 0
          ? first.sequenceNumber
          : null;
        const secondSequence = second.sequenceNumber !== null
          && Number.isSafeInteger(second.sequenceNumber)
          && second.sequenceNumber > 0
          ? second.sequenceNumber
          : null;
        if (firstSequence === null) {
          return secondSequence === null
            ? first.rollNumber.localeCompare(second.rollNumber, undefined, { numeric: true, sensitivity: 'base' })
            : 1;
        }
        if (secondSequence === null) return -1;
        return firstSequence - secondSequence
          || first.rollNumber.localeCompare(second.rollNumber, undefined, { numeric: true, sensitivity: 'base' });
      }),
    }));
};

const getUniquePdfName = (fileName: string, usedNames: Set<string>): string => {
  if (!usedNames.has(fileName.toLowerCase())) {
    usedNames.add(fileName.toLowerCase());
    return fileName;
  }
  const dotIndex = fileName.toLowerCase().lastIndexOf('.pdf');
  const baseName = dotIndex < 0 ? fileName : fileName.slice(0, dotIndex);
  let suffix = 2;
  let uniqueName = `${baseName}_${suffix}.pdf`;
  while (usedNames.has(uniqueName.toLowerCase())) {
    suffix += 1;
    uniqueName = `${baseName}_${suffix}.pdf`;
  }
  usedNames.add(uniqueName.toLowerCase());
  return uniqueName;
};

const saveZipToHandle = async (zip: JSZip, handle: SaveFileHandle): Promise<void> => {
  const writable = await handle.createWritable();
  const stream = zip.generateInternalStream({
    type: 'uint8array',
    streamFiles: true,
    compression: 'STORE',
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      void writable.abort().catch(() => undefined);
      reject(error);
    };

    stream.on('data', (chunk: Uint8Array) => {
      stream.pause();
      void writable.write(chunk).then(
        () => {
          if (!settled) stream.resume();
        },
        fail,
      );
    });
    stream.on('error', fail);
    stream.on('end', () => {
      if (settled) return;
      settled = true;
      void writable.close().then(resolve, reject);
    });
    stream.resume();
  });
};

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const responseErrorMessage = async (error: unknown): Promise<string> => {
  if (!axios.isAxiosError(error)) return error instanceof Error ? error.message : 'The request failed.';
  const data: unknown = error.response?.data;
  if (data instanceof ArrayBuffer) {
    try {
      const parsed: unknown = JSON.parse(new TextDecoder().decode(data));
      if (typeof parsed === 'object' && parsed !== null && 'message' in parsed && typeof parsed.message === 'string') {
        return parsed.message;
      }
    } catch {
      return error.message;
    }
  }
  if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
    return data.message;
  }
  return error.message;
};

export const createClientAssignmentExport = async (
  assignmentId: string,
  onProgress: (completed: number, total: number) => void,
): Promise<void> => {
  const savePicker = (window as SavePickerWindow).showSaveFilePicker;
  const saveHandlePromise = savePicker
    ? savePicker.call(window, {
        suggestedName: 'Assignment_Submissions.zip',
        types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
      })
    : undefined;
  const saveHandle = saveHandlePromise ? await saveHandlePromise : undefined;

  const manifestResponse = await api.get<ExportManifest>(
    `/assignments/${encodeURIComponent(assignmentId)}/submissions/export-manifest`,
  );
  const manifest = manifestResponse.data;
  const submissions = manifest.submissions;

  if (!manifest.success || submissions.length === 0) {
    throw new Error('No submissions are available for this assignment.');
  }
  if (submissions.length > Math.min(manifest.limits.maxFiles, maxClientFiles)) {
    throw new Error('This export exceeds the supported file count limit.');
  }

  const declaredTotalBytes = submissions.reduce((total, submission) => total + submission.fileSize, 0);
  const allowedBytes = Math.min(manifest.limits.maxTotalBytes, maxClientExportBytes);
  const maxFileBytes = Math.min(manifest.limits.maxFileBytes, maxClientExportBytes);
  const maxPages = Math.min(manifest.limits.maxPdfPages, maxClientPdfPages);
  if (declaredTotalBytes > allowedBytes || submissions.some((submission) => submission.fileSize > maxFileBytes)) {
    throw new Error(`For browser memory safety, this export is limited to ${Math.floor(allowedBytes / megabyte)} MB.`);
  }

  const [{ PDFDocument }, { default: JSZipConstructor }] = await Promise.all([
    import('pdf-lib'),
    import('jszip'),
  ]);
  const exportUnits = getExportUnits(manifest);
  const zip = new JSZipConstructor();
  const usedPdfNames = new Set<string>();
  let retrievedBytes = 0;
  let totalPages = 0;

  let completedSubmissions = 0;
  let generatedPdfBytes = 0;
  for (const unit of exportUnits) {
    const unitPdf = await PDFDocument.create();
    for (const submission of unit.submissions) {
      let response;
      try {
        response = await api.get<ArrayBuffer>(
          `/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submission.id)}/export-pdf`,
          { responseType: 'arraybuffer' },
        );
      } catch (error) {
        throw new Error(`Could not process ${submission.rollNumber} (${submission.originalFileName}): ${await responseErrorMessage(error)}`);
      }
      const pdfBytes = new Uint8Array(response.data);
      retrievedBytes += pdfBytes.byteLength;
      if (pdfBytes.byteLength === 0 || pdfBytes.byteLength > maxFileBytes || retrievedBytes > allowedBytes) {
        throw new Error(`The converted PDF for ${submission.rollNumber} exceeds the browser export size limit.`);
      }
      if (pdfBytes[0] !== 0x25 || pdfBytes[1] !== 0x50 || pdfBytes[2] !== 0x44 || pdfBytes[3] !== 0x46) {
        throw new Error(`The file for ${submission.rollNumber} was not returned as a valid PDF.`);
      }

      let sourcePdf: PDFDocumentType;
      try {
        sourcePdf = await PDFDocument.load(pdfBytes);
      } catch {
        throw new Error(`The PDF for ${submission.rollNumber} is unreadable or protected.`);
      }

      const pageIndices = sourcePdf.getPageIndices();
      totalPages += pageIndices.length;
      if (totalPages > maxPages) {
        throw new Error(`This export exceeds the ${maxPages}-page browser processing limit.`);
      }
      const copiedPages = await unitPdf.copyPages(sourcePdf, pageIndices);
      copiedPages.forEach((page) => unitPdf.addPage(page));
      completedSubmissions += 1;
      onProgress(completedSubmissions, submissions.length);
    }

    if (unitPdf.getPageCount() === 0) {
      throw new Error(`${unit.fileName} did not contain any PDF pages.`);
    }
    const unitBytes = await unitPdf.save();
    generatedPdfBytes += unitBytes.byteLength;
    if (generatedPdfBytes > allowedBytes) {
      throw new Error(`The exported PDFs exceed the ${Math.floor(allowedBytes / megabyte)} MB browser limit.`);
    }
    zip.file(getUniquePdfName(unit.fileName, usedPdfNames), unitBytes, { compression: 'STORE' });
  }

  const zipName = `${safeFileName(manifest.assignment.title)}_Submissions.zip`;

  if (saveHandle) {
    await saveZipToHandle(zip, saveHandle);
  } else {
    const blob = await zip.generateAsync({
      type: 'blob',
      streamFiles: true,
      compression: 'STORE',
    });
    if (blob.size > allowedBytes + megabyte) {
      throw new Error(`The ZIP exceeds the ${Math.floor(allowedBytes / megabyte)} MB browser download limit.`);
    }
    downloadBlob(blob, zipName);
  }
};
