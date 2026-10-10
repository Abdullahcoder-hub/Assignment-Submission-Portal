import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const packageRequire = createRequire(__filename);
const standardFontDataUrl = pathToFileURL(
  `${path.join(path.dirname(packageRequire.resolve('pdfjs-dist/package.json')), 'standard_fonts')}${path.sep}`,
).href;

interface PdfTextItem {
  str: string;
  dir: string;
  fontName: string;
  width: number;
  height: number;
  transform: number[];
  hasEOL: boolean;
}

interface IdentityTextStyle {
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
}

interface TextAnchor {
  x: number;
  y: number;
}

interface PdfFontMetadata {
  fallbackName?: string;
  bold?: boolean;
  black?: boolean;
  italic?: boolean;
}

const normalizeText = (value: string): string => value
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const containsIdentity = (documentText: string, value: string): boolean => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return false;
  const valuePattern = normalizedValue
    .split(' ')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  return new RegExp(`(?:^|\\s)${valuePattern}(?:$|\\s)`, 'u').test(documentText);
};

const getStyle = (
  item: PdfTextItem | undefined,
  fontFamily = '',
  fontMetadata?: PdfFontMetadata,
): IdentityTextStyle => {
  const fontName = item?.fontName || '';
  const detectedFontFamily = fontMetadata?.fallbackName || fontFamily;
  const fontSize = item?.transform ? Math.hypot(item.transform[0] || 0, item.transform[1] || 0) : 12;
  return {
    fontSize: Number.isFinite(fontSize) && fontSize > 0 ? Math.min(Math.max(fontSize, 8), 28) : 12,
    fontFamily: /serif|times/i.test(detectedFontFamily) ? 'serif' : /mono|courier/i.test(detectedFontFamily) ? 'mono' : 'sans',
    bold: fontMetadata?.bold === true || fontMetadata?.black === true || /bold|black|demi/i.test(`${fontName} ${fontFamily}`),
    italic: fontMetadata?.italic === true || /italic|oblique/i.test(`${fontName} ${fontFamily}`),
  };
};

const embedMatchingFont = async (pdf: PDFDocument, style: IdentityTextStyle) => {
  const font = style.fontFamily === 'serif'
    ? style.bold
      ? style.italic ? StandardFonts.TimesRomanBoldItalic : StandardFonts.TimesRomanBold
      : style.italic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman
    : style.fontFamily === 'mono'
      ? style.bold
        ? style.italic ? StandardFonts.CourierBoldOblique : StandardFonts.CourierBold
        : style.italic ? StandardFonts.CourierOblique : StandardFonts.Courier
      : style.bold
        ? style.italic ? StandardFonts.HelveticaBoldOblique : StandardFonts.HelveticaBold
        : style.italic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica;
  return pdf.embedFont(font);
};

export const addMissingStudentIdentity = async (
  buffer: Buffer,
  studentName: string,
  rollNumber: string,
): Promise<Buffer> => {
  const loadingTask = getDocument({
    data: Uint8Array.from(buffer),
    standardFontDataUrl,
    useSystemFonts: true,
    verbosity: VerbosityLevel.ERRORS,
  });
  let nameFound = false;
  let rollNumberFound = false;
  let identityStyle: IdentityTextStyle | undefined;
  let identityAnchor: TextAnchor | undefined;

  try {
    const source = await loadingTask.promise;
    for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
      const page = await source.getPage(pageNumber);
      const content = await page.getTextContent();
      const textItems = content.items.filter((item): item is PdfTextItem => 'str' in item);
      const pageText = normalizeText(textItems.map((item) => item.str).join(' '));
      const matchingNameItem = textItems.find((item) => containsIdentity(normalizeText(item.str), studentName));
      const matchingRollItem = textItems.find((item) => containsIdentity(normalizeText(item.str), rollNumber));

      if (!nameFound && containsIdentity(pageText, studentName)) {
        nameFound = true;
        const item = matchingNameItem ?? textItems[0];
        if (item) {
          await page.getOperatorList();
          const fontMetadata = page.commonObjs.has(item.fontName)
            ? page.commonObjs.get(item.fontName) as PdfFontMetadata
            : undefined;
          identityStyle = getStyle(item, content.styles[item.fontName]?.fontFamily, fontMetadata);
          identityAnchor = { x: item.transform[4] || 0, y: item.transform[5] || 0 };
        }
      }
      if (!rollNumberFound && containsIdentity(pageText, rollNumber)) {
        rollNumberFound = true;
        if (!identityStyle) {
          if (matchingRollItem) {
            await page.getOperatorList();
            const fontMetadata = page.commonObjs.has(matchingRollItem.fontName)
              ? page.commonObjs.get(matchingRollItem.fontName) as PdfFontMetadata
              : undefined;
            identityStyle = getStyle(matchingRollItem, content.styles[matchingRollItem.fontName]?.fontFamily, fontMetadata);
            identityAnchor = { x: matchingRollItem.transform[4] || 0, y: matchingRollItem.transform[5] || 0 };
          }
        }
      }
      if (nameFound && rollNumberFound) break;
    }
  } finally {
    await loadingTask.destroy();
  }

  const missingFields = [
    ...(!nameFound ? [`Student Name: ${studentName}`] : []),
    ...(!rollNumberFound ? [`Roll Number: ${rollNumber}`] : []),
  ];
  if (missingFields.length === 0) return buffer;

  const pdf = await PDFDocument.load(buffer);
  const firstPage = pdf.getPage(0);
  const { width: pageWidth, height: pageHeight } = firstPage.getSize();
  const style = identityStyle ?? getStyle(undefined);
  const margin = Math.min(48, pageWidth * 0.08);
  const availableWidth = pageWidth - margin * 2;
  const drawIdentityFields = (
    page: ReturnType<PDFDocument['getPage']>,
    fields: string[],
    font: Awaited<ReturnType<PDFDocument['embedFont']>>,
    x: number,
    firstY: number,
  ): void => {
    let y = firstY;
    for (const field of fields) {
      const fittedSize = Math.max(
        8,
        Math.min(style.fontSize, availableWidth / font.widthOfTextAtSize(field, 1)),
      );
      page.drawText(field, {
        x: Math.min(Math.max(x, margin), pageWidth - margin),
        y: Math.min(Math.max(y, margin), pageHeight - margin - fittedSize),
        size: fittedSize,
        font,
      });
      y -= fittedSize * 1.8;
    }
  };

  if (missingFields.length === 1 && identityAnchor) {
    const addRollNumber = !rollNumberFound;
    const font = await embedMatchingFont(pdf, style);
    drawIdentityFields(
      firstPage,
      missingFields,
      font,
      identityAnchor.x,
      identityAnchor.y + (addRollNumber ? -1 : 1) * style.fontSize * 1.5,
    );
    return Buffer.from(await pdf.save());
  }

  const cover = await PDFDocument.create();
  const coverPage = cover.addPage([pageWidth, pageHeight]);
  const font = await embedMatchingFont(cover, style);
  drawIdentityFields(coverPage, missingFields, font, margin, pageHeight - margin - style.fontSize);
  const result = await PDFDocument.create();
  const originalPages = await result.copyPages(pdf, pdf.getPageIndices());
  const identityPages = await result.copyPages(cover, cover.getPageIndices());
  identityPages.forEach((page) => result.addPage(page));
  originalPages.forEach((page) => result.addPage(page));
  return Buffer.from(await result.save());
};
