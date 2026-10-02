import { PDFDocument } from 'pdf-lib';
import { logError } from './logger.js';

export interface PDFToMerge {
  buffer: Buffer;
  sequenceNumber: number;
  studentName: string;
  rollNumber: string;
}

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
      try {
        // Load the source PDF
        const sourcePdf = await PDFDocument.load(pdf.buffer);
        
        // Copy all pages from source to merged PDF
        const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        
        // Add the copied pages to the merged PDF
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      } catch (err) {
        logError('[PDF Merge Error] Failed to merge source document.', err);
        // Continue with other PDFs even if one fails
      }
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
