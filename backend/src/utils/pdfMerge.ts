import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { PDFDocument } from 'pdf-lib';
import { logError } from './logger.js';

const execFileAsync = promisify(execFile);

export interface PDFToMerge {
  buffer: Buffer;
  sequenceNumber: number;
  studentName: string;
  rollNumber: string;
}

export class OfficeConversionError extends Error {}

export const convertFileToPdf = async (buffer: Buffer, fileName: string): Promise<Buffer> => {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  if (['.pdf', '.zip', '.ppt', '.pptx', '.xls', '.xlsx', '.xlsm', '.xlsb', '.ods', '.csv'].includes(extension)) {
    throw new Error(`Cannot convert ${fileName} to PDF.`);
  }

  if (['.jpg', '.jpeg', '.png'].includes(extension)) {
    const pdf = await PDFDocument.create();
    const image = extension === '.png'
      ? await pdf.embedPng(buffer)
      : await pdf.embedJpg(buffer);
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 36;
    const imageSize = image.scaleToFit(pageWidth - margin * 2, pageHeight - margin * 2);
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawImage(image, {
      x: (pageWidth - imageSize.width) / 2,
      y: (pageHeight - imageSize.height) / 2,
      ...imageSize,
    });
    return Buffer.from(await pdf.save());
  }

  const workingDirectory = await mkdtemp(path.join(os.tmpdir(), 'assignment-office-convert-'));
  const inputPath = path.join(workingDirectory, `submission${extension}`);
  const profilePath = path.join(workingDirectory, 'profile');
  const outputPath = path.join(workingDirectory, 'submission.pdf');

  try {
    await writeFile(inputPath, buffer, { flag: 'wx' });
    await execFileAsync('soffice', [
      '--headless',
      '--nologo',
      '--nodefault',
      '--nolockcheck',
      `-env:UserInstallation=${pathToFileURL(profilePath).href}`,
      '--convert-to',
      'pdf',
      '--outdir',
      workingDirectory,
      inputPath,
    ], { timeout: 90_000, maxBuffer: 1024 * 1024 });

    const pdf = await readFile(outputPath);
    if (!pdf.subarray(0, 4).equals(Buffer.from('%PDF'))) {
      throw new Error(`LibreOffice returned an invalid PDF for ${fileName}.`);
    }
    return pdf;
  } catch (error) {
    logError(`[Office Conversion Error] Failed to convert ${fileName}.`, error);
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    if (code === 'ENOENT') {
      throw new OfficeConversionError('LibreOffice is unavailable. Start the Docker backend to convert and merge this file.');
    }
    throw new OfficeConversionError(`Could not convert ${fileName} to PDF. Check that the file is valid.`);
  } finally {
    await rm(workingDirectory, { recursive: true, force: true }).catch((error: unknown) => {
      logError('[Office Conversion Error] Failed to remove temporary conversion files.', error);
    });
  }
};

export const mergePDFs = async (pdfs: PDFToMerge[]): Promise<Buffer> => {
  try {
    if (!pdfs || pdfs.length === 0) {
      throw new Error('No PDFs to merge');
    }

    // Sort by sequence number
    const sortedPdfs = [...pdfs].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    for (const pdf of sortedPdfs) {
      const sourcePdf = await PDFDocument.load(pdf.buffer);
      const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save();
    return Buffer.from(mergedPdfBytes);
  } catch (error) {
    logError('[PDF Merge Error]', error);
    throw new Error('Failed to merge PDFs');
  }
};

export const getGroupSequence = (groupName: string): number => {
  const match = groupName?.match(/(?:Group|Team|#)?\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
};
