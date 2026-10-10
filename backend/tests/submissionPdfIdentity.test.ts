import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { addMissingStudentIdentity } from '../src/utils/submissionPdfIdentity.js';

const packageRequire = createRequire(__filename);
const standardFontDataUrl = pathToFileURL(
  `${path.join(path.dirname(packageRequire.resolve('pdfjs-dist/package.json')), 'standard_fonts')}${path.sep}`,
).href;

const createPdf = async (lines: string[]): Promise<Buffer> => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 760;
  for (const line of lines) {
    page.drawText(line, { x: 48, y, size: 14, font });
    y -= 24;
  }
  return Buffer.from(await pdf.save());
};

const readPdfText = async (buffer: Buffer): Promise<string[]> => {
  const task = getDocument({
    data: Uint8Array.from(buffer),
    standardFontDataUrl,
    verbosity: VerbosityLevel.ERRORS,
  });
  try {
    const pdf = await task.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const content = await (await pdf.getPage(pageNumber)).getTextContent();
      pages.push(content.items.map((item) => 'str' in item ? item.str : '').join(' '));
    }
    return pages;
  } finally {
    await task.destroy();
  }
};

test('adds account roll number when the submitted PDF already contains the student name', async () => {
  const source = await createPdf(['Student Name: Ayesha Khan', 'Assignment response']);
  const result = await addMissingStudentIdentity(source, 'Ayesha Khan', 'BCS-2026-17');
  const pages = await readPdfText(result);

  assert.equal(pages.length, 1);
  assert.match(pages[0], /Roll Number: BCS-2026-17/);
  assert.match(pages[0], /Student Name: Ayesha Khan/);
});

test('adds both account details at the start when neither is present', async () => {
  const result = await addMissingStudentIdentity(
    await createPdf(['Assignment response']),
    'Bilal Ahmad',
    'CS-203',
  );
  const pages = await readPdfText(result);

  assert.equal(pages.length, 2);
  assert.match(pages[0], /Student Name: Bilal Ahmad/);
  assert.match(pages[0], /Roll Number: CS-203/);
});

test('leaves a PDF unchanged when both account details are present', async () => {
  const source = await createPdf(['Student Name: Sara Noor', 'Roll Number: CS-101']);

  assert.strictEqual(await addMissingStudentIdentity(source, 'Sara Noor', 'CS-101'), source);
});

test('matches the existing identity text font weight on the generated page', async () => {
  const result = await addMissingStudentIdentity(
    await createPdf(['Student Name: Ayesha Khan']),
    'Ayesha Khan',
    'CS-204',
  );
  const task = getDocument({
    data: Uint8Array.from(result),
    standardFontDataUrl,
    verbosity: VerbosityLevel.ERRORS,
  });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const item = content.items.find((candidate) => 'str' in candidate && candidate.str.includes('Roll Number'));
    assert.ok(item && 'fontName' in item);
    await page.getOperatorList();
    assert.equal(page.commonObjs.get(item.fontName).bold, true);
  } finally {
    await task.destroy();
  }
});
