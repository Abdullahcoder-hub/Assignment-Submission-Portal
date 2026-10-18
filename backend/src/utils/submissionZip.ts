import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { addMissingStudentIdentity } from './submissionPdfIdentity.js';
import { convertFileToPdfFile, getGroupSequence, mergePdfFiles } from './pdfMerge.js';
import { downloadFileToPath } from './downloadFileToPath.js';
import { sanitizePathSegment } from '../config/cloudinary.js';
import { logError } from './logger.js';

export interface ZipSubmission {
  studentName: string;
  rollNumber: string;
  cloudinarySecureUrl: string;
  cloudinaryPublicId: string;
  originalFileName: string;
  groupName?: string | null;
  groupId?: { toString: () => string } | string | null;
  sequenceNumber?: number | null;
}

export interface ZipArchiveFile {
  path: string;
  name: string;
}

interface PreparedSubmission {
  submission: ZipSubmission;
  sourcePath: string;
  extension: string;
  archiveName: string;
  sequenceNumber: number;
}

interface PrepareSubmissionZipOptions {
  submissions: ZipSubmission[];
  subjectCode: string;
  assignmentFolder: string;
  isGroupAssignment: boolean;
  stagingDirectory: string;
  getDownloadUrls: (submission: ZipSubmission) => string[];
}

const separateFileExtensions = new Set([
  '.zip', '.ppt', '.pptx', '.xls', '.xlsx', '.xlsm', '.xlsb', '.ods', '.csv',
]);

const withUniqueName = (name: string, usedNames: Set<string>): string => {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }

  const extension = path.posix.extname(name);
  const baseName = name.slice(0, name.length - extension.length);
  let duplicateNumber = 1;
  let uniqueName = `${baseName}_${duplicateNumber}${extension}`;
  while (usedNames.has(uniqueName)) {
    duplicateNumber += 1;
    uniqueName = `${baseName}_${duplicateNumber}${extension}`;
  }
  usedNames.add(uniqueName);
  return uniqueName;
};

export const prepareSubmissionZipFiles = async ({
  submissions,
  subjectCode,
  assignmentFolder,
  isGroupAssignment,
  stagingDirectory,
  getDownloadUrls,
}: PrepareSubmissionZipOptions): Promise<ZipArchiveFile[]> => {
  const filesToArchive: ZipArchiveFile[] = [];
  const usedArchiveNames = new Set<string>();
  const groups = new Map<string, PreparedSubmission[]>();

  for (const [index, submission] of submissions.entries()) {
    if (!submission.cloudinarySecureUrl && !submission.cloudinaryPublicId) continue;

    const originalFileName = submission.originalFileName || 'submission.bin';
    const extension = path.extname(originalFileName).toLowerCase() || '.bin';
    const groupId = submission.groupId ? submission.groupId.toString() : 'individual';
    const groupFolder = isGroupAssignment
      ? sanitizePathSegment(submission.groupId ? submission.groupName || 'group' : 'individual')
      : '';
    const archiveFolder = [sanitizePathSegment(subjectCode), assignmentFolder, groupFolder].filter(Boolean).join('/');
    const fileBase = `${sanitizePathSegment(submission.rollNumber)}-${sanitizePathSegment(submission.studentName)}${extension}`;
    const archiveName = withUniqueName(`${archiveFolder}/${fileBase}`, usedArchiveNames);
    const sourcePath = path.join(stagingDirectory, `source-${index}${extension}`);

    try {
      await downloadFileToPath(
        [submission.cloudinarySecureUrl, ...getDownloadUrls(submission)],
        sourcePath,
      );
      const prepared = {
        submission,
        sourcePath,
        extension,
        archiveName,
        sequenceNumber: submission.sequenceNumber ?? index + 1,
      };

      if (!isGroupAssignment) {
        filesToArchive.push({ path: sourcePath, name: archiveName });
      } else if (separateFileExtensions.has(extension)) {
        filesToArchive.push({ path: sourcePath, name: archiveName });
      } else {
        const group = groups.get(groupId) || [];
        group.push(prepared);
        groups.set(groupId, group);
      }
    } catch (error) {
      logError('[ZIP Stream File Error] Failed to prepare a submission.', error);
      throw error;
    }
  }

  for (const [groupId, groupSubmissions] of groups) {
    const pdfPaths: Array<{ path: string; sequenceNumber: number }> = [];
    for (const [index, item] of groupSubmissions.entries()) {
      let pdfPath = item.sourcePath;
      if (item.extension !== '.pdf') {
        pdfPath = path.join(stagingDirectory, `converted-${groupId}-${index}.pdf`);
        try {
          await convertFileToPdfFile(item.sourcePath, item.submission.originalFileName, pdfPath);
        } catch (error) {
          logError('[ZIP Group Error] Failed to convert a submission to PDF.', error);
          throw error;
        }
      }

      try {
        const pdfWithIdentity = await addMissingStudentIdentity(
          await readFile(pdfPath),
          item.submission.studentName,
          item.submission.rollNumber,
        );
        await writeFile(pdfPath, pdfWithIdentity);
      } catch (error) {
        logError('[ZIP Group Error] Failed to add student identity to a PDF.', error);
        throw error;
      }

      pdfPaths.push({ path: pdfPath, sequenceNumber: item.sequenceNumber });
    }

    if (pdfPaths.length === 0) continue;
    pdfPaths.sort((first, second) => first.sequenceNumber - second.sequenceNumber);
    const groupName = groupSubmissions[0].submission.groupName || '';
    const groupNumber = groupId === 'individual' ? 'Individual' : getGroupSequence(groupName);
    const groupFolder = sanitizePathSegment(
      groupSubmissions[0].submission.groupId ? groupName || 'group' : 'individual',
    );
    const mergedPdfPath = path.join(stagingDirectory, `merged-${groupId}.pdf`);
    try {
      await mergePdfFiles(pdfPaths.map((pdf) => pdf.path), mergedPdfPath);
    } catch (error) {
      logError('[ZIP Group Error] Failed to merge group PDFs.', error);
      throw error;
    }
    const mergedName = withUniqueName(
      `${sanitizePathSegment(subjectCode)}/${assignmentFolder}/${groupFolder}/Group ${groupNumber}.pdf`,
      usedArchiveNames,
    );
    filesToArchive.push({ path: mergedPdfPath, name: mergedName });
  }

  return filesToArchive;
};
