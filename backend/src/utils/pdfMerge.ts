import { execFile } from 'node:child_process';
import { mkdtemp, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { PDFDocument } from 'pdf-lib';
import { logError } from './logger.js';

const execFileAsync = promisify(execFile);

export class OfficeConversionError extends Error {}
export class PdfMergeError extends Error {}

export const convertFileToPdfFile = async (
  inputPath: string,
  fileName: string,
  outputPath: string,
  signal?: AbortSignal,
): Promise<void> => {
  const extension = path.extname(fileName).toLowerCase();
  if (['.jpg', '.jpeg', '.png'].includes(extension)) {
    try {
      if (signal?.aborted) throw new Error('Conversion cancelled.');
      const buffer = await readFile(inputPath);
      if (signal?.aborted) throw new Error('Conversion cancelled.');
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
      const pdfBytes = await pdf.save();
      if (signal?.aborted) throw new Error('Conversion cancelled.');
      await writeFile(outputPath, pdfBytes);
    } catch (error) {
      if (signal?.aborted) throw error;
      logError(`[Image Conversion Error] Failed to convert ${fileName}.`, error);
      throw new OfficeConversionError(`Could not convert ${fileName} to PDF. Check that the file is valid.`);
    }
    return;
  }

  const workingDirectory = await mkdtemp(path.join(os.tmpdir(), 'assignment-office-convert-'));
  const profilePath = path.join(workingDirectory, 'profile');
  const convertedPath = path.join(workingDirectory, `${path.basename(inputPath, path.extname(inputPath))}.pdf`);

  try {
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
    ], { timeout: 90_000, maxBuffer: 1024 * 1024, signal });

    const converted = await open(convertedPath, 'r');
    try {
      const signature = Buffer.alloc(4);
      await converted.read(signature, 0, signature.length, 0);
      if (!signature.equals(Buffer.from('%PDF'))) {
        throw new Error(`LibreOffice returned an invalid PDF for ${fileName}.`);
      }
    } finally {
      await converted.close();
    }
    await rename(convertedPath, outputPath);
  } catch (error) {
    if (signal?.aborted) throw error;
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

export const mergePdfFiles = async (pdfPaths: string[], outputPath: string): Promise<void> => {
  if (pdfPaths.length === 0) {
    throw new PdfMergeError('There are no PDF files to merge.');
  }

  try {
    await execFileAsync('qpdf', ['--empty', '--pages', ...pdfPaths, '--', outputPath], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    });

    const output = await open(outputPath, 'r');
    try {
      const signature = Buffer.alloc(4);
      await output.read(signature, 0, signature.length, 0);
      if (!signature.equals(Buffer.from('%PDF')) || (await stat(outputPath)).size === 0) {
        throw new Error('qpdf returned an invalid PDF.');
      }
    } finally {
      await output.close();
    }
  } catch (error) {
    logError('[Disk PDF Merge Error]', error);
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    if (code === 'ENOENT') {
      throw new PdfMergeError('qpdf is unavailable. Deploy the Docker backend to merge group PDFs.');
    }
    throw new PdfMergeError('Could not merge the group PDFs. Check that all submitted files are valid.');
  }
};

export const getGroupSequence = (groupName: string): number => {
  const match = groupName?.match(/(?:Group|Team|#)?\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
};
